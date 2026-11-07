// Generic English-language annual-report HTML tables — research fallback only.
// Deliberately not presented as SEC/XBRL-grade evidence. Does not assume omitted
// short-term debt is zero. No company-specific symbol, name or constants here.
const metrics=['revenue','netIncome','operatingCashflow','interestBearingDebt'];
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
 .replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const rowLabel=x=>String(x||'').toLowerCase().replace(/\s+/g,' ').trim();
const number=x=>{
 const str=String(x||'').trim();
 if(!/^\(?\s*\$?\s*-?\d[\d,]*(?:\.\d+)?\s*\)?$/.test(str))return null;
 const value=Number(str.replace(/[$,\s()]/g,''));
 return Number.isFinite(value)?(str.startsWith('(')?-value:value):null;
};
const missing=reason=>({status:'missing',reason});
function readRows(table){
 return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>
  [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
   .map(k=>clean(k[1])).filter(Boolean)).filter(x=>x.length);
}
function findTable(tables,required){
 const matches=tables.filter(t=>required.every(label=>t.rows.some(r=>rowLabel(r[0])===label)));
 if(matches.length!==1)return null;
 return matches[0];
}
function tableYears(t){
 if(!t)return [];
 for(const row of t.rows.slice(0,12)){
  const y=row.map(x=>/^\d{4}$/.test(x)?Number(x):null).filter(x=>x&&x>=2000&&x<=2035);
  if(y.length>=2&&new Set(y).size===y.length)return y;
 }
 return [];
}
function get(t,label,year,multiplier,sourceUrl){
 if(!t)return missing('financial-statement-table-not-unique');
 const years=tableYears(t);const index=years.indexOf(year);
 if(index<0)return missing('year-not-in-filing');
 const rows=t.rows.filter(r=>rowLabel(r[0])===label);
 if(rows.length!==1)return missing('financial-statement-row-not-unique');
 const values=rows[0].slice(1).map(number).filter(x=>x!==null);
 if(values.length!==years.length)return missing('row-has-incomplete-or-nonnumeric-values');
 return {status:'ok',value:values[index]*multiplier,unit:'USD',fiscalYear:year,
  concept:'issuer-IR-HTML:'+label,sourceUrl,sourceTier:'issuer-html-not-xbrl'};
}
function debt(t,year,multiplier,url){
 const current=get(t,'current portion of long-term debt',year,multiplier,url);
 const noncurrent=get(t,'long-term debt',year,multiplier,url);
 const short=get(t,'short-term debt',year,multiplier,url);
 if([current,noncurrent,short].every(x=>x.status==='ok'))
  return {status:'ok',value:current.value+noncurrent.value+short.value,unit:'USD',fiscalYear:year,
   sourceUrl:url,sourceTier:'issuer-html-not-xbrl',
   concept:'short-term debt + current portion of long-term debt + long-term debt'};
 if(current.status==='ok'&&noncurrent.status==='ok')
  return {...missing('short-term-debt-absent-cannot-assume-zero'),
   knownLongTermAndCurrentPortion:current.value+noncurrent.value,unit:'USD',fiscalYear:year,sourceUrl:url};
 return missing('interest-bearing-debt-components-incomplete');
}
export function normalizeIssuerIrTables(html,{sourceUrl,reportYear,years,multiplier=1000000}={}){
 if(typeof html!=='string'||!Number.isInteger(reportYear)||!/^https:\/\/www\.microsoft\.com\/investor\/reports\/ar\d{2}\/$/.test(sourceUrl||''))
  throw new Error('Official IR source metadata invalid for pilot');
 const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m=>({rows:readRows(m[1])}));
 const income=findTable(tables,['total revenue','net income']);
 const cash=findTable(tables,['net cash from operations']);
 const balance=findTable(tables,['total assets','total liabilities','long-term debt','current portion of long-term debt']);
 const all=[...new Set(years||[reportYear,reportYear-1,reportYear-2])];
 const out={};
 for(const year of all){
  out[year]={
   revenue:get(income,'total revenue',year,multiplier,sourceUrl),
   netIncome:get(income,'net income',year,multiplier,sourceUrl),
   operatingCashflow:get(cash,'net cash from operations',year,multiplier,sourceUrl),
   interestBearingDebt:debt(balance,year,multiplier,sourceUrl)
  };
 }
 return {provider:'Issuer IR HTML annual report',reportYear,sourceUrl,years:out,
   quality:'research-extraction-needs-independent-annual-filing-crosscheck',
   tablesDetected:{income:!!income,cash:!!cash,balance:!!balance},yearsDetected:{
    income:tableYears(income),cash:tableYears(cash),balance:tableYears(balance)}};
}
export function combineIrReports(reports,years=[2021,2022,2023,2024,2025]){
 const result={};
 for(const y of years){
  result[y]={};
  for(const metric of metrics){
   const candidates=reports.filter(x=>x.years?.[y]?.[metric]?.status==='ok')
     .sort((a,b)=>b.reportYear-a.reportYear);
   const best=candidates[0]?.years[y][metric];
   if(!best){result[y][metric]=missing('no-source-confirmed-financial-statement-row');continue}
   if(candidates.some(r=>Math.abs(r.years[y][metric].value-best.value)>
     Math.max(1,Math.abs(best.value)*0.000001)))
     result[y][metric]={status:'conflict',reason:'restated-report-comparative-disagrees',
       alternatives:candidates.map(x=>({reportYear:x.reportYear,value:x.years[y][metric].value,sourceUrl:x.sourceUrl}))};
   else result[y][metric]=best;
  }
 }
 return {provider:'Issuer IR HTML annual reports',years:result,quality:'issuer-html-not-sec'};
}
