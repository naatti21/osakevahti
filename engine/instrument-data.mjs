// Shared financial observation contract; no storage, network, or company registry.
export const INSTRUMENT_DATA_VERSION = 1;
export const QUOTE_MAX_AGE = 72 * 60 * 60 * 1000;
export function listingSymbol(value) {
  const symbol=String(value??'').trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol)?symbol:'';
}
export function observationTime(value,now=Date.now()) {
  return typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=now+300000?value:null;
}
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const unavailable=reason=>({status:'unavailable',reason});
export function validateStockQuote(raw,expected,now=Date.now()) {
  if(!raw)return unavailable('quote-missing');
  if(!listingSymbol(expected.symbol)||raw.symbol!==expected.symbol)return {status:'error',reason:'symbol-mismatch'};
  if(!/^[A-Z]{3}$/.test(raw.currency||'')||(expected.currency&&raw.currency!==expected.currency))
    return {status:'error',reason:'currency-mismatch'};
  if(!positive(raw.price)||!observationTime(raw.observedAt,now)||!raw.source)
    return {status:'error',reason:'invalid-price-or-date'};
  return {status:now-raw.observedAt>QUOTE_MAX_AGE?'stale':'ok',value:{...raw},reason:''};
}
export function chartInstrumentData(symbol,payload,now=Date.now()) {
  const result=payload?.chart?.result?.[0],meta=result?.meta;
  const empty={version:INSTRUMENT_DATA_VERSION,symbol,checkedAt:now,
    quote:unavailable('quote-missing'),momentum:unavailable('history-missing'),dividends:unavailable('dividends-missing')};
  if(!meta)return empty;
  if(!['EQUITY','ETF'].includes(meta.instrumentType))return {...empty,quote:unavailable('unsupported-instrument-type')};
  const quote=validateStockQuote({symbol:meta.symbol,currency:meta.currency,price:meta.regularMarketPrice,
    observedAt:typeof meta.regularMarketTime==='number'?meta.regularMarketTime*1000:null,
    source:'Yahoo Finance chart',exchange:meta.exchangeName||'',delayed:true}, {symbol},now);
  if(!['ok','stale'].includes(quote.status))return {...empty,quote};
  const output={...empty,quote,name:meta.longName||meta.shortName||symbol,currency:meta.currency,instrumentType:meta.instrumentType};
  const timestamps=result.timestamp,closes=result.indicators?.quote?.[0]?.close;
  // Do not bridge gaps or silently coerce null bars into zero.
  const historyValid=Array.isArray(timestamps)&&Array.isArray(closes)&&timestamps.length===closes.length&&
    timestamps.every((t,i)=>observationTime(t*1000,now)&&positive(closes[i])&&(!i||t>timestamps[i-1]));
  if(historyValid&&closes.length>=127){
    const last=closes.length-1,observedAt=timestamps[last]*1000;
    const change=n=>(closes[last]/closes[last-n]-1)*100;
    output.momentum={status:now-observedAt>QUOTE_MAX_AGE?'stale':'ok',observedAt,source:'Yahoo Finance daily close',
      m1:change(21),m3:change(63),m6:change(126),samples:closes.length,
      basis:'21/63/126 trading observations; price return, excluding dividends'};
  }
  const events=result.events?.dividends;
  // An omitted or empty provider event set does not prove a zero dividend.
  if(events&&typeof events==='object'&&!Array.isArray(events)&&Object.keys(events).length&&historyValid){
    const values=Object.values(events);
    const valid=values.every(e=>positive(e.amount)&&observationTime(e.date*1000,now)&&
      (!e.currency||e.currency===meta.currency));
    const yearStart=quote.value.observedAt-365*86400000;
    if(valid&&timestamps[0]*1000<=yearStart){
      const recent=values.filter(e=>e.date*1000>yearStart&&e.date*1000<=quote.value.observedAt);
      if(recent.length){
        const amount=recent.reduce((sum,e)=>sum+e.amount,0);
        output.dividends={status:quote.status,observedAt:quote.value.observedAt,source:'Yahoo Finance dividend events',
          amount,currency:meta.currency,yieldPct:amount/quote.value.price*100,eventCount:recent.length,
          basis:'Reported trailing 365-day events; not a forecast or sustainability assessment'};
      }
    }else if(!valid)output.dividends={status:'error',reason:'invalid-dividend-event'};
  }
  return output;
}
export function instrumentNews(symbol,payload,now=Date.now()) {
  if(!Array.isArray(payload?.news))return {status:'unavailable',reason:'news-missing',items:[]};
  const seen=new Set();
  const items=payload.news.filter(x=>Array.isArray(x.relatedTickers)&&x.relatedTickers.includes(symbol))
    .filter(x=>typeof x.title==='string'&&x.title.trim()&&observationTime(x.providerPublishTime*1000,now))
    .filter(x=>{try{return ['https:','http:'].includes(new URL(x.link).protocol)}catch{return false}})
    .filter(x=>!seen.has(x.link)&&seen.add(x.link))
    .map(x=>({symbol,headline:x.title,source:String(x.publisher||'Yahoo Finance'),url:x.link,
      datetime:x.providerPublishTime})).sort((a,b)=>b.datetime-a.datetime).slice(0,10);
  return {status:items.length&&now-items[0].datetime*1000>7*86400000?'stale':'ok',items};
}
