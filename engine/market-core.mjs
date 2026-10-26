/**
 * Osakevahti universal market core, v1.
 * Pure functions: no HTTP, localStorage, user quantities, prices or account metadata.
 * The portfolio determines its requests; providers supply the data.
 * An unsupported instrument remains unsupported, never silently matched to another.
 */

const clean = value => String(value ?? "").trim();
const upper = value => clean(value).toUpperCase();
const positive = value => value !== null && value !== undefined && value !== "" &&
  Number.isFinite(Number(value)) && Number(value) > 0;
const textId = value => upper(value).replace(/\s+/g, "");
const TYPES = new Set(["stock","etf","fund","index","other"]);
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const SYMBOL = /^[A-Z0-9^.=:_/-]{1,48}$/;
const CURRENCY = /^[A-Z]{3}$/;
const MIC = /^[A-Z0-9]{4}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PARTIAL_DAY = /^(\d{1,2})\.(\d{1,2})\.$/;

function validDay(text) {
  if (!DAY.test(text)) return false;
  const [y,m,d]=text.split("-").map(Number);
  const actual = new Date(Date.UTC(y,m-1,d,12));
  return y >= 2000 && actual.getUTCFullYear()===y &&
    actual.getUTCMonth()===m-1 && actual.getUTCDate()===d;
}

/**
 * Retain the existing holding's identity. Do not create fake tickers/ISINs.
 * A fund can have no listing symbol but can still be searched by name/ISIN.
 */
export function instrumentFromHolding(holding) {
  const h=holding||{}, i=h.instrument||{};
  const type=upper(h.assetType||i.assetType||"stock").toLowerCase();
  const isin=textId(i.isin||h.isin);
  const ticker=textId(i.listingTicker||h.symbol);
  const providerSymbol=textId(i.providerSymbol||h.providerSymbol);
  const mic=textId(i.mic||h.mic);
  const currency=upper(h.currency||i.currency);
  const shareClass=upper(i.shareClass||h.shareClass);
  const name=clean(i.companyName||h.name);
  return {type:TYPES.has(type)?type:"other",isin,ticker,providerSymbol,
    mic,currency,shareClass,name};
}

export function instrumentProblems(i) {
  const reasons=[];
  if (!CURRENCY.test(i.currency)) reasons.push("currency_missing_or_invalid");
  if (i.isin && !ISIN.test(i.isin)) reasons.push("isin_invalid");
  if (i.ticker && !SYMBOL.test(i.ticker)) reasons.push("ticker_invalid");
  if (i.providerSymbol && !SYMBOL.test(i.providerSymbol)) reasons.push("provider_symbol_invalid");
  if (i.mic && !MIC.test(i.mic)) reasons.push("mic_invalid");
  if (!i.isin && !i.ticker && !i.providerSymbol && !i.name) reasons.push("identity_missing");
  return reasons;
}

/**
 * Identity is separate from a position or an API data key.
 * Distinct exchanges, currencies and share classes must not be merged.
 */
export function instrumentIdentityKey(i) {
  if (instrumentProblems(i).length) return null;
  const anchor=i.isin ? "isin:"+i.isin
    : i.mic && (i.providerSymbol||i.ticker) ? "listing:"+i.mic+":"+(i.providerSymbol||i.ticker)
    : i.providerSymbol ? "provider:"+i.providerSymbol
    : i.ticker ? "ticker:"+i.ticker
    : "unresolved:"+i.type+":"+i.name.toLocaleLowerCase("en");
  return [anchor,i.mic||"?",i.currency,i.shareClass||"?",i.type].join("|");
}

/**
 * Only identity information crosses the network. Never send holdings, account
 * names, cost basis, amounts or imported document contents.
 */
export function buildMarketRequests(holdings) {
  const requests=[], rejected=[], seen=new Set();
  for (const h of holdings||[]) {
    const i=instrumentFromHolding(h);
    const reasons=instrumentProblems(i);
    if(reasons.length) {
      rejected.push({localId:clean(h?.id),reasons});
      continue;
    }
    const key=instrumentIdentityKey(i);
    if(!seen.has(key)) {
      seen.add(key);
      requests.push({key,instrument:i});
    }
  }
  return {requests,rejected};
}

/**
 * Explicit provider conflicts are fatal. A missing ISIN is not proof of a
 * match. A name-only result must require manual confirmation at onboarding.
 */
export function candidateDecision(request,candidate) {
  const i=request?.instrument||request||{};
  const c=candidate||{};
  const candidateIsin=textId(c.isin||c.ISIN);
  const candidateMic=textId(c.mic||c.MIC);
  const candidateCurrency=upper(c.currency||c.Currency);
  const candidateClass=upper(c.shareClass||c.share_class);
  const candidateSymbol=textId(c.providerSymbol||c.symbol||c.Code||c.ticker);
  const desiredSymbol=i.providerSymbol||i.ticker;
  if(i.isin && candidateIsin && i.isin!==candidateIsin)
    return {status:"reject",reason:"isin_conflict"};
  if(i.currency && candidateCurrency && i.currency!==candidateCurrency)
    return {status:"reject",reason:"currency_conflict"};
  if(i.shareClass && candidateClass && i.shareClass!==candidateClass)
    return {status:"reject",reason:"share_class_conflict"};
  if(i.mic && candidateMic && i.mic!==candidateMic)
    return {status:"reject",reason:"listing_conflict"};
  // ISIN alone identifies the security, but never assume missing currency,
  // venue or explicit share-class evidence on an automatic source binding.
  if(i.isin && candidateIsin===i.isin && candidateCurrency===i.currency &&
    (!i.mic||candidateMic===i.mic) &&
    (!i.shareClass||candidateClass===i.shareClass))
    return {status:"match",reason:"exact_isin_and_required_metadata"};
  if(i.type!=="fund" && desiredSymbol && candidateSymbol===desiredSymbol &&
    i.mic && candidateMic===i.mic && i.currency && candidateCurrency===i.currency)
    return {status:"match",reason:"exact_listing_and_currency"};
  return {status:"confirm",reason:"insufficient_verified_identity"};
}

