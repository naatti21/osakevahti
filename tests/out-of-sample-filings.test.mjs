import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEsefXbrlJson,combineEsefYears,coverage} from '../engine/official-filings-pilot.mjs';
import {normalizeIssuerIrTables,combineIrReports} from '../engine/issuer-ir-tables-pilot.mjs';
const lei='743700TU2S3DXWGU7H32';
test('existing generic IFRS fields can process previously unseen entity with no new tag aliases',()=>{
 const sourceUrl='https://filings.xbrl.org/'+lei+'/2025-12-31/ESEF/FI/1/synthetic.json';
 const raw={facts:{row:{value:'200',dimensions:{entity:'lei:'+lei,
  concept:'ifrs-full:RevenueFromContractsWithCustomers',unit:'iso4217:EUR',
  period:'2025-01-01T00:00:00/2026-01-01T00:00:00'}}}};
 const r=normalizeEsefXbrlJson(raw,{lei,year:2025,sourceUrl});
 assert.equal(r.fields.revenue.status,'ok');
 assert.equal(r.fields.revenue.period,'2025-01-01/2025-12-31');
 assert.equal(r.fields.interestBearingDebt.status,'missing');
 assert.equal(coverage(combineEsefYears({2025:r},{lei})).ok,1);
});
test('different HTML 10-K layout is not silently mapped to Microsoft-specific labels',()=>{
 const sourceUrl='https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/synthetic.html';
 const html='<table><tr><th>September 27, 2025</th><th>2024</th><th>2023</th></tr>'+
  '<tr><td>Total net sales</td><td>$</td><td>416,161</td><td>391,035</td><td>383,285</td></tr></table>';
 const out=normalizeIssuerIrTables(html,{sourceUrl,reportYear:2025});
 assert.equal(out.years[2025].revenue.status,'missing');
 assert.equal(out.years[2025].interestBearingDebt.status,'missing');
 assert.equal(coverage(combineIrReports([out])).ok,0);
});
