import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_YEARS,normalizeSecCompanyFacts,normalizeEsefXbrlJson,combineEsefYears,coverage} from '../engine/official-filings-pilot.mjs';
const lei='549300A0JPRWG1KI7U06';
const url='https://filings.xbrl.org/filing/synthetic';
function secDoc(){
 const facts={};
 const tags=['RevenueFromContractWithCustomerExcludingAssessedTax','NetIncomeLoss','NetCashProvidedByUsedInOperatingActivities',
  'LongTermDebtCurrent','LongTermDebtNoncurrent'];
 for(const [ti,tag] of tags.entries()){
  const vals=PILOT_YEARS.map(year=>{
   const end=year+'-06-30',data={end,val:(ti+1)*1000000+year,form:'10-K',filed:(year+1)+'-07-30',accn:'00001'};
   return ti<3?{...data,start:(year-1)+'-07-01'}:data;
  });
  facts[tag]={units:{USD:vals}};
 }
 return {cik:789019,entityName:'Synthetic',facts:{'us-gaap':facts}};
}
test('SEC generic: five years x four metrics from annual 10-K facts, with accession and units',()=>{
 const d=normalizeSecCompanyFacts(secDoc(),{cik:789019});
 assert.deepEqual(coverage(d),{ok:20,total:20,complete:true,
  byMetric:{revenue:5,netIncome:5,operatingCashflow:5,interestBearingDebt:5}});
 assert.equal(d.years[2025].revenue.value,1000000+2025);
 assert.equal(d.years[2025].interestBearingDebt.value,4000000+2025+5000000+2025);
 assert.equal(d.years[2025].revenue.sourceUrl,'https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json');
});
test('SEC: interim 10-Q, one-year comparator mismatch and CIK mismatch never create values',()=>{
 const doc=secDoc();
 doc.facts['us-gaap'].NetIncomeLoss.units.USD=[{end:'2025-06-30',start:'2025-04-01',form:'10-Q',val:1,filed:'2025-07-10'}];
 const x=normalizeSecCompanyFacts(doc,{cik:789019});
 assert.equal(x.years[2025].netIncome.status,'missing');
 assert.equal(normalizeSecCompanyFacts(doc,{cik:1234}).years[2025].revenue.status,'conflict');
});
function esefDoc(year){
 const tags=['Revenue','ProfitLoss','CashFlowsFromUsedInOperatingActivities','CurrentBorrowings','NoncurrentBorrowings'];
 const facts={};
 for(const [idx,tag] of tags.entries()){
  const period=idx<3?(year+'-01-01T00:00:00/'+(year+1)+'-01-01T00:00:00'):year+'-12-31T00:00:00';
  facts['f'+idx]={value:String((idx+1)*100+year),dimensions:{concept:'ifrs-full:'+tag,
   entity:'lei:'+lei,period,unit:'iso4217:EUR'}};
 }
 return {facts};
}
test('ESEF: five reports normalize without any Nokia-specific field rules',()=>{
 const docs={};
 for(const year of PILOT_YEARS)docs[year]=normalizeEsefXbrlJson(esefDoc(year),{lei,year,sourceUrl:url});
 const combined=combineEsefYears(docs,{lei});
 assert.equal(coverage(combined).ok,20);
 assert.equal(combined.years[2025].revenue.value,2125);
 assert.equal(combined.years[2025].interestBearingDebt.value,2425+2525);
});
test('ESEF: dimensioned segment facts, wrong unit and missing year never masquerade as consolidated facts',()=>{
 const d=esefDoc(2025);d.facts.f0.dimensions.segment='nokia:Other';
 d.facts.f1.dimensions.unit='iso4217:USD';
 const row=normalizeEsefXbrlJson(d,{lei,year:2025,sourceUrl:url});
 assert.equal(row.fields.revenue.status,'missing');assert.equal(row.fields.netIncome.status,'missing');
 const merged=combineEsefYears({2025:row},{lei});
 assert.equal(merged.years[2024].revenue.status,'missing');
});
test('no cross-taxonomy debt guess: missing current debt gives missing, not total liabilities',()=>{
 const d=esefDoc(2025);delete d.facts.f3;
 const row=normalizeEsefXbrlJson(d,{lei,year:2025,sourceUrl:url});
 assert.equal(row.fields.interestBearingDebt.status,'missing');
});

test('ESEF annual duration end is EXCLUSIVE; last year must not be shifted to next FY',()=>{
 const wrong=esefDoc(2024),right=esefDoc(2025);
 const a=normalizeEsefXbrlJson(wrong,{lei,year:2025,sourceUrl:url});
 const b=normalizeEsefXbrlJson(right,{lei,year:2025,sourceUrl:url});
 assert.equal(a.fields.revenue.status,'missing');
 assert.equal(b.fields.revenue.status,'ok');
 assert.equal(b.fields.revenue.period,'2025-01-01/2025-12-31');
});

test('generic ShorttermBorrowings plus LongtermBorrowings without issuer-specific taxonomy aliases',()=>{
 const d=esefDoc(2025);
 d.facts.f3.dimensions.concept='ifrs-full:ShorttermBorrowings';
 d.facts.f4.dimensions.concept='ifrs-full:LongtermBorrowings';
 const row=normalizeEsefXbrlJson(d,{lei,year:2025,sourceUrl:url});
 assert.equal(row.fields.interestBearingDebt.status,'ok');
 assert.equal(row.fields.interestBearingDebt.value,2425+2525);
 assert.match(row.fields.interestBearingDebt.concept,/ShorttermBorrowings.*LongtermBorrowings/);
});
