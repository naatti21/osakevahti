/**
 * Unofficial Yahoo public search/chart adapter, EXPERIMENTAL and NOT license-qualified.
 * This implementation never claims proof of ISIN, MIC or mutual-fund NAV date.
 * Provider returned values are quote *candidates*, not verified portfolio prices.
 *
 * This is one provider plugin, not a list of approved instruments. It can fail
 * with 403/429 or change response format. Do not silently invent data.
 */
const SYMBOL=/^[A-Z0-9^][A-Z0-9.^=_-]{0,47}$/i;
const ISIN=/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const CUR=/^[A-Z]{3}$/;
const QTYPE=new Set(["EQUITY","ETF","MUTUALFUND","INDEX"]);
const uppercase=x=>String(x??"").trim().toUpperCase();

function fetchLimit(fetchImpl,ms=8000){
  return async url=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),ms);
    try{
      const r=await fetchImpl(url,{signal:controller.signal,redirect:"error",
        headers:{Accept:"application/json"}});
      if(!r.ok)throw new Error("provider_http_"+r.status);
      const data=await r.json();
      if(!data||typeof data!=="object")throw new Error("invalid_provider_json");
      return data;
    } finally { clearTimeout(timeout); }
  };
}

export function yahooAdapter({fetchImpl=fetch,now=()=>Date.now()}={}) {
  const get=fetchLimit(fetchImpl);
  return {
    id:"yahoo-experimental",
    async search(query) {
      const q=String(query??"").trim();
      if(q.length<2||q.length>80)throw new Error("invalid_search_query");
      const url=new URL("https://query1.finance.yahoo.com/v1/finance/search");
      url.searchParams.set("q",q);
      url.searchParams.set("quotesCount","12");
      url.searchParams.set("newsCount","0");
      const response=await get(url.toString());
      const quotes=Array.isArray(response.quotes)?response.quotes:[];
      return quotes.filter(c=>QTYPE.has(uppercase(c.quoteType))&&
        SYMBOL.test(uppercase(c.symbol))).map(c=>({
        symbol:uppercase(c.symbol),
        name:String(c.longname||c.shortname||"").slice(0,160),
        exchangeCode:String(c.exchange||"").slice(0,32),
        quoteType:uppercase(c.quoteType),
        currency:CUR.test(uppercase(c.currency))?uppercase(c.currency):null,
        isin:null,mic:null,shareClass:null,
        identityStatus:"provider-symbol-only",
        provider:"yahoo-experimental"
      }));
    },
    async quote(instrument) {
      const symbol=uppercase(instrument?.providerSymbol||instrument?.ticker);
      const type=String(instrument?.type||"").toLowerCase();
      if(!SYMBOL.test(symbol))throw new Error("invalid_provider_symbol");
      if(type==="fund")return {status:"unavailable",reason:"dated_fund_nav_provider_required"};
      if(!["stock","etf","index","other"].includes(type))
        return {status:"unavailable",reason:"unsupported_asset_type"};
      const url=new URL("https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(symbol));
      url.searchParams.set("range","1d");
      url.searchParams.set("interval","1m");
      url.searchParams.set("includePrePost","false");
      const data=await get(url.toString());
      const result=data?.chart?.result?.[0];
      if(!result||data?.chart?.error)throw new Error("provider_no_chart");
      const meta=result.meta||{};
      const returned=uppercase(meta.symbol);
      if(returned!==symbol)return {status:"rejected",reason:"symbol_mismatch"};
      const currency=uppercase(meta.currency);
      if(!CUR.test(currency))return {status:"unavailable",reason:"currency_missing"};
      const expected=uppercase(instrument.currency);
      if(!CUR.test(expected)||expected!==currency)
        return {status:"rejected",reason:"currency_conflict"};
      const timestamps=Array.isArray(result.timestamp)?result.timestamp:[];
      const closes=result?.indicators?.quote?.[0]?.close||[];
      let value=null,ts=null;
      for(let k=Math.min(timestamps.length,closes.length)-1;k>=0;k--){
        if(Number.isFinite(closes[k])&&closes[k]>0 &&
           Number.isFinite(timestamps[k])&&timestamps[k]>946684800){
          value=Number(closes[k]);ts=Number(timestamps[k])*1000;break;
        }
      }
      if(value===null&&Number.isFinite(meta.regularMarketPrice)&&meta.regularMarketPrice>0){
        value=Number(meta.regularMarketPrice);
        const t=Number(meta.regularMarketTime);
        ts=Number.isFinite(t)&&t>946684800?t*1000:null;
      }
      if(value===null)return {status:"unavailable",reason:"price_missing"};
      const fetched=now();
      if(ts!==null&&(ts>fetched+300000||ts<946684800000))
        return {status:"rejected",reason:"trade_timestamp_invalid"};
      return {
        status:"candidate",
        price:value,currency,provider:"yahoo-experimental",
        fetched_at:fetched,quote_at:ts,nav_date:null,
        instrument:{
          providerSymbol:returned,currency,
          isin:null,mic:null,shareClass:null,
          identityStatus:"provider-symbol-only"
        },
        delayed:true,
        qualityNote:"Provider response does not verify ISIN, MIC, exchange or listing share class."
      };
    }
  };
}
