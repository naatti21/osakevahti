import {listingSymbol,validateStockQuote,observationTime} from './instrument-data.mjs';

// Ephemeral request cache only. Nothing here writes portfolio/localStorage.
export function createInstrumentClient({origin,fetchImpl=globalThis.fetch,now=Date.now,timeoutMs=10000}={}) {
  const base=new URL(origin);if(base.protocol!=='https:')throw new Error('HTTPS Worker required');
  const cache=new Map(),inflight=new Map(),queue=[];let active=0;
  const run=task=>new Promise((resolve,reject)=>{queue.push({task,resolve,reject});pump();});
  function pump(){while(active<3&&queue.length){const item=queue.shift();active++;
    Promise.resolve().then(item.task).then(item.resolve,item.reject).finally(()=>{active--;pump();});}}
  async function fetchSymbol(symbol){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const url=new URL('/instrument',base);url.searchParams.set('symbol',symbol);
      const response=await fetchImpl(url.href,{signal:controller.signal,credentials:'omit',redirect:'error',cache:'no-store'});
      if(!response.ok)throw new Error(`Worker HTTP ${response.status}`);
      const data=await response.json();
      if(data?.version!==1||data.symbol!==symbol)throw new Error('Instrumenttikohtainen palvelu ei ole käytettävissä');
      return data;
    }catch(error){return {version:1,symbol,quote:{status:'error',reason:String(error?.message||error)},
      momentum:{status:'unavailable'},dividends:{status:'unavailable'},news:{status:'error',items:[]}};}
    finally{clearTimeout(timer);}
  }
  return {async lookup(raw,{currency='',force=false}={}){
    const symbol=listingSymbol(raw);if(!symbol)throw new Error('Invalid listing');
    const cached=cache.get(symbol);
    let data;
    if(!force&&cached&&now()-cached.at<300000)data=cached.data;
    else{
      if(!inflight.has(symbol)){
        const task=run(()=>fetchSymbol(symbol)).then(data=>{cache.set(symbol,{at:now(),data});return data;})
          .finally(()=>inflight.delete(symbol));inflight.set(symbol,task);
      }
      data=await inflight.get(symbol);
    }
    const quote=data.quote?.value?validateStockQuote(data.quote.value,{symbol,currency},now()):data.quote;
    const valid=['ok','stale'].includes(quote?.status);
    const metric=(value,keys)=>valid&&['ok','stale'].includes(value?.status)&&observationTime(value.observedAt,now())&&
      keys.every(key=>typeof value[key]==='number'&&Number.isFinite(value[key]))
      ?{...value,status:now()-value.observedAt>72*3600000?'stale':value.status}
      :{status:value?.status==='error'?'error':'unavailable',reason:value?.reason||'incomplete-data'};
    const dividends=metric(data.dividends,['amount','yieldPct','eventCount']);
    if(['ok','stale'].includes(dividends.status)&&(dividends.currency!==quote?.value?.currency||dividends.amount<0||dividends.yieldPct<0||!Number.isInteger(dividends.eventCount)||dividends.eventCount<1))Object.assign(dividends,{status:'error',reason:'currency-mismatch'});
    const news=data.news;
    const items=Array.isArray(news?.items)?news.items.filter(item=>{
      if(item.symbol!==symbol||!observationTime(item.datetime*1000,now())||!item.headline)return false;
      try{return ['https:','http:'].includes(new URL(item.url).protocol)}catch{return false}
    }):[];
    return {symbol,quote:quote||{status:'unavailable'},momentum:metric(data.momentum,['m1','m3','m6']),dividends,
      news:{status:news?.status==='ok'&&items.length&&now()-Math.max(...items.map(x=>x.datetime))*1000>7*86400000?'stale':['ok','stale','error','unavailable'].includes(news?.status)?news.status:'unavailable',items},checkedAt:data.checkedAt};
  }};
}
