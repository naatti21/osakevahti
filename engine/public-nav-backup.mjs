/**
 * Read-only zero-cost public fund NAV backup (Alpha).
 * Reads the same single public JSON file as Rahastoraportti's public website.
 * Fetches the entire list: no portfolio identities, position sizes, bank, account,
 * purchase prices or client credentials are sent to the remote host.
 *
 * Snapshot cache is separate from the portfolio storage key.
 * Publication terms must be reviewed before any wider distribution.
 */
export const FUND_BACKUP_URL =
  "https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json";
export const FUND_BACKUP_STORAGE_KEY="osakevahti.alpha.public-nav-cache.v1";
const DAY=86400000;
const TTL=DAY;
const MAX_BYTES=6500000;
const MAX_AGE_DAYS=7;
const up=v=>String(v??"").trim().toUpperCase();
function validIsin(s) {
  if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s))return false;
  const digits=[...s].map(c=>/[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c).join("");
  let total=0,twice=false;
  for(let i=digits.length-1;i>=0;i--) {
    let n=Number(digits[i]);
    if(twice){n*=2;if(n>9)n-=9;}
    total+=n;twice=!twice;
  }
  return total%10===0;
}
function isoDay(raw,now) {
  const s=String(raw??"").trim();
  let y,m,d;
  if(/^\d{8}$/.test(s)) {
    y=+s.slice(0,4);m=+s.slice(4,6);d=+s.slice(6,8);
  } else if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    y=+s.slice(0,4);m=+s.slice(5,7);d=+s.slice(8,10);
  }else return null;
  const ms=Date.UTC(y,m-1,d,12),actual=new Date(ms);
  if(y<2000||actual.getUTCFullYear()!==y||
     actual.getUTCMonth()!==m-1||actual.getUTCDate()!==d||
     ms>now+DAY)return null;
  return [String(y),String(m).padStart(2,"0"),String(d).padStart(2,"0")].join("-");
}
function positivePrice(raw){
  const s=String(raw??"").trim();
  if(!/^\d{1,12}(?:[.,]\d{1,14})?$/.test(s))return null;
  const v=Number(s.replace(",","."));
  return Number.isFinite(v)&&v>0?v:null;
}
export function parseFundBackupSnapshot(raw,now=Date.now()){
  if(!Array.isArray(raw)||raw.length<1||raw.length>15000)
    return {ok:false,reason:"invalid_json_shape"};
  const entries=Object.create(null);
  const duplicate=new Set();
  let accepted=0;
  for(const row of raw){
    const isin=up(row?.ISIN),currency=up(row?.currency);
    if(!validIsin(isin)||!/^[A-Z]{3}$/.test(currency))continue;
    const price=positivePrice(row.closePrice);
    const navDate=isoDay(row.closePriceDate,now);
    if(!price||!navDate)continue;
    if(Object.hasOwn(entries,isin)){duplicate.add(isin);continue}
    entries[isin]={currency,navDate,price};
    accepted++;
  }
  for(const isin of duplicate)delete entries[isin];
  if(accepted<1)return {ok:false,reason:"no_usable_nav_rows"};
  return {ok:true,entries,total:raw.length,accepted:accepted-duplicate.size,
    duplicates:duplicate.size};
}
export function assessFundBackup(holding,entry,now=Date.now()){
  const isin=up(holding?.instrument?.isin||holding?.isin),ccy=up(holding?.currency);
  if(!validIsin(isin))return {status:"unavailable",reason:"isin_missing_or_invalid"};
  if(!entry)return {status:"unavailable",reason:"isin_not_in_public_feed"};
  if(!/^[A-Z]{3}$/.test(ccy)||ccy!==entry.currency)
    return {status:"rejected",reason:"currency_mismatch"};
  const navDate=isoDay(entry.navDate,now);
  if(!navDate)return {status:"rejected",reason:"invalid_nav_day"};
  const navMs=Date.parse(navDate+"T12:00:00Z");
  const age=Math.max(0,Math.round((now-navMs)/DAY));
  if(age>MAX_AGE_DAYS)return {status:"unavailable",reason:"public_nav_outdated"};
  if(!Number.isFinite(entry.price)||entry.price<=0)
    return {status:"rejected",reason:"invalid_price"};
  const oldDay=String(holding?.navDate||"").trim();
  const previous=isoDay(oldDay,now);
  if(previous&&previous>navDate)return {status:"rejected",reason:"older_than_existing_nav"};
  const oldPrice=Number(holding?.currentPrice);
  if(Number.isFinite(oldPrice)&&oldPrice>0){
    const pct=Math.abs(entry.price/oldPrice-1)*100;
    if(pct>20)return {status:"review",reason:"unusually_large_nav_change"};
    if(previous===navDate&&pct>2)return {status:"review",reason:"same_day_price_conflict"};
  }
  return {status:"candidate",isin,navDate,currency:ccy,price:entry.price,
    ageDays:age,source:"Rahastoraportti (julkinen NAV-varalähde)",
    sourceKind:"public-web-publication"};
}
export function shouldTryFundBackup(holding,now=Date.now()){
  if(holding?.assetType!=="fund")return false;
  const isin=up(holding?.instrument?.isin||holding?.isin);
  if(!validIsin(isin))return false;
  const info=isoDay(holding.navDate,now);
  const days=info?Math.max(0,Math.round((now-Date.parse(info+"T12:00:00Z"))/DAY)):Infinity;
  if(holding?.quoteHealth?.status==="failed"||holding?.quoteHealth?.status==="unlinked")
    return true;
  return days>MAX_AGE_DAYS||!info; // incl. yearless NAV source day
}
export function createFundBackup({
  fetchImpl=fetch, storage=typeof localStorage!=="undefined"?localStorage:null,
  now=()=>Date.now()
}={}){
  let session=null,pending=null,failedAt=0;
  function readCache(){
    if(session&&now()-session.fetchedAt<TTL)return session;
    try{
      const o=JSON.parse(storage?.getItem(FUND_BACKUP_STORAGE_KEY)||"null");
      if(o&&Number.isFinite(o.fetchedAt)&&now()-o.fetchedAt<TTL&&
        o.fetchedAt<=now()&&o.entries&&typeof o.entries==="object"){
        session=o;return o;
      }
    }catch{}
    return null;
  }
  async function fetchOnce(){
    const existing=readCache();
    if(existing)return existing;
    if(failedAt&&now()-failedAt<3600000)throw Error("public_nav_retry_cooldown");
    if(pending)return pending;
    pending=(async()=>{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),12000);
      try{
        const response=await fetchImpl(FUND_BACKUP_URL,{
          cache:"no-store",credentials:"omit",mode:"cors",
          signal:controller.signal,redirect:"error",
          headers:{Accept:"application/json,application/octet-stream"}
        });
        if(!response.ok)throw Error("public_nav_http_"+response.status);
        const len=Number(response.headers?.get?.("content-length")||0);
        if(len>MAX_BYTES)throw Error("public_nav_too_large");
        const reader=response.body?.getReader();
        if(!reader)throw Error("public_nav_body_missing");
        const decoder=new TextDecoder();let size=0,raw="";
        for(;;){
          const {value,done}=await reader.read();
          if(done)break;
          size+=value.byteLength;
          if(size>MAX_BYTES){await reader.cancel();throw Error("public_nav_too_large")}
          raw+=decoder.decode(value,{stream:true});
        }
        const parsed=parseFundBackupSnapshot(JSON.parse(raw+decoder.decode()),now());
        if(!parsed.ok)throw Error(parsed.reason);
        const compact={fetchedAt:now(),entries:parsed.entries,total:parsed.total,
          accepted:parsed.accepted};
        session=compact;
        try{storage?.setItem(FUND_BACKUP_STORAGE_KEY,JSON.stringify(compact))}catch{}
        failedAt=0;
        return compact;
      }catch(e){failedAt=now();throw e}
      finally{clearTimeout(timeout);pending=null}
    })();
    return pending;
  }
  async function lookup(holding){
    if(!holding||holding.assetType!=="fund")
      return {status:"unavailable",reason:"not_fund"};
    const isin=up(holding.instrument?.isin||holding.isin);
    if(!validIsin(isin))
      return {status:"unavailable",reason:"isin_missing_or_invalid"};
    try{
      const data=await fetchOnce();
      return {...assessFundBackup(holding,data.entries[isin],now()),
        fetchedAt:data.fetchedAt,sourceCount:data.accepted};
    }catch(err){
      return {status:"unavailable",reason:String(err?.message||"public_nav_unreachable")};
    }
  }
  return {lookup,state:()=>({cached:!!readCache(),fetchedAt:session?.fetchedAt||0})};
}
