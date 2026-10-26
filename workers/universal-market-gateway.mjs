/**
 * Cloudflare-compatible universal market discovery/quote gateway.
 * Experimental, read-only, and NOT wired to production or Alpha PWA.
 *
 * Endpoints:
 * GET  /v1/search?q=<name|symbol|ISIN>
 * POST /v1/quotes {"instruments":[{"ticker":"XYZ.HE","currency":"EUR","type":"stock"}]}
 *
 * Requests never contain quantities, accounts, transactions, cost basis or secrets.
 * All observations are CANDIDATES until the local app has an approved source binding.
 */
import {yahooAdapter} from "./providers/yahoo-experimental.mjs";

const ALPHA_ORIGIN="https://osakevahti-alpha-naatti21.pages.dev";
const TYPES=new Set(["stock","etf","index","fund","other"]);
const PRIVATE_FIELDS=new Set(["holdings","quantity","amount","buyprice","buy_price",
  "account","accounttype","accountlabel","broker","cost","costbasis","balance",
  "position","positions","transactions","purchaseprice","fxrate","apikey",
  "api_key","token","portfolio","portfolioid","importmeta","userdata"]);
const FIELD_NAMES=new Set(["ticker","providerSymbol","currency","type","isin","mic","shareClass","name"]);
const isText=(v,max)=>typeof v==="string"&&v.length<=max;
const uc=v=>String(v??"").trim().toUpperCase();

function containsPrivateFields(data,depth=0){
  if(depth>8)return true;
  if(!data||typeof data!=="object")return false;
  if(Array.isArray(data))return data.some(x=>containsPrivateFields(x,depth+1));
  return Object.entries(data).some(([k,v])=>
    PRIVATE_FIELDS.has(k.toLowerCase())||containsPrivateFields(v,depth+1));
}
function checkedInstrument(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  if(Object.keys(raw).some(k=>!FIELD_NAMES.has(k)))return null;
  const ticker=uc(raw.providerSymbol||raw.ticker);
  const currency=uc(raw.currency);
  const type=String(raw.type||"").toLowerCase();
  if(!/^[A-Z0-9^][A-Z0-9.^=_-]{0,47}$/.test(ticker))return null;
  if(!/^[A-Z]{3}$/.test(currency)||!TYPES.has(type))return null;
  if(raw.isin && !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(uc(raw.isin)))return null;
  if(raw.mic && !/^[A-Z0-9]{4}$/.test(uc(raw.mic)))return null;
  if(raw.shareClass && !isText(raw.shareClass,20))return null;
  if(raw.name && !isText(raw.name,160))return null;
  return {
    ticker,currency,type,isin:uc(raw.isin),mic:uc(raw.mic),
    shareClass:uc(raw.shareClass),name:String(raw.name||"").slice(0,160)
  };
}
async function bodyWithinLimit(req,limit=12000){
  const len=Number(req.headers.get("content-length")||0);
  if(len>limit)throw Error("request_too_large");
  if(!req.body)return "";
  const reader=req.body.getReader(),decoder=new TextDecoder();
  let text="",size=0;
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>limit){await reader.cancel();throw Error("request_too_large");}
    text+=decoder.decode(value,{stream:true});
  }
  return text+decoder.decode();
}

function responseJSON(data,status=200,origin=ALPHA_ORIGIN){
  return new Response(JSON.stringify(data),{status,headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "Access-Control-Allow-Origin":origin,
    "Vary":"Origin",
    "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type"
  }});
}

