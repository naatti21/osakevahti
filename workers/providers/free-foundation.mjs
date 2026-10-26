/**
 * Keyless official APIs only: OpenFIGI mapping (identity) and Frankfurter FX.
 * No portfolio state, no paid subscription, no market quote fabrication.
 */
const clean=x=>String(x??"").trim().toUpperCase();
const ISIN=/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const CUR=/^[A-Z]{3}$/;
function validDay(raw,now) {
  const s=String(raw??""),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return false;
  const ms=Date.UTC(+m[1],+m[2]-1,+m[3],12),d=new Date(ms);
  return +m[1]>=2000&&d.getUTCFullYear()===+m[1]&&
    d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3]&&
    ms<=now+86400000;
}
function checkedFetch(fetchImpl,now,timeoutMs) {
  return async (url,method="GET",body)=>{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
    try {
      const r=await fetchImpl(url,{
        method,body:body?JSON.stringify(body):undefined,
        headers:body?{"Content-Type":"application/json","Accept":"application/json"}:
          {"Accept":"application/json"},
        redirect:"error",cache:"no-store",signal:ctrl.signal
      });
      if(!r.ok)throw Error("source_http_"+r.status);
      const data=await r.json();
      if(data===null||typeof data!=="object")throw Error("invalid_response");
      return data;
    }finally{clearTimeout(timer);}
  };
}

/**
 * Source does NOT verify the user's share class or a current price.
 * Never use OpenFIGI candidates to overwrite a position's identities silently.
 */
export function openFigiFree({fetchImpl=fetch,timeoutMs=8000}={}) {
  const get=checkedFetch(fetchImpl,Date.now,timeoutMs);
  return {
    id:"openfigi-public",costMonthlyEUR:0,lineage:"openfigi",
    async lookupIsin(rawIsin) {
      const isin=clean(rawIsin);
      if(!ISIN.test(isin))throw Error("invalid_isin");
      const data=await get("https://api.openfigi.com/v3/mapping","POST",[
        {idType:"ID_ISIN",idValue:isin}
      ]);
      if(!Array.isArray(data)||data.length!==1)throw Error("invalid_mapping_response");
      const result=data[0];
      if(result?.error)return {status:"unavailable",reason:"mapping_not_found",candidates:[]};
      if(!Array.isArray(result?.data))return {status:"unavailable",reason:"mapping_missing",candidates:[]};
      const candidates=result.data.slice(0,50).filter(x=>
        typeof x.figi==="string"&&/^[A-Z0-9]{12}$/.test(x.figi)
      ).map(x=>({
        isinQuery:isin,figi:x.figi,
        ticker:clean(x.ticker)||null,
        shareClassFIGI:clean(x.shareClassFIGI)||null,
        compositeFIGI:clean(x.compositeFIGI)||null,
        exchangeCode:clean(x.exchCode)||null,
        mic:null,currency:null,
        name:String(x.name||"").slice(0,160),
        verifiedPrice:false,
        automaticBindingAllowed:false
      }));
      return {status:candidates.length?"candidates":"unavailable",candidates,
        requiresConfirmation:true};
    }
  };
}

export function frankfurterFreeFx({fetchImpl=fetch,timeoutMs=8000,now=()=>Date.now()}={}) {
  const get=checkedFetch(fetchImpl,now,timeoutMs);
  return {
    id:"frankfurter",costMonthlyEUR:0,lineage:"central-bank-reference",
    async rate(base,quote){
      const a=clean(base),b=clean(quote);
      if(!CUR.test(a)||!CUR.test(b))throw Error("invalid_currency");
      if(a===b)return {base:a,quote:b,rate:1,date:null,
        status:"identity",provider:"identity",sourceKind:"no_fx_conversion"};
      // Pin the ECB instead of Frankfurter v2's blended multi-provider rate.
      // This keeps EUR portfolio FX provenance comparable across refreshes.
      const data=await get("https://api.frankfurter.dev/v2/rate/"+a.toLowerCase()+"/"+b.toLowerCase()+"?providers=ecb");
      if(clean(data.base)!==a||clean(data.quote)!==b)
        return {status:"rejected",reason:"fx_pair_mismatch"};
      const rate=data.rate;
      if(typeof rate!=="number"||!Number.isFinite(rate)||rate<=0)
        return {status:"rejected",reason:"fx_invalid_rate"};
      if(!validDay(data.date,now()))
        return {status:"rejected",reason:"fx_reference_date_missing"};
      return {status:"dated_reference",base:a,quote:b,
        rate,date:data.date,provider:"Frankfurter",authority:"ECB",
        lineage:"ecb-reference",
        sourceKind:"daily-central-bank-reference",intraday:false};
    }
  };
}
