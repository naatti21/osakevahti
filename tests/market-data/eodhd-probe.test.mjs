import {test} from 'node:test';
import assert from 'node:assert/strict';
import {qualifyEod,qualifyDividends} from '../../scripts/market-data/eodhd-probe.mjs';

const NOW='2026-10-20';
test('dated prices are usable but not verified as the correct instrument',()=>{
  const r=qualifyEod([
    {date:'2026-10-16',close:12.4,adjusted_close:12.3,volume:150},
    {date:'2026-10-19',close:12.6,volume:0}
  ],NOW);
  assert.equal(r.ok,true);
  assert.equal(r.last,'2026-10-19');
  assert.equal(r.instrumentIdentityVerified,false);
});
test('rejects duplicated, missing, impossible or future market days',()=>{
  for (const date of ['2026-02-30','2026-10-21','19.10.2026','']) {
    const r=qualifyEod([{date,close:12.3}],NOW);
    assert.equal(r.ok,false,date);
  }
  assert.equal(qualifyEod([
    {date:'2026-10-15',close:10},{date:'2026-10-15',close:11}
  ],NOW).reason,'duplicate-or-invalid-price-date');
});
test('rejects fabricated prices and invalid market volume',()=>{
  for(const close of [0,-1,null,'NaN','']){
    assert.equal(qualifyEod([{date:'2026-10-16',close}],NOW).reason,'invalid-close');
  }
  assert.equal(qualifyEod([{date:'2026-10-16',close:12,volume:-1}],NOW).reason,'invalid-volume');
  assert.equal(qualifyEod([],NOW).reason,'history-missing');
});
test('dividend events require real ex-date and positive paid amount',()=>{
  const v=qualifyDividends([{date:'2025-10-14',value:0.42},{date:'2026-03-18',value:0.43}],NOW);
  assert.equal(v.ok,true);
  assert.equal(v.events,2);
  assert.equal(v.coverageVerified,false);
  assert.equal(v.dividendPayerStatus,'events-found');
  assert.equal(qualifyDividends([{date:'2026-10-21',value:0.2}],NOW).ok,false);
  assert.equal(qualifyDividends([{date:'2026-10-19',value:0}],NOW).reason,'invalid-dividend-amount');
  assert.equal(qualifyDividends([{date:'2026-10-19',value:null}],NOW).ok,false);
  assert.equal(qualifyDividends([{date:'2026-10-19',value:0.2},{date:'2026-10-19',value:0.2}],NOW).reason,'repeated-dividend-record');
});
test('empty valid dividend result does not mean issuer never paid dividends',()=>{
  assert.equal(qualifyDividends([],NOW).dividendPayerStatus,'unknown');
  assert.equal(qualifyDividends(null,NOW).reason,'dividend-history-unavailable');
});