export function createUniversalGateway({provider,allowedOrigin=ALPHA_ORIGIN}={}) {
  if(!provider||typeof provider.search!=="function"||typeof provider.quote!=="function")
    throw Error("quote_provider_required");
  return async function handle(request) {
    const origin=request.headers.get("origin");
    if(origin&&origin!==allowedOrigin)
      return responseJSON({error:"forbidden_origin"},403,allowedOrigin);
    const url=new URL(request.url),path=url.pathname,method=request.method;
    if(method==="OPTIONS")return new Response(null,{status:204,headers:{
      "Access-Control-Allow-Origin":allowedOrigin,
      "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type",
      "Vary":"Origin","Cache-Control":"no-store"
    }});
    if(method==="GET"&&path==="/v1/search") {
      const q=String(url.searchParams.get("q")||"").trim();
      if(q.length<2||q.length>80||/[<>{}\r\n]/.test(q))
        return responseJSON({error:"invalid_query"},400,allowedOrigin);
      try{
        const candidates=await provider.search(q);
        return responseJSON({provider:provider.id,candidates:candidates.slice(0,12),
          quoteIsNotVerified:true},200,allowedOrigin);
      }catch(err){
        return responseJSON({error:"upstream_unavailable",
          provider:provider.id,
          reason:String(err?.message||"unknown").slice(0,80)},503,allowedOrigin);
      }
    }
    if(method==="POST"&&path==="/v1/quotes"){
      let payload;
      try{
        if(!/^application\/json\b/i.test(request.headers.get("content-type")||""))
          return responseJSON({error:"content_type_required"},415,allowedOrigin);
        payload=JSON.parse(await bodyWithinLimit(request));
      }catch(err){
        return responseJSON({error:String(err?.message)==="request_too_large"?
          "request_too_large":"invalid_json"},400,allowedOrigin);
      }
      if(containsPrivateFields(payload))
        return responseJSON({error:"private_portfolio_fields_prohibited"},400,allowedOrigin);
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
        Object.keys(payload).some(k=>k!=="instruments")||
        !Array.isArray(payload.instruments)||payload.instruments.length<1||
        payload.instruments.length>8)
        return responseJSON({error:"invalid_instruments_batch"},400,allowedOrigin);
      const instruments=payload.instruments.map(checkedInstrument);
      if(instruments.some(x=>!x))
        return responseJSON({error:"invalid_instrument_identity"},400,allowedOrigin);
      const results=[];
      for(let i=0;i<instruments.length;i++){
        const identity=instruments[i];
        try{
          const quote=await provider.quote(identity);
          const output={index:i,requested:{
              ticker:identity.ticker,type:identity.type,currency:identity.currency
            }};
          if(quote?.status!=="candidate"){
            results.push({...output,status:"unavailable",
              reason:String(quote?.reason||"source_unavailable").slice(0,100)});
            continue;
          }
          const symbol=uc(quote.instrument?.providerSymbol);
          const currency=uc(quote.currency);
          const price=Number(quote.price);
          const event=quote.quote_at;
          const timestamp=event===null?null:Number(event);
          const nav=quote.nav_date;
          const validTime=timestamp===null||
            (Number.isFinite(timestamp)&&timestamp>=946684800000&&timestamp<=Date.now()+300000);
          const navValid=typeof nav==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(nav)&&
            !Number.isNaN(Date.parse(nav+"T12:00:00Z"))&&
            Date.parse(nav+"T12:00:00Z")<=Date.now()+86400000;
          if(symbol!==identity.ticker||currency!==identity.currency||
             !Number.isFinite(price)||price<=0||!validTime||
             (identity.type==="fund"&&!navValid)){
            results.push({...output,status:"rejected",reason:"quote_identity_or_time_invalid"});
            continue;
          }
          results.push({...output,status:"candidate",price,currency,
            provider:String(quote.provider||provider.id).slice(0,80),
            quote_at:timestamp,
            fetched_at:Number.isFinite(Number(quote.fetched_at))?
              Number(quote.fetched_at):null,
            nav_date:identity.type==="fund"?nav:null,
            instrument:{providerSymbol:symbol,currency,isin:quote.instrument?.isin||null,
              mic:quote.instrument?.mic||null,
              shareClass:quote.instrument?.shareClass||null,
              identityStatus:quote.instrument?.identityStatus||"unverified"},
            identityVerified:false});
        }catch(err){
          results.push({index:i,status:"unavailable",reason:"upstream_failure",
            provider:provider.id});
        }
      }
      return responseJSON({results,disclaimer:"Candidate prices only; verify source binding and timestamp before valuation."},
        200,allowedOrigin);
    }
    return responseJSON({error:"not_found"},404,allowedOrigin);
  };
}

// Cloudflare-compatible Worker entrypoint, with NO user-specific storage.
const handler=createUniversalGateway({provider:yahooAdapter()});
export default {fetch(request){return handler(request)}};
