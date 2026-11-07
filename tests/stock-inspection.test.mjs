import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectStock} from '../engine/stock-inspection.mjs';
import {chartInstrumentData} from '../engine/instrument-data.mjs';
const now=Date.UTC(2026,10,7,10);
const sym='NOVEL.HE';
const sample=()=>{
 const ts=Array.from({length:400},(_,i)=>now/1000-(399-i)*86400);
 const raw={chart:{result:[{meta:{symbol:sym,regularMarketPrice:21,currency:'EUR',instrumentType:'EQUITY',
  regularMarketTime:now/1000,exchangeName:'HEL'},
  timestamp:ts,indicators:{quote:[{close:ts.map((_,i)=>10+i/40)}]},
  events:{dividends:{one:{date:now/1000-86400*30,amount:.2},two:{date:now/1000-86400*200,amount:.3}}}
 }]}};
 return chartInstrumentData(sym,raw,now);
};
test('new, non-hardcoded instrument gets price, source dates, momentum and bounded trailing dividend evidence',()=>{
 const x=inspectStock({symbol:sym,observation:sample(),now});
 assert.equal(x.status,'partial');assert.equal(x.quote.price,21);
 assert.equal(x.quote.currency,'EUR');assert.equal(x.quote.source,'Yahoo Finance chart');
 assert.equal(x.momentum.samples,400);assert.ok(x.momentum.m6>0);
 assert.equal(x.dividends.amount,.5);assert.equal(x.dividends.verifiedFiveFiscalYears,false);
 assert.equal(x.qualityScore,null);assert.equal(x.recommendation,'Tieto ei riitä');
 assert.equal(x.fiveYearDividends.status,'unavailable');assert.equal(x.financials.status,'unavailable');
 assert.ok(x.gaps.some(t=>t.includes('Viiden tilikauden')));
});
test('missing event list is unknown, not a zero dividend or quality score',()=>{
 const o=sample();o.dividends={status:'unavailable',reason:'provider-missing'};
 const x=inspectStock({symbol:sym,observation:o,now});
 assert.equal(x.dividends.status,'unavailable');assert.equal(x.dividends.amount,undefined);
 assert.equal(x.qualityScore,null);
});
test('reject identity mismatch, invalid quote and forged source date without trusting paid assumptions',()=>{
 const o=sample();assert.equal(inspectStock({symbol:'OTHER.HE',observation:o,now}).status,'unavailable');
 assert.equal(inspectStock({symbol:'https://evil.test',observation:o,now}).status,'invalid');
 o.quote.value.price=-1;const bad=inspectStock({symbol:sym,observation:o,now});
 assert.equal(bad.quote.status,'error');assert.equal(bad.dividends.status,'error');
 const p=sample();p.momentum.source='';assert.equal(inspectStock({symbol:sym,observation:p,now}).momentum.status,'error');
 const q=sample();q.quote.value.observedAt=now+3600000;
 assert.equal(inspectStock({symbol:sym,observation:q,now}).quote.status,'error');
});
test('stale quotes and contradictory currencies cannot be shown as fresh',()=>{
 const p=sample();p.quote.value.observedAt=now-5*86400000;p.dividends.currency='USD';
 const x=inspectStock({symbol:sym,observation:p,now});
 assert.equal(x.quote.status,'stale');assert.equal(x.dividends.status,'error');
});
test('ETF must not masquerade as stock; missing type is visibly unverified',()=>{
 const p=sample();p.instrumentType='ETF';
 assert.equal(inspectStock({symbol:sym,observation:p,now}).status,'unsupported');
 const q=sample();delete q.instrumentType;
 const x=inspectStock({symbol:sym,observation:q,now});
 assert.equal(x.status,'partial');assert.equal(x.instrumentType,'unverified');
 assert.ok(x.gaps.includes('Instrumenttilajin riippumaton tunnistus'));
});
