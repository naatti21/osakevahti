/**
 * Rahastoraportti public website-linked fund NAV JSON: PERSONAL BACKUP ONLY.
 * Exact ISIN lookups, never company-name guessing. No holdings, transaction
 * data or user IDs leave this Worker; one public global JSON read is shared.
 *
 * Source JSON is directly loaded by the website; it is not an issuer API or
 * a separately authorized redistribution feed. Disabled unless operator opts
 * into experimental personal backup. Do not expose its full 2k-row payload.
 */
import {validIsin} from "./fund-nav-contract.mjs";

export const PUBLIC_FUND_JSON_URL =
  "https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json";
const DAY_MS=24*60*60*1000;
const upper=x=>String(x??"").trim().toUpperCase();
const text=x=>String(x??"").trim();
function navDay(raw,now){
  const s=text(raw);
  let year,month,day;
  if(/^\d{8}$/.test(s)){
    year=+s.slice(0,4);month=+s.slice(4,6);day=+s.slice(6,8);
  } else if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    year=+s.slice(0,4);month=+s.slice(5,7);day=+s.slice(8,10);
  } else if(/^\d{2}\.\d{2}\.\d{4}$/.test(s)){
    day=+s.slice(0,2);month=+s.slice(3,5);year=+s.slice(6,10);
  }else return null;
  const ms=Date.UTC(year,month-1,day,12),o=new Date(ms);
  if(year<2000||o.getUTCFullYear()!==year||o.getUTCMonth()!==month-1||
     o.getUTCDate()!==day||ms>now+DAY_MS)return null;
  return [year,String(month).padStart(2,"0"),String(day).padStart(2,"0")].join("-");
}
function priceNumber(raw){
  const s=text(raw);
  if(!/^\d{1,12}(?:[.,]\d{1,14})?$/.test(s))return null;
  const n=Number(s.replace(",","."));
  return Number.isFinite(n)&&n>0?n:null;
}
export function fundJsonRow(raw,now=Date.now()){
  if(!raw||typeof raw!=="object"||!validIsin(raw.ISIN))return null;
  const currency=upper(raw.currency),navDate=navDay(raw.closePriceDate,now);
  const price=priceNumber(raw.closePrice);
  if(!/^[A-Z]{3}$/.test(currency)||!navDate||price===null)return null;
  return {
    isin:upper(raw.ISIN),currency,navDate,price,
    name:text(raw.companyNameFi||raw.companyNameEn||raw.companyNameSv).slice(0,160),
    // Supplemental text, not authoritative evidence of share-class identity.
    classLabel:text(raw.class?.fi||raw.class?.en||raw.class?.sv).slice(0,80),
    fundCode:text(raw.fundCode).slice(0,50)
  };
}

export function indexPublicFundJson(payload,now=Date.now()){
  if(!Array.isArray(payload)||payload.length>15000)return {error:"invalid_source_array",index:null};
  const index=new Map(),invalid=[];
  for(const raw of payload){
    const isin=upper(raw?.ISIN);
    if(!validIsin(isin))continue;
    const row=fundJsonRow(raw,now);
    if(!row){invalid.push(isin);continue;}
    // Don't guess which of several rows with identical ISIN is correct.
    if(index.has(isin))index.set(isin,null);
    else index.set(isin,row);
  }
  return {index,invalidCount:invalid.length,totalRows:payload.length};
}

export function createRahastoraporttiPublicSource({
  fetchImpl=fetch,now=()=>Date.now(),ttlMs=DAY_MS,
  failCooldownMs=3600000,timeoutMs=12000
}={}){
  let snapshot=null,checkedAt=0,failedAt=0,inFlight=null;
  async function load(){
    const t=now();
    if(snapshot&&t-checkedAt<ttlMs)return snapshot;
    if(failedAt&&t-failedAt<failCooldownMs)
      throw Error("public_fund_source_cooldown");
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
      try{
        const response=await fetchImpl(PUBLIC_FUND_JSON_URL,{signal:ctrl.signal,
          redirect:"error",cache:"no-store",
          headers:{Accept:"application/json,application/octet-stream"}});
        if(!response.ok)throw Error("public_fund_source_http_"+response.status);
        const maxBytes=6500000;
        if(Number(response.headers?.get?.("content-length")||0)>maxBytes)
          throw Error("public_fund_response_too_large");
        // This website supplies ~1.3MB JSON. Use an explicitly bounded body.
        const reader=response.body?.getReader();
        if(!reader)throw Error("public_fund_stream_missing");
        const decoder=new TextDecoder();
        let bytes=0,raw="";
        for(;;){
          const {done,value}=await reader.read();
          if(done)break;
          bytes+=value.byteLength;
          if(bytes>maxBytes){await reader.cancel();throw Error("public_fund_response_too_large");}
          raw+=decoder.decode(value,{stream:true});
        }
        const j=JSON.parse(raw+decoder.decode());
        const parsed=indexPublicFundJson(j,now());
        if(parsed.error||!parsed.index||parsed.index.size===0)
          throw Error("public_fund_invalid_schema");
        snapshot=parsed;checkedAt=now();failedAt=0;
        return snapshot;
      }catch(err){failedAt=now();throw err;}
      finally{clearTimeout(timer);inFlight=null;}
    })();
    return inFlight;
  }
  return {
    id:"rahastoraportti-public-personal-backup",
    lineage:"sijoitustutkimus-public-fund-prices",
    sourceKind:"public-web-publication",
    async getNav({isin}){
      const key=upper(isin);
      if(!validIsin(key))throw Error("fund_isin_invalid");
      const data=await load();
      if(!data.index.has(key))return null;
      const r=data.index.get(key);
      if(!r)throw Error("fund_isin_ambiguous");
      return {
        isin:key,currency:r.currency,price:r.price,navDate:r.navDate,
        provider:"Rahastoraportti public price list",
        sourceKind:"public-web-publication",
        fetched_at:checkedAt,
        // Source displays ISIN and class separately; do not guess class letter.
        shareClass:null,
        fundCode:r.fundCode,
        identityEvidence:"exact_public_ISIN",
        requiresManualReview:true
      };
    },
    async search(query){
      const q=text(query).toLocaleLowerCase("fi");
      if(q.length<3||q.length>80)return [];
      const data=await load(),matches=[];
      for(const r of data.index.values()){
        if(!r)continue;
        if(r.isin.toLowerCase()===q||r.name.toLocaleLowerCase("fi").includes(q)){
          matches.push({isin:r.isin,name:r.name,currency:r.currency,
            shareClass:null,sourceId:"rahastoraportti-public-personal-backup",
            identityStatus:"public-isin-candidate"});
        }
        if(matches.length>=12)break;
      }
      return matches;
    },
    state(){return {snapshotCheckedAt:checkedAt,failedAt,
      cached:!!snapshot,source:"public-web-publication",billing:"none"};}
  };
}
