// Official-filings pilot. Pure generic SEC us-gaap and ESEF ifrs-full adapters.
// No security trading advice, no portfolio access, no issuer-specific financial aliases.
export const PILOT_YEARS=[2021,2022,2023,2024,2025];
const METRICS=['revenue','netIncome','operatingCashflow','interestBearingDebt'];
const SEC_TAGS={
  revenue:['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],
  netIncome:['NetIncomeLoss'],
  operatingCashflow:['NetCashProvidedByUsedInOperatingActivities'],
  debtCurrent:['LongTermDebtCurrent','LongTermDebtAndCapitalLeaseObligationsCurrent'],
  debtNoncurrent:['LongTermDebtNoncurrent','LongTermDebtAndCapitalLeaseObligationsNoncurrent']
};
const IFRS_TAGS={
  revenue:['Revenue','RevenueFromContractsWithCustomers'],
  netIncome:['ProfitLoss'],
  operatingCashflow:['CashFlowsFromUsedInOperatingActivities'],
  debtCurrent:['CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings','CurrentBorrowings','ShorttermBorrowings'],
  debtNoncurrent:['NoncurrentBorrowings','LongtermBorrowings']
};
const annual=['revenue','netIncome','operatingCashflow'];
const missing=reason=>({status:'missing',reason});
const invalid=reason=>({status:'conflict',reason});
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&
   new Date(s).toISOString().slice(0,10)===s;
const days=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000);
function fits(f,year,isDuration){
 if(!validDate(f.end)||Number(f.end.slice(0,4))!==year)return false;
 if(isDuration)return validDate(f.start)&&days(f.start,f.end)>=335&&days(f.start,f.end)<=390;
 return !f.start;
}
function choose(entries,year,isDuration,positive=false){
 const a=entries.filter(x=>fits(x,year,isDuration)&&typeof x.value==='number'&&Number.isFinite(x.value)&&
   (!positive||x.value>=0));
 if(!a.length)return missing('no-valid-annual-standard-fact');
 a.sort((x,y)=>String(y.filed||'').localeCompare(String(x.filed||''))||
   String(y.accession||'').localeCompare(String(x.accession||'')));
 const preferred=a[0],same=a.filter(x=>String(x.filed||'')===String(preferred.filed||''));
 if(same.some(x=>Math.abs(x.value-preferred.value)>Math.max(1,Math.abs(preferred.value)*0.000001)))
   return invalid('conflicting-duplicate-facts-in-selected-filing');
 return {status:'ok',value:preferred.value,unit:preferred.unit,concept:preferred.concept,
   period:isDuration?preferred.start+'/'+preferred.end:preferred.end,
   filed:preferred.filed||null,accession:preferred.accession||null,sourceUrl:preferred.sourceUrl};
}
function extractSecTag(doc,tag,unit,year,isDuration,url){
 const facts=doc?.facts?.['us-gaap']?.[tag]?.units?.[unit];
 if(!Array.isArray(facts))return missing('tag-absent');
 return choose(facts.filter(f=>['10-K','10-K/A'].includes(f.form)).map(f=>({
   value:f.val,start:f.start,end:f.end,filed:f.filed,accession:f.accn,
   unit,concept:'us-gaap:'+tag,sourceUrl:url
 })),year,isDuration,tag.includes('Debt')||tag==='Revenues'||tag.startsWith('Revenue'));
}
function firstPresent(tags,extract){
 for(const tag of tags){const r=extract(tag);
   if(r.status==='ok'||r.status==='conflict')return r;}
 return missing('no-supported-taxonomy-concept');
}
function sumBorrowings(current,noncurrent){
 if(current.status==='conflict'||noncurrent.status==='conflict')return invalid('debt-component-conflict');
 if(current.status!=='ok'||noncurrent.status!=='ok')
  return missing('both-current-and-noncurrent-debt-required');
 if(current.unit!==noncurrent.unit||current.period!==noncurrent.period)
  return invalid('debt-component-period-or-unit-mismatch');
 if(current.accession&&noncurrent.accession&&current.accession!==noncurrent.accession)
  return invalid('debt-components-from-different-filings');
 return {status:'ok',value:current.value+noncurrent.value,unit:current.unit,period:current.period,
   filed:current.filed||noncurrent.filed,accession:current.accession||noncurrent.accession,
   concept:current.concept+' + '+noncurrent.concept,
   sourceUrl:current.sourceUrl,derivedFrom:[current.concept,noncurrent.concept]};
}
function secMetric(doc,year,field,unit,url){
 const get=(tag,kind)=>extractSecTag(doc,tag,unit,year,kind,url);
 if(field==='interestBearingDebt')return sumBorrowings(
   firstPresent(SEC_TAGS.debtCurrent,tag=>get(tag,false)),
   firstPresent(SEC_TAGS.debtNoncurrent,tag=>get(tag,false)));
 return firstPresent(SEC_TAGS[field],tag=>get(tag,true));
}
export function normalizeSecCompanyFacts(doc,{cik,unit='USD',years=PILOT_YEARS}={}){
 const correct=Number.isInteger(Number(cik))&&Number(cik)>0&&Number(doc?.cik)===Number(cik);
 const url='https://data.sec.gov/api/xbrl/companyfacts/CIK'+String(cik).padStart(10,'0')+'.json';
 const rows={};
 for(const year of years){
  rows[year]={};
  for(const field of METRICS)rows[year][field]=correct?secMetric(doc,year,field,unit,url):invalid('CIK-identity-mismatch');
 }
 return {provider:'SEC Company Facts',issuer:doc?.entityName||'unverified',identifier:'CIK:'+cik,
   years:rows,checkedAt:null,sourceUrl:url};
}
function parseXbrlPeriod(dim,isDuration){
 const v=String(dim||'');const parts=v.split('/');
 if(isDuration){
  if(parts.length!==2)return null;
  const start=parts[0].slice(0,10),exclusiveEnd=parts[1].slice(0,10);
  if(!validDate(start)||!validDate(exclusiveEnd))return null;
  // xBRL-JSON represents duration as [start,end), i.e. the end is exclusive.
  // FY2025 is 2025-01-01/2026-01-01, NOT 2024-01-01/2025-01-01.
  const end=new Date(Date.parse(exclusiveEnd)-86400000).toISOString().slice(0,10);
  if(!validDate(end)||end<start)return null;
  return {start,end};
 }
 if(parts.length!==1)return null;
 // xBRL-JSON instant is a precise boundary. End-of-day balance-sheet facts
 // use midnight of the following day (e.g. FY2025 => 2026-01-01T00:00:00).
 // Reject ambiguous bare dates or unusual times rather than shifting silently.
 if(!/^\d{4}-\d{2}-\d{2}T00:00:00(?:Z)?$/.test(parts[0]))return null;
 const exclusiveInstant=parts[0].slice(0,10);
 if(!validDate(exclusiveInstant))return null;
 const end=new Date(Date.parse(exclusiveInstant)-86400000).toISOString().slice(0,10);
 return validDate(end)?{end}:null;
}
function xbrlFacts(doc,tag,year,isDuration,unit,url){
 const raw=doc?.facts;if(!raw||typeof raw!=='object')return [];
 const rows=[];
 for(const f of Object.values(raw)){
  const d=f?.dimensions;if(!d||d.concept!=='ifrs-full:'+tag)continue;
  if(Object.keys(d).some(k=>!['concept','entity','period','unit'].includes(k)))continue;
  const curr=String(d.unit||'');
  if(curr!==unit&&!curr.endsWith(':'+unit))continue;
  const p=parseXbrlPeriod(d.period,isDuration);if(!p)continue;
  const value=typeof f.value==='number'?f.value:
    typeof f.value==='string'&&f.value.trim()!==''?Number(f.value):NaN;
  if(!Number.isFinite(value))continue;
  rows.push({...p,value,unit,concept:d.concept,sourceUrl:url,accession:null,filed:null});
 }
 return rows;
}
export function normalizeEsefXbrlJson(doc,{lei,year,unit='EUR',sourceUrl}={}){
 if(!/^[A-Z0-9]{20}$/.test(String(lei||''))||!Number.isInteger(year)||year<2000||
   !/^https:\/\/filings\.xbrl\.org\//.test(sourceUrl||''))throw new TypeError('ESEF source identity invalid');
 const get=(tag,kind)=>choose(xbrlFacts(doc,tag,year,kind,unit,sourceUrl),year,kind,
   tag.includes('Borrowings')||tag.startsWith('Revenue'));
 const entry={};
 for(const field of annual)entry[field]=firstPresent(IFRS_TAGS[field],tag=>get(tag,true));
 entry.interestBearingDebt=sumBorrowings(
   firstPresent(IFRS_TAGS.debtCurrent,tag=>get(tag,false)),
   firstPresent(IFRS_TAGS.debtNoncurrent,tag=>get(tag,false)));
 return {provider:'ESEF iXBRL JSON',identifier:'LEI:'+lei,year,sourceUrl,fields:entry};
}
export function combineEsefYears(reports,{lei,years=PILOT_YEARS}={}){
 const rows={};
 for(const y of years){
  rows[y]={};const doc=reports?.[y];
  for(const field of METRICS)rows[y][field]=doc?.identifier==='LEI:'+lei?
    doc.fields?.[field]||missing('metric-not-extracted'):missing('report-not-available');
 }
 return {provider:'ESEF iXBRL JSON',identifier:'LEI:'+lei,years:rows,checkedAt:null};
}
export function coverage(pilot){
 const byMetric={};let ok=0,total=0;
 for(const metric of METRICS){
  byMetric[metric]=0;
  for(const y of PILOT_YEARS){total++;
   if(pilot?.years?.[y]?.[metric]?.status==='ok'){ok++;byMetric[metric]++;}
  }
 }
 return {ok,total,complete:ok===total,byMetric};
}
