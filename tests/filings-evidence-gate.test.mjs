import test from 'node:test';
import assert from 'node:assert/strict';
import {auditFilingEvidence} from '../engine/filings-evidence-gate.mjs';
const now='2026-11-07T16:00:00.000Z',lei='549300A0JPRWG1KI7U06';
const href='https://filings.xbrl.org/'+lei+'/2025-12-31/ESEF/FI/0/doc.json';
const htmlUrl='https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/2025-filing.html';
const hash='f'.repeat(64);
const xbrlReceipt=()=>({sourceUrl:href,sha256:hash,fetchedAt:now,
 issuerId:'LEI:'+lei,format:'xbrl-json',identityMethod:'xbrl-entity-dimension',entityMatched:true});
const htmlReceipt=()=>({sourceUrl:htmlUrl,sha256:hash,fetchedAt:now,
 issuerId:'CIK:0000320193',format:'issuer-html',identityMethod:'cik-in-publisher-path',entityMatched:true});
const structured=(year,metric)=>({
 status:'ok',value:metric==='netIncome'?-500:100,
 unit:'EUR',concept:'ifrs-full:'+(metric==='revenue'?'Revenue':'ProfitLoss'),
 period:metric==='interestBearingDebt'?year+'-12-31':year+'-01-01/'+year+'-12-31',
 sourceUrl:href
});
const matrix=()=>({years:{2025:{
 revenue:structured(2025,'revenue'),netIncome:structured(2025,'netIncome'),
 operatingCashflow:{status:'missing',reason:'source-absent'},
 interestBearingDebt:{...structured(2025,'interestBearingDebt'),
 concept:'ifrs-full:CurrentBorrowings + ifrs-full:LongtermBorrowings'}
}}});
const audit=(m=matrix(),receipts=[xbrlReceipt()])=>auditFilingEvidence(m,{identity:'LEI:'+lei,
 currency:'EUR',receipts,years:[2025],asOf:now});
test('ESEF: source-scope, matched-entity, currency and fiscal period pass structural checks only',()=>{
 const out=audit();assert.deepEqual(out.counts,
  {total:4,sourceConsistent:3,needsReview:0,missing:1,blocked:0,independentlyVerified:0});
 assert.equal(out.cells[2025].revenue.status,'source-consistent');
 assert.equal(out.cells[2025].netIncome.value,-500);
 assert.equal(out.investmentUse,'NO_GO');
});
test('source fingerprint missing, forged hostname, wrong LEI or receipt URL do not count',()=>{
 for(const mutate of [
  r=>r.sha256='',
  r=>r.sourceUrl='https://filings.xbrl.org.attacker.test/a.json',
  r=>r.sourceUrl=r.sourceUrl.replace(lei,'743700TU2S3DXWGU7H32'),
  r=>r.issuerId='LEI:743700TU2S3DXWGU7H32',
  r=>r.entityMatched=false,
  r=>r.fetchedAt='2030-01-01T00:00:00.000Z'
 ]){
  const r=xbrlReceipt();mutate(r);const a=audit(matrix(),[r]);
  assert.equal(a.counts.sourceConsistent,0);
  assert.equal(a.counts.blocked,3);
 }
});
test('annual period and instant must belong to the requested year; no stale previous FY debt',()=>{
 const bad=matrix();bad.years[2025].interestBearingDebt.period='2024-12-31';
 const out=audit(bad);
 assert.equal(out.cells[2025].interestBearingDebt.status,'blocked');
 assert.equal(out.cells[2025].interestBearingDebt.reason,'fiscal-period-not-proven');
});
test('missing, conflicts, nonfinite amounts, wrong currency and duplicate receipts fail closed',()=>{
 const m=matrix();
 m.years[2025].revenue.value=NaN;
 m.years[2025].netIncome.unit='USD';
 m.years[2025].interestBearingDebt.status='conflict';
 const result=audit(m);
 assert.equal(result.counts.blocked,3);
 assert.equal(result.counts.missing,1);
 const dup=audit(matrix(),[xbrlReceipt(),xbrlReceipt()]);
 assert.equal(dup.counts.blocked,3);
});
test('HTML: explicit source fingerprint is still not a signed accounting audit or verified 1e6 scale',()=>{
 const m={quality:'issuer-html-not-sec',years:{2025:{
  revenue:{status:'ok',value:416161000000,unit:'USD',
   concept:'HTML:total net sales',fiscalYear:2025,sourceUrl:htmlUrl,
   sourceTier:'issuer-html-not-xbrl'},
  netIncome:{status:'missing',reason:'not-found'},
  operatingCashflow:{status:'missing',reason:'not-found'},
  interestBearingDebt:{status:'missing',reason:'not-found'}
 }}};
 const out=auditFilingEvidence(m,{identity:'CIK:0000320193',currency:'USD',
  years:[2025],asOf:now,receipts:[htmlReceipt()]});
 assert.equal(out.cells[2025].revenue.status,'needs-review');
 assert.equal(out.counts.needsReview,1);
 assert.equal(out.counts.sourceConsistent,0);
 assert.equal(out.counts.independentlyVerified,0);
 assert.equal(out.investmentUse,'NO_GO');
});
test('HTML: exact fiscal year mandatory; source URL must not silently change CIK',()=>{
 const m={quality:'issuer-html-not-sec',years:{2025:{revenue:{
  status:'ok',value:1,unit:'USD',concept:'HTML:total net sales',
  fiscalYear:2024,sourceUrl:htmlUrl,sourceTier:'issuer-html-not-xbrl'}}}};
 const opts={identity:'CIK:0000320193',currency:'USD',
  years:[2025],asOf:now,receipts:[htmlReceipt()]};
 let out=auditFilingEvidence(m,opts);
 assert.equal(out.cells[2025].revenue.reason,'fiscal-period-not-proven');
 m.years[2025].revenue.fiscalYear=2025;
 opts.receipts[0].sourceUrl=htmlUrl.replace('0000320193','0000999999');
 out=auditFilingEvidence(m,opts);
 assert.equal(out.counts.blocked,1);
});
