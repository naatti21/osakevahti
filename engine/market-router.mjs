/**
 * Generic adapter router for market observations. No instruments are compiled
 * into this module. The caller owns provider configuration and network access.
 *
 * Adapter interface:
 *   id: string
 *   supports(instrument): boolean
 *   resolve(instrument): Promise<candidate[]>
 *   observe(instrument,candidate): Promise<{
 *     instrument, price, currency, provider, quote_at, fetched_at, nav_date
 *   }>
 *
 * A single adapter failure never rewrites a position's last known good value.
 * The caller explicitly accepts and persists only verified results.
 */
import {
  buildMarketRequests,candidateDecision,normalizeObservation
} from "./market-core.mjs";

const str = value => String(value??"").trim();

export async function fetchMarketUniverse(holdings,{providers=[],now=Date.now()}={}) {
  const {requests,rejected}=buildMarketRequests(holdings);
  const observations=[],issues=[];
  for(const request of requests){
    const {instrument,key}=request;
    let selected=null;
    let needsConfirmation=false;
    const attempts=[];
    for(const provider of providers){
      if(!provider || typeof provider.supports!=="function" ||
         !provider.supports(instrument)) continue;
      try {
        const candidates=await provider.resolve(instrument);
        if(!Array.isArray(candidates)) throw new Error("invalid_candidates");
        const accepted=[],proposed=[];
        for(const c of candidates){
          const decision=candidateDecision(instrument,c);
          if(decision.status==="match")accepted.push(c);
          else if(decision.status==="confirm")proposed.push(c);
        }
        // Multiple matching listings/vehicles require a human decision.
        if(accepted.length!==1) {
          if(accepted.length>1||proposed.length){
            needsConfirmation=true;
            attempts.push({provider:str(provider.id),status:"needs_confirmation"});
          }else{
            attempts.push({provider:str(provider.id),status:"not_found"});
          }
          continue;
        }
        const raw=await provider.observe(instrument,accepted[0]);
        const observation=normalizeObservation(instrument,raw,now);
        if(observation.status!=="usable"||observation.identityConfidence!=="matched") {
          attempts.push({provider:str(provider.id),
            status:observation.status==="usable"?"needs_confirmation":observation.status,
            reason:observation.reason||""});
          if(observation.status==="usable")needsConfirmation=true;
          continue;
        }
        selected={key,instrument,observation};
        break;
      }catch(err){
        attempts.push({provider:str(provider.id),status:"error",
          reason:String(err?.message||err||"provider_error").slice(0,120)});
      }
    }
    if(selected) observations.push(selected);
    else issues.push({key,status:needsConfirmation?"needs_confirmation":"unavailable",
      attempts});
  }
  return {observations,issues,rejected};
}
