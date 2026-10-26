/**
 * Free, keyless identity/FX HTTP endpoints.
 * Strictly read-only, no portfolio data, no paid vendors or tokens.
 * GET /v1/identity?isin=...
 * GET /v1/fx?base=USD&quote=EUR
 *
 * In-memory budget + success cache reduce repeated public API calls.
 * Per-isolate quotas are NOT distributed/global; do not present them as such.
 */
import {validIsin} from "./providers/fund-nav-contract.mjs";
import {openFigiFree,frankfurterFreeFx} from "./providers/free-foundation.mjs";

const ALPHA_ORIGIN="https://osakevahti-alpha-naatti21.pages.dev";
const CACHE_FX_MS=4*60*60*1000;
const CACHE_ID_MS=7*24*60*60*1000;
const BUDGET_WINDOW_MS=60*1000;
const BUDGET_ID_PER_WINDOW=10; // Below anonymous OpenFIGI limit 25/min.
const BUDGET_FX_PER_WINDOW=15;
const upper=v=>String(v??"").trim().toUpperCase();
const currency=v=>/^[A-Z]{3}$/.test(v);

function respond(payload,status=200,origin=ALPHA_ORIGIN,extra={}) {
  return new Response(JSON.stringify(payload),{status,headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "Access-Control-Allow-Origin":origin,
    "Access-Control-Allow-Methods":"GET, OPTIONS",
    "Vary":"Origin",
    ...extra
  }});
}

function budgetGuard(now,max) {
  let start=now(),used=0;
  return ()=>{
    const current=now();
    if(current-start>=BUDGET_WINDOW_MS){start=current;used=0;}
    if(used>=max)return {ok:false,retryAfter:Math.max(1,Math.ceil((BUDGET_WINDOW_MS-(current-start))/1000))};
    used++;
    return {ok:true};
  };
}

export function createFreeReferenceGateway({
  identity=openFigiFree(),fx=frankfurterFreeFx(),
  now=()=>Date.now(),allowedOrigin=ALPHA_ORIGIN
}={}) {
  if(typeof identity?.lookupIsin!=="function"||typeof fx?.rate!=="function")
    throw Error("free_sources_required");
  const cache=new Map(),inFlight=new Map();
  const spendIdentity=budgetGuard(now,BUDGET_ID_PER_WINDOW);
  const spendFx=budgetGuard(now,BUDGET_FX_PER_WINDOW);
  async function lookup(key,ttl,spend,load) {
    const saved=cache.get(key);
    if(saved && saved.expires>now())return {status:200,data:saved.data,cached:true};
    if(inFlight.has(key))return inFlight.get(key);
    const budget=spend();
    if(!budget.ok)return {status:429,data:{error:"free_source_local_budget",retryAfterSeconds:budget.retryAfter},
      retryAfter:budget.retryAfter};
    const operation=(async()=>{
      try{
        const data=await load();
        // Negative lookups and failed/unknown provider responses must not be
        // promoted to verified data or cached for weeks.
        if(data?.status==="candidates"||data?.status==="dated_reference"||data?.status==="identity")
          cache.set(key,{data,expires:now()+ttl});
        return {status:200,data,cached:false};
      }catch(err) {
        return {status:503,data:{error:"free_source_unavailable",
          reason:String(err?.message||"source_failure").slice(0,70)}};
      }finally{inFlight.delete(key);}
    })();
    inFlight.set(key,operation);
    return operation;
  }
  return async function handle(req) {
    const url=new URL(req.url),path=url.pathname;
    if(path!=="/v1/identity"&&path!=="/v1/fx")return null;
    const origin=req.headers.get("Origin");
    if(origin && origin!==allowedOrigin)
      return respond({error:"forbidden_origin"},403,allowedOrigin);
    if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{
      "Access-Control-Allow-Origin":allowedOrigin,
      "Access-Control-Allow-Methods":"GET, OPTIONS",
      "Cache-Control":"no-store","Vary":"Origin"
    }});
    if(req.method!=="GET")return respond({error:"method_not_allowed"},405,allowedOrigin);
    if(path==="/v1/identity") {
      if([...url.searchParams.keys()].some(x=>x!=="isin")||url.searchParams.getAll("isin").length!==1)
        return respond({error:"invalid_identity_query"},400,allowedOrigin);
      const isin=upper(url.searchParams.get("isin"));
      if(!validIsin(isin))return respond({error:"invalid_isin_checksum"},400,allowedOrigin);
      const result=await lookup("isin:"+isin,CACHE_ID_MS,spendIdentity,
        ()=>identity.lookupIsin(isin));
      return respond({
        ...(result.data||{}),lookup:"isin",verifiedPrice:false,
        automaticBindingAllowed:false,cached:!!result.cached,
        provider:"OpenFIGI"
      },result.status,allowedOrigin,
      result.retryAfter?{"Retry-After":String(result.retryAfter)}:{});
    }
    if([...url.searchParams.keys()].some(x=>!["base","quote"].includes(x))||
      url.searchParams.getAll("base").length!==1||url.searchParams.getAll("quote").length!==1)
      return respond({error:"invalid_fx_query"},400,allowedOrigin);
    const base=upper(url.searchParams.get("base"));
    const quote=upper(url.searchParams.get("quote"));
    if(!currency(base)||!currency(quote))
      return respond({error:"invalid_fx_currency"},400,allowedOrigin);
    const result=await lookup("fx:"+base+":"+quote,CACHE_FX_MS,spendFx,
      ()=>fx.rate(base,quote));
    return respond({
      ...(result.data||{}),cached:!!result.cached,
      provider:result.data?.provider||"Frankfurter",
      paidSourceUsed:false
    },result.status,allowedOrigin,
    result.retryAfter?{"Retry-After":String(result.retryAfter)}:{});
  };
}
