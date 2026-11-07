import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FI_ISSUER_DIVIDENDS,assessFiIssuerDecision} from '../engine/fi-dividend-decisions.mjs';
const cloned=x=>structuredClone(x);
test('issuer decisions: three real companies, exact 2025 totals, sources and 2021-2025 history',()=>{
 const r=FI_ISSUER_DIVIDENDS.map(x=>assessFiIssuerDecision(x));
 assert.equal(r.length,3);
 for(const x of r){assert.equal(x.status,'ok');assert.equal(x.fullFive,true);
  assert.equal(x.history.length,5);assert.match(x.sustainability,/Ei arvioitu/);}
 assert.deepEqual(r.map(x=>x.decision.amount),[.74,.9,.4]);
});
test('Kesko: four installments count for one 2025 fiscal decision; Jan 2027 is future',()=>{
 const x=assessFiIssuerDecision(FI_ISSUER_DIVIDENDS[1]);
 assert.equal(x.history.filter(y=>y.year===2025).length,1);
 assert.deepEqual(x.installments.map(e=>e.amount),[.23,.22,.23,.22]);
 assert.equal(x.installments[3].state,'approved-future');assert.equal(x.pendingFuture,.22);
 assert.equal(x.confirmedPaid,0);
});
test('Metso: confirmed first payment differs from scheduled second; Fortum remains unconfirmed',()=>{
 const x=assessFiIssuerDecision(FI_ISSUER_DIVIDENDS[2]);
 assert.equal(x.installments[0].state,'payment-confirmed');
 assert.equal(x.installments[1].state,'approved-past-unconfirmed');
 assert.equal(x.confirmedPaid,.2);
 assert.equal(assessFiIssuerDecision(FI_ISSUER_DIVIDENDS[0]).installments[0].state,'approved-past-unconfirmed');
});
test('Fortum decline versus 2024 is visible but never labeled sustainability',()=>{
 const x=assessFiIssuerDecision(FI_ISSUER_DIVIDENDS[0]);
 assert.equal(x.changeSince2024,-.66);assert.match(x.sustainability,/Ei arvioitu/);
});
test('reject false URLs, duplicates, year conflicts, wrong class and impossible confirmation',()=>{
 const mutations=[
  r=>{r.listing='KESKOA.HE'},
  r=>{r.decision.amount=.91},
  r=>{r.history[4][1]=.91},
  r=>{r.history[1][0]=2021},
  r=>{r.installments[0][3]='https://www.kesko.fi.evil.test/dividend'},
  r=>{r.installments[1][2]=r.installments[0][2]},
  r=>{r.installments[0][1]='2026-99-20'},
  r=>{r.installments[0][4]='2026-03-01';r.installments[0][5]=r.decision.sourceUrl}
 ];
 for(const mutate of mutations){const r=cloned(FI_ISSUER_DIVIDENDS[1]);mutate(r);
  assert.equal(assessFiIssuerDecision(r).status,'unavailable');}
});
test('missing history is incomplete, not a zero dividend; source never refreshes itself',()=>{
 const r=cloned(FI_ISSUER_DIVIDENDS[2]);r.history.splice(1,1);
 const x=assessFiIssuerDecision(r);assert.equal(x.status,'ok');assert.equal(x.fullFive,false);
 const old=assessFiIssuerDecision(FI_ISSUER_DIVIDENDS[0],'2027-05-20');
 assert.equal(old.status,'ok');assert.equal(old.needsReview,true);
 assert.equal(old.reviewedAt,'2026-11-07');
});
