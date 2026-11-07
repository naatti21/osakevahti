import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dividendEvidence} from '../engine/dividend-evidence.mjs';
const identity={verified:true,isin:'FI-SYNTHETIC',listing:'SYNTH.HE',shareClass:'B',currency:'EUR'};
const event=(id,date,amount=0.25)=>({...identity,id,amountPerShare:amount,fiscalYear:2025,basis:'post-split-2025',eventType:'ordinary',status:'paid',exDate:date,recordDate:date,paymentDate:date,sourceUrl:'https://issuer.example/decision',verifiedAt:'2026-11-01'});
const run=events=>dividendEvidence({identity,events,comparableBasis:'post-split-2025',now:'2026-11-07'});
test('four and two installments count as one fiscal year, never four dividend years',()=>{
 for(const count of [2,4]) { const r=run(Array.from({length:count},(_,i)=>event(String(i),`2026-0${i+1}-10`)));assert.equal(r.trailingPaid,count*.25);assert.equal(r.fiscalOrdinary.length,1);assert.equal(r.continuity,null);assert.equal(r.quality,'Tietoa liian vähän'); }
});
test('interim aggregates; extra and capital return do not inflate ordinary dividend',()=>{
 const r=run([event('a','2026-01-01'),{...event('b','2026-02-01'),eventType:'interim'},{...event('c','2026-03-01'),eventType:'extra'},{...event('d','2026-04-01'),eventType:'capital-return'}]);assert.equal(r.fiscalOrdinary[0].amount,.5);assert.equal(r.trailingPaid,.75);
});
test('empty, wrong class/currency, duplicate, future paid, unadjusted split fail closed',()=>{
 assert.equal(run([]).status,'unavailable');
 for(const patch of [{currency:'USD'},{shareClass:'A'},{basis:'pre-split'},{paymentDate:'2027-01-01'},{sourceUrl:'javascript:alert(1)'},{amountPerShare:NaN}])assert.equal(run([{...event('a','2026-01-01'),...patch}]).status,'unavailable');
 assert.equal(run([event('a','2026-01-01'),event('a','2026-01-01')]).status,'unavailable');
});
test('proposal excluded, approved future distinct from trailing paid',()=>{
 const r=run([{...event('a','2026-12-01'),status:'approved'},{...event('b','2026-12-02'),status:'proposed'}]);assert.equal(r.trailingPaid,0);assert.equal(r.approvedFuture,.25);
});
