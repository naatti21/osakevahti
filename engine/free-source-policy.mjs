/**
 * Osakevahti / free-source policy.
 *
 * This is a capabilities/budget registry, NOT a hardcoded ticker/fund list.
 * Statuses are intentionally conservative. A free service without qualified
 * terms or source evidence is a candidate, not production-approved.
 */
export const ZERO_COST_SOURCES=Object.freeze([
  {
    id:"yahoo-experimental",role:"quote",lineage:"yahoo",
    assets:["stock","etf","index"],geography:"variable",
    terms:"unofficial-review-required",quoteEvidence:"timestamp-dependent",
    access:"public-unofficial",quota:"unpublished",monthlyEuroCost:0,
    enabledByDefault:false,reason:"Unsupported public chart endpoint; limits and data rights unverified."
  },
  {
    id:"finnhub-free",role:"quote",lineage:"finnhub",
    assets:["stock"],geography:"US-primary; international to verify",
    terms:"free-plan-to-verify",quoteEvidence:"provider-timestamp",
    access:"user-free-key",quota:"account-plan",monthlyEuroCost:0,
    enabledByDefault:false,reason:"Needs free key and each symbol/market/entitlement checked."
  },
  {
    id:"twelvedata-basic",role:"quote",lineage:"twelvedata",
    assets:["stock","etf"],geography:"US; trial symbols elsewhere",
    terms:"personal-internal-non-display",quoteEvidence:"provider-timestamp",
    access:"user-free-key",quota:{perMinuteCredits:8,perDayCredits:800},
    monthlyEuroCost:0,enabledByDefault:false,
    reason:"Basic does not include general EU market quotes. Check app display permission before enabling."
  },
  {
    id:"alphavantage-free",role:"historical",lineage:"alphavantage",
    assets:["stock","etf"],geography:"varies",
    terms:"free-plan-to-verify",quoteEvidence:"dated-eod",
    access:"user-free-key",quota:{perDayRequests:25},
    monthlyEuroCost:0,enabledByDefault:false,
    reason:"No free real-time/delayed US premium quote entitlement. 25 daily requests."
  },
  {
    id:"openfigi-public",role:"identity",lineage:"openfigi",
    assets:["stock","etf","fund","other"],geography:"many",
    terms:"documented-public-free",quoteEvidence:"no-price",
    access:"public",quota:{mappingRequestsPerMinute:25,mappingJobsPerCall:10},
    monthlyEuroCost:0,enabledByDefault:true,
    reason:"Identity candidates only; cannot create a stock quote or NAV."
  },
  {
    id:"frankfurter",role:"fx",lineage:"central-bank-reference",
    assets:["fx"],geography:"supported currencies",
    terms:"documented-public-free",quoteEvidence:"dated-daily-reference",
    access:"public",quota:"fair-use",
    monthlyEuroCost:0,enabledByDefault:true,
    reason:"Daily reference rate, not intraday market FX."
  },
  {
    id:"issuer-public-nav",role:"fund-nav",lineage:"issuer",
    assets:["fund"],geography:"issuer-specific",
    terms:"per-source-review",quoteEvidence:"actual-valuation-date-required",
    access:"public-pages-when-permitted",quota:"source-dependent",
    monthlyEuroCost:0,enabledByDefault:false,
    reason:"No universal issuer NAV API. Source, ISIN, class, date and site terms checked independently."
  },
  {
    id:"nordnet-public-page",role:"fund-nav",lineage:"nordnet",
    assets:["fund"],geography:"supported public fund pages",
    terms:"automated-use-to-verify",quoteEvidence:"DD.MM. without guaranteed year",
    access:"public-pages-when-permitted",quota:"source-dependent",
    monthlyEuroCost:0,enabledByDefault:false,
    reason:"Yearless or cached NAV page is not independent verified dated quote."
  }
]);

/** Free does not mean permission to use or publish data. */
export function freeSourceStatus(source) {
  if(!source || source.monthlyEuroCost!==0 || source.access==="paid"||
     source.requiresPaidSubscription===true)
    return {usable:false,reason:"paid_or_unverified_cost"};
  if(source.enabledByDefault!==true)
    return {usable:false,reason:"not_qualified_or_needs_user_free_key"};
  if(source.terms!=="documented-public-free")
    return {usable:false,reason:"source_terms_unverified"};
  return {usable:true,reason:"zero_cost_documented"};
}

export function eligibleFreeSources(sources=ZERO_COST_SOURCES,{role,assetType}={}) {
  return sources.filter(s=>
    freeSourceStatus(s).usable &&
    (!role||s.role===role) &&
    (!assetType||s.assets?.includes(assetType)));
}

/** Different transport paths for the SAME price origin are not independent. */
export function uniqueSourceLineages(observations) {
  const seen=new Set(),unique=[];
  for(const o of observations||[]) {
    const id=String(o?.lineage||"").trim();
    if(!id||seen.has(id))continue;
    seen.add(id);
    unique.push(o);
  }
  return unique;
}

/** Prevent paid quotas/overages: fail closed instead of silently upgrading. */
export function withinFreeBudget({used=0,charge=1,limit}={}) {
  if(!Number.isInteger(used)||used<0||
     !Number.isInteger(charge)||charge<0||
     !Number.isInteger(limit)||limit<0)
    return {allowed:false,reason:"invalid_quota_contract"};
  return used+charge<=limit?{allowed:true,remaining:limit-used-charge}
    :{allowed:false,reason:"free_quota_exhausted",remaining:Math.max(0,limit-used)};
}

/**
 * Explicit source freshness labels. No fake "live" or hardcoded 20 min failure.
 * This is a presentation policy, not a replacement for market-calendar checks.
 */
export function labelSourceEvidence({kind,valuationDate,tradeAt,fetchedAt}={}) {
  if(kind==="fund-nav")return valuationDate?
    {label:"NAV / source date",verifiedTradeTime:false}:
    {label:"NAV date missing",verifiedTradeTime:false};
  if(kind==="fx")return valuationDate?
    {label:"Daily reference FX",verifiedTradeTime:false}:
    {label:"FX date missing",verifiedTradeTime:false};
  if(kind==="quote")return Number.isFinite(tradeAt)&&tradeAt>0?
    {label:"Dated market trade",verifiedTradeTime:true}:
    {label:"Trade time unverified",verifiedTradeTime:false};
  return {label:"No qualified quote",verifiedTradeTime:false};
}