/** Return a real date, or an explicitly inferred year, never a verified fake. */
export function navDayInfo(raw, now=Date.now(), timeZone="Europe/Helsinki") {
  const original=clean(raw);
  if(validDay(original)) {
    const dt=Date.parse(original+"T12:00:00Z");
    if(dt>now+86400000)return null;
    return {date:original,verified:true,yearInferred:false,raw:original};
  }
  const m=original.match(PARTIAL_DAY);
  if(!m) return null;
  const dateParts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date(now));
  const part=name=>+dateParts.find(x=>x.type===name)?.value;
  const yy=part("year"), mm=part("month"), dd=part("day");
  const today=Date.UTC(yy,mm-1,dd,12);
  for(const year of [yy,yy-1]) {
    const date=[year,String(+m[2]).padStart(2,"0"),String(+m[1]).padStart(2,"0")].join("-");
    if(!validDay(date)) continue;
    if(Date.parse(date+"T12:00:00Z")<=today)
      return {date,verified:false,yearInferred:true,raw:original};
  }
  return null;
}

function validTime(value,now) {
  const t=Number(value);
  return value!==null && value!==undefined && value!=="" &&
    Number.isFinite(t) && t>=946684800000 && t<=now+300000;
}

/**
 * Quote contract:
 * price, currency, provider, fetched_at (request time), quote_at (actual market
 * trade), nav_date (fund valuation day), and provider instrument identity.
 * A fetch time is NEVER substituted for the actual quote/valuation time.
 */
export function normalizeObservation(request,raw,now=Date.now()) {
  const i=request?.instrument||request||{};
  const match=candidateDecision(i,raw?.instrument||raw);
  if(match.status==="reject")
    return {status:"rejected",reason:match.reason};
  if(!positive(raw?.price))
    return {status:"unavailable",reason:"price_missing"};
  if(!CURRENCY.test(upper(raw?.currency)) || i.currency!==upper(raw.currency))
    return {status:"rejected",reason:"currency_not_verified"};
  const type=i.type||"other";
  const fetchedAt=validTime(raw?.fetched_at,now)?Number(raw.fetched_at):null;
  const quoteAt=validTime(raw?.quote_at,now)?Number(raw.quote_at):null;
  const nav=type==="fund"?navDayInfo(raw?.nav_date,now):null;
  const provider=clean(raw?.provider)||"unknown";
  let quality;
  if(type==="fund") quality=nav ? nav.verified?"dated_nav":"inferred_year_nav":"undated_nav";
  else quality=quoteAt?"dated_market_trade":"undated_market_trade";
  return {
    status:"usable",
    price:Number(raw.price),currency:i.currency,
    provider,providerSymbol:textId(raw?.providerSymbol||raw?.symbol),
    fetchedAt,quoteAt:type==="fund"?null:quoteAt,
    navDate:nav?.date||null,rawNavDate:nav?.raw||clean(raw?.nav_date),
    navYearInferred:!!nav?.yearInferred,quality,
    identityConfidence:match.status==="match"?"matched":"needs_confirmation"
  };
}

/**
 * Freshness is based on a trustworthy market-session descriptor supplied by a
 * calendar/provider adapter, NOT device weekday or a universal 20 min timer.
 * Expected provider delay and opening grace are configurable provider metadata.
 */
export function quoteFreshness(observation,session,now=Date.now()) {
  if(!observation || observation.status!=="usable")
    return {status:"unavailable",reason:"no_usable_observation"};
  if(observation.navDate) {
    const ms=Date.parse(observation.navDate+"T12:00:00Z");
    const days=Math.max(0,Math.round((now-ms)/86400000));
    return {status:"nav",ageCalendarDays:days,yearInferred:observation.navYearInferred};
  }
  if(observation.quality==="undated_nav")
    return {status:"unverified",reason:"nav_valuation_date_missing"};
  if(!observation.quoteAt)
    return {status:"unverified",reason:"market_trade_time_missing"};
  if(!session || !["open","closed","holiday","unknown"].includes(session.status))
    return {status:"unverified",reason:"exchange_session_unavailable"};
  if(session.status==="closed"||session.status==="holiday")
    return {status:"last_session",reason:"market_not_open"};
  if(session.status==="unknown")
    return {status:"unverified",reason:"exchange_session_unknown"};
  const delay=Math.max(0,Number(session.providerDelayMinutes)||0);
  const grace=Math.max(0,Number(session.openingGraceMinutes)||0);
  if(!validTime(session.openedAt,now))
    return {status:"unverified",reason:"market_open_time_missing"};
  const openedAt=Number(session.openedAt);
  const permittedAgeMs=(delay+grace)*60000;
  if(now-openedAt<=permittedAgeMs && observation.quoteAt<openedAt)
    return {status:"opening_grace",reason:"waiting_for_first_session_quote"};
  const latestExpected=Math.max(openedAt,now-permittedAgeMs);
  if(observation.quoteAt<latestExpected)
    return {status:"stale",reason:"trade_time_beyond_source_delay"};
  return {status:"current",reason:"trade_time_within_source_delay"};
}
