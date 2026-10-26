/**
 * Read-only Alpha client bridge to the generic quote gateway.
 * Pure boundary, never writes state, localStorage, amounts or cost basis.
 * It returns reviewable candidate evidence, not portfolio price updates.
 */
import {buildMarketRequests} from "./market-core.mjs";

const BATCH_SIZE=8;
const FIELDS=["ticker","providerSymbol","currency","type","isin","mic","shareClass","name"];
function safeIdentity(i){
  const raw={...i,ticker:i.providerSymbol||i.ticker||""};
  return Object.fromEntries(FIELDS.map(key=>[key,raw[key]??""]));
}
function requestable(i){
  return (i.ticker||i.isin)&&i.currency&&i.type&&
    (i.type==="fund"||i.ticker);
}

export async function previewGatewayQuotes(holdings,{
  fetchImpl=fetch,gatewayUrl
}={}){
  if(typeof gatewayUrl!=="string"||!/^https:\/\//.test(gatewayUrl))
    throw Error("explicit_https_market_gateway_required");
  const endpoint=new URL("/v1/quotes",gatewayUrl);
  const {requests,rejected}=buildMarketRequests(holdings);
  const candidates=[],issues=rejected.map(r=>({
    localId:r.localId,status:"rejected",reason:r.reasons.join(",")
  }));
  const prepared=[];
  for(const r of requests){
    const instrument=safeIdentity(r.instrument);
    if(!requestable(instrument)){
      issues.push({key:r.key,status:"needs_instrument_resolution",
        reason:"verified_ticker_or_fund_isin_required"});
    } else prepared.push({key:r.key,instrument});
  }
  for(let offset=0;offset<prepared.length;offset+=BATCH_SIZE){
    const batch=prepared.slice(offset,offset+BATCH_SIZE);
    try {
      const response=await fetchImpl(endpoint.toString(),{
        method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({instruments:batch.map(x=>x.instrument)})
      });
      if(!response.ok)throw Error("gateway_http_"+response.status);
      const data=await response.json();
      if(!Array.isArray(data.results)||data.results.length!==batch.length)
        throw Error("invalid_quote_batch_response");
      for(let i=0;i<batch.length;i++){
        const selected=batch[i],value=data.results[i]||{};
        if(value.index!==i||value.requested?.currency!==selected.instrument.currency||
           value.requested?.type!==selected.instrument.type||
           value.requested?.ticker!==selected.instrument.ticker){
          issues.push({key:selected.key,status:"rejected",reason:"response_identity_mismatch"});
          continue;
        }
        if(value.status!=="candidate"){
          issues.push({key:selected.key,status:value.status==="rejected"?"rejected":"unavailable",
            reason:String(value.reason||"quote_unavailable").slice(0,100)});
          continue;
        }
        // Candidate evidence is NOT accepted portfolio market data. Require a
        // separate source-binding verification before use in risk/value.
        const currency=value.currency,price=Number(value.price);
        const symbol=value.instrument?.providerSymbol||"";
        const isin=value.instrument?.isin||"";
        const match=currency===selected.instrument.currency&&
          (selected.instrument.type==="fund"?
            !!selected.instrument.isin&&isin===selected.instrument.isin:
            symbol===selected.instrument.ticker);
        if(!match||!Number.isFinite(price)||price<=0){
          issues.push({key:selected.key,status:"rejected",reason:"candidate_identity_or_price_invalid"});
          continue;
        }
        candidates.push({
          key:selected.key,reviewRequired:true,portfolioWriteAllowed:false,
          instrument:selected.instrument,
          observation:{
            price,currency,provider:String(value.provider||"unknown"),
            quoteAt:value.quote_at??null,
            fetchedAt:value.fetched_at??null,
            navDate:value.nav_date??null,
            sourceKind:value.sourceKind??null,
            providerIdentity:value.instrument
          }
        });
      }
    }catch(err) {
      for(const x of batch)issues.push({key:x.key,status:"unavailable",
        reason:String(err?.message||"gateway_error").slice(0,100)});
    }
  }
  return {candidates,issues,requestCount:requests.length};
}
