import test from 'node:test';
import assert from 'node:assert/strict';
import {createFilingsReceipt} from '../scripts/filings-receipts.mjs';
const lei='549300A0JPRWG1KI7U06';
const url='https://filings.xbrl.org/'+lei+'/2025-12-31/ESEF/FI/0/report.json';
const raw=JSON.stringify({facts:{a:{value:'10',dimensions:{concept:'ifrs-full:Revenue',
  entity:'lei:'+lei,unit:'iso4217:EUR',period:'2025-01-01T00:00:00/2026-01-01T00:00:00'}}}});
test('fingerprint refers to raw downloaded source, issuer dimensions and exact URL',()=>{
 const receipt=createFilingsReceipt({sourceUrl:url,body:raw,format:'xbrl-json',issuerId:'LEI:'+lei});
 assert.equal(receipt.sha256.length,64);assert.equal(receipt.entityMatched,true);
 assert.equal(receipt.identityMethod,'xbrl-entity-dimension');
 assert.equal(receipt.issuerId,'LEI:'+lei);
 assert.notEqual(receipt.sha256,createFilingsReceipt({sourceUrl:url,body:raw+' ',format:'xbrl-json',issuerId:'LEI:'+lei}).sha256);
});
test('foreign or conflicting entities are never marked as matching the issuer',()=>{
 const corrupted=JSON.parse(raw);corrupted.facts.b={
  value:'7',dimensions:{concept:'ifrs-full:ProfitLoss',entity:'lei:743700TU2S3DXWGU7H32',
   unit:'iso4217:EUR',period:'2025-01-01T00:00:00/2026-01-01T00:00:00'}};
 const receipt=createFilingsReceipt({sourceUrl:url,body:JSON.stringify(corrupted),
  format:'xbrl-json',issuerId:'LEI:'+lei});
 assert.equal(receipt.entityMatched,false);
});
test('HTML publisher CIK URL + issuer text is a weaker receipt, not audit',()=>{
 const sourceUrl='https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/annual.html';
 const text='<html><h1>Apple Inc.</h1><h2>Form 10-K</h2><p>Financial statements</p></html>';
 const receipt=createFilingsReceipt({sourceUrl,body:text,format:'issuer-html',
  issuerId:'CIK:0000320193',issuerName:'Apple Inc.'});
 assert.equal(receipt.entityMatched,true);
 assert.equal(receipt.identityMethod,'cik-in-publisher-path');
 assert.equal(createFilingsReceipt({sourceUrl,body:text,format:'issuer-html',
   issuerId:'CIK:0000320193',issuerName:'Different issuer'}).entityMatched,false);
});
