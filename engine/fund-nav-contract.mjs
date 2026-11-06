/**
 * Provider-neutral FUND NAV adapter. This module makes no network request.
 * A qualified issuer/broker/licensed vendor must implement:
 *   search(query): Promise<metadata[]>
 *   getNav({isin}): Promise<quote>
 * A string URL or an unverified issuer name is not sufficient evidence.
 * There is deliberately no per-fund source catalogue in this adapter.
 */
const upper=v=>String(v??"").trim().toUpperCase();
const DAY=/^(\d{4})-(\d{2})-(\d{2})$/;
const KINDS=new Set(["issuer","broker","licensed-feed","public-web-publication"]);
function validDate(raw,now){
  const s=String(raw??"").trim(),m=s.match(DAY);
  if(!m)return false;
  const [y,mo,d]=m.slice(1).map(Number),t=Date.UTC(y,mo-1,d,12),o=new Date(t);
  return y>=2000&&o.getUTCFullYear()===y&&o.getUTCMonth()===mo-1&&
    o.getUTCDate()===d&&t<=now+86400000;
}
import {validIsin} from "./isin.mjs";
export {validIsin};

export function validateNavQuote(raw,expected,now=Date.now()){
  const stop=reason=>({status:"rejected",reason});
  if(!validIsin(expected?.isin))return stop("requested_isin_invalid");
  if(!validIsin(raw?.isin)||upper(raw.isin)!==upper(expected.isin))
    return stop("isin_mismatch");
  if(!/^[A-Z]{3}$/.test(upper(raw.currency))||
    upper(raw.currency)!==upper(expected.currency))return stop("currency_mismatch");
  // Exact verified ISIN distinguishes the share class; a missing optional
  // label is not a conflict. A CONFLICTING declared class is always rejected.
  if(expected.shareClass && raw.shareClass && upper(raw.shareClass)!==upper(expected.shareClass))
    return stop("share_class_not_verified");
  if(!KINDS.has(String(raw.sourceKind||""))||!String(raw.provider||"").trim())
    return stop("source_not_qualified");
  if(typeof raw.price!=="number"||!Number.isFinite(raw.price)||raw.price<=0)
    return stop("nav_price_invalid");
  if(!validDate(raw.navDate,now))return stop("nav_day_not_verified");
  return {status:"candidate",price:raw.price,currency:upper(raw.currency),
    provider:String(raw.provider).slice(0,80),fetched_at:
      Number.isFinite(raw.fetched_at)?raw.fetched_at:null,
    quote_at:null,nav_date:raw.navDate,
    instrument:{isin:upper(raw.isin),currency:upper(raw.currency),
      providerSymbol:upper(raw.providerSymbol)||upper(expected.providerSymbol||expected.ticker),
      mic:upper(raw.mic)||null,
      shareClass:upper(raw.shareClass)||null,
      identityStatus:"issuer-or-qualified-provider-isin"},
    sourceKind:raw.sourceKind,
    requiresManualReview:raw.sourceKind==="public-web-publication"||raw.requiresManualReview===true,
    identityEvidence:raw.identityEvidence||"exact_isin"};
}

export function createFundNavAdapter({source,now=()=>Date.now()}={}){
  if(!source||typeof source.getNav!=="function")
    throw Error("qualified_nav_source_required");
  return {
    id:String(source.id||"fund-nav-provider"),
    async search(q){
      if(typeof source.search!=="function")return [];
      const data=await source.search(q);
      return Array.isArray(data)?data.filter(x=>validIsin(x?.isin)).map(x=>({
        ...x,type:"fund",provider:String(source.id||"fund-nav-provider"),
        identityStatus:"provider-report-needs-binding"
      })):[];
    },
    async quote(instrument){
      if(instrument.type!=="fund")
        return {status:"unavailable",reason:"not_fund"};
      if(!validIsin(instrument.isin))
        return {status:"unavailable",reason:"fund_isin_required"};
      const diagnostic=source.getNavResult?await source.getNavResult({isin:upper(instrument.isin)}):null;
      if(diagnostic&&diagnostic.status!=="candidate")return {status:"unavailable",reason:diagnostic.status,diagnostics:diagnostic};
      const raw=diagnostic?diagnostic.observation:await source.getNav({isin:upper(instrument.isin)});
      if(!raw)return {status:"unavailable",reason:"no_nav_for_isin"};
      // A provider may return the wrong share class or an old response:
      // validate metadata and the real source valuation date.
      return validateNavQuote(raw,instrument,now());
    }
  };
}

/**
 * As type routing is provider independent, any number of adapters can replace
 * these two without adding company tickers or fund names to the code.
 */
export function createAssetTypeProvider({market,funds}={}){
  if(!market||typeof market.quote!=="function")throw Error("market_source_required");
  return {
    id:"asset-type-router",
    async search(q){
      const [a,b]=await Promise.allSettled([
        market.search(q),funds?.search?funds.search(q):Promise.resolve([])
      ]);
      const candidates=[];
      if(a.status==="fulfilled"&&Array.isArray(a.value))candidates.push(...a.value);
      if(b.status==="fulfilled"&&Array.isArray(b.value))candidates.push(...b.value);
      return candidates.slice(0,24);
    },
    async quote(i){
      if(i.type==="fund"){
        if(!funds)return {status:"unavailable",reason:"dated_fund_nav_provider_required"};
        return funds.quote(i);
      }
      return market.quote(i);
    }
  };
}
