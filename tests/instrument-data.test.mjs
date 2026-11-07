import test from 'node:test';
import assert from 'node:assert/strict';
import {chartInstrumentData,validateStockQuote,instrumentNews,listingSymbol} from '../engine/instrument-data.mjs';
const now=Date.UTC(2026,10,7,12);
const symbol='SYNTH-X.T';
function chart(){
 const timestamp=Array.from({length:400},(_,i)=>(now-(399-i)*86400000)/1000);
 return {chart:{result:[{meta:{symbol,currency:'JPY',instrumentType:'EQUITY',regularMarketPrice:140,regularMarketTime:now/1000},
 timestamp,indicators:{quote:[{close:timestamp.map((_,i)=>100+i/10)}]},
 events:{dividends:{a:{date:now/1000-86400*30,amount:2},b:{date:now/1000-86400*180,amount:3}}}}]}};
}
test('previously unknown listing gets dated price and available reported analyses',()=>{
 const value=chartInstrumentData(symbol,chart(),now);
 assert.equal(value.quote.status,'ok');assert.equal(value.quote.value.currency,'JPY');
 assert.equal(value.momentum.status,'ok');assert.equal(value.dividends.amount,5);
 assert.equal(value.dividends.yieldPct,5/140*100);
 assert.ok(Math.abs(value.momentum.m1-(139.9/137.8-1)*100)<1e-9);
});
test('exact symbol and currency required; timestamp is never request time',()=>{
 const q=chartInstrumentData(symbol,chart(),now).quote.value;
 for(const change of [{symbol:'OTHER'},{currency:'EUR'},{price:0},{price:null},{price:NaN},{price:Infinity},{observedAt:null},{observedAt:now+3600000}])
  assert.equal(validateStockQuote({...q,...change},{symbol,currency:'JPY'},now).status,'error');
 assert.equal(validateStockQuote({...q,observedAt:now-4*86400000},{symbol,currency:'JPY'},now).status,'stale');
});
test('missing, incomplete and invalid dividend/history data do not become zero analytics',()=>{
 for(const mutate of [r=>delete r.events,r=>r.events={dividends:{}},r=>r.timestamp.splice(0,350)]){
  const fixture=chart();mutate(fixture.chart.result[0]);
  assert.equal(chartInstrumentData(symbol,fixture,now).dividends.status,'unavailable');
 }
 for(const change of [{amount:-2},{amount:null},{currency:'USD'},{date:now/1000+86400}]){
  const fixture=chart();Object.assign(fixture.chart.result[0].events.dividends.a,change);
  assert.equal(chartInstrumentData(symbol,fixture,now).dividends.status,'error');
 }
 const fixture=chart();fixture.chart.result[0].indicators.quote[0].close[50]=null;
 assert.equal(chartInstrumentData(symbol,fixture,now).momentum.status,'unavailable');
});
test('news requires explicit current listing relation, safe URL and real date',()=>{
 const item={relatedTickers:[symbol],title:'Synthetic results',publisher:'Synthetic',link:'https://example.test/story',providerPublishTime:now/1000};
 const result=instrumentNews(symbol,{news:[item,item,{...item,relatedTickers:['OTHER'],link:'https://example.test/other'},
 {...item,link:'javascript:alert(1)'},{...item,providerPublishTime:0}]},now);
 assert.equal(result.status,'ok');assert.equal(result.items.length,1);
 assert.equal(instrumentNews(symbol,{news:[]},now).status,'ok');
 assert.equal(instrumentNews(symbol,{},now).status,'unavailable');
 assert.equal(listingSymbol('https://attacker.test'),'');
});
