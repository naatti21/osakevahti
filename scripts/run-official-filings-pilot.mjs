import {normalizeSecCompanyFacts,normalizeEsefXbrlJson,combineEsefYears,coverage,PILOT_YEARS} from '../engine/official-filings-pilot.mjs';
import {normalizeIssuerIrTables,combineIrReports} from '../engine/issuer-ir-tables-pilot.mjs';
import {normalizeGenericStatementHtml} from '../engine/generic-statement-tables.mjs';
import {appendFile} from 'node:fs/promises';

const SEC_URL='https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json';
const ESEF_LEI='549300A0JPRWG1KI7U06';
const USER_AGENT='Osakevahti official-filings research https://github.com/naatti21/osakevahti';
const TIMEOUT_MS=25000;
async function get(url,{maxBytes=40000000}={}){
 const target=new URL(url);
 if(target.protocol!=='https:'||!['data.sec.gov','filings.xbrl.org','www.microsoft.com'].includes(target.hostname))
  throw new Error('Disallowed source host');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  const res=await fetch(url,{signal:controller.signal,redirect:'error',headers:{
    'User-Agent':USER_AGENT,'Accept':'application/json, text/html;q=0.8','Accept-Encoding':'gzip'
  }});
  if(!res.ok)throw new Error(target.hostname+' HTTP '+res.status);
  const length=Number(res.headers.get('content-length')||0);
  if(length>maxBytes)throw new Error('Source too large before download');
  const raw=await res.arrayBuffer();if(raw.byteLength>maxBytes)throw new Error('Source too large');
  return new TextDecoder().decode(raw);
 }finally{clearTimeout(timer)}
}
async function pullSec(){
 try{
  const raw=JSON.parse(await get(SEC_URL,{maxBytes:30000000}));
  const p=normalizeSecCompanyFacts(raw,{cik:789019});
  return {status:'retrieved',source:SEC_URL,report:p,coverage:coverage(p)};
 }catch(e){return {status:'blocked',source:SEC_URL,error:String(e?.message||e)}}
}
function esefReportPage(year){return 'https://filings.xbrl.org/filing/'+ESEF_LEI+'-'+year+'-12-31-ESEF-FI-0'}
async function pullOneEsef(year){
 const page=esefReportPage(year);
 try{
  const html=await get(page,{maxBytes:1500000});
  const links=[...html.matchAll(/href=["']([^"']+\.json(?:\?[^"']*)?)["']/gi)]
   .map(m=>m[1].replaceAll('&amp;','&'));
  const url=links.map(l=>{try{return new URL(l,page)}catch{return null}})
   .find(u=>u&&u.hostname==='filings.xbrl.org'&&
     u.pathname.includes('/'+ESEF_LEI+'/'+year+'-12-31/')&&u.pathname.endsWith('.json'));
  if(!url)throw new Error('ESEF xBRL-JSON link absent in official filing index');
  const raw=JSON.parse(await get(url.href,{maxBytes:55000000}));
  const report=normalizeEsefXbrlJson(raw,{lei:ESEF_LEI,year,sourceUrl:url.href});
  // Non-invasive taxonomy diagnostic: which standard debt concepts are actually
  // present at the filing-period balance-sheet instant? No inferred debt amounts.
  const debtConcepts=[...new Set(Object.values(raw.facts||{}).map(x=>x?.dimensions?.concept)
    .filter(x=>typeof x==='string'&&x.startsWith('ifrs-full:')&&
      /(borrow|debt|loan|lease|financialliabilit)/i.test(x)))].sort().slice(0,80);
  return {status:'retrieved',year,source:url.href,report,debtConcepts};
 }catch(e){return {status:'blocked',year,source:page,error:String(e?.message||e)}}
}

// Alternate official issuer-IR source probe. This is not SEC Company Facts and
// must never be quietly substituted for the standard-tag analysis contract.
async function pullMicrosoftIrProbe(){
 const years=[2025,2023,2021];
 const result=[];
 for(const year of years){
  const url='https://www.microsoft.com/investor/reports/ar'+String(year).slice(2)+'/';
  try{
   const html=await get(url,{maxBytes:12000000});
   const strip=s=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
     .replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
   const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
     .map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
       .map(cell=>strip(cell[1])).filter(Boolean)).filter(a=>a.length);
   const focus=rows.filter(a=>/^(total revenue|net income|net cash from operations|short-term debt|current portion of long-term debt|long-term debt)$/i.test(a[0]||''))
    .slice(0,40);
   const report=normalizeIssuerIrTables(html,{sourceUrl:url,reportYear:year});
   const generic=normalizeGenericStatementHtml(html,{sourceUrl:url,reportYear:year});
   result.push({year,status:'retrieved',url,byteCount:html.length,tableRows:rows.length,
    focusRows:focus,report,generic});
  }catch(e){result.push({year,status:'blocked',url,error:String(e?.message||e)})}
 }
 return result;
}

function mini(x){
 if(!x)return {status:'missing'};
 const compact={status:x.status};
 for(const k of ['value','unit','concept','period','filed','accession','sourceUrl','reason','derivedFrom'])
  if(x[k]!==undefined)compact[k]=x[k];
 return compact;
}
function summarizeReport(report){
 const out={};
 for(const year of PILOT_YEARS){
  out[year]={};
  for(const key of ['revenue','netIncome','operatingCashflow','interestBearingDebt'])
   out[year][key]=mini(report?.years?.[year]?.[key]);
 }
 return out;
}
const [sec,esefArr,microsoftIrProbe]=await Promise.all([pullSec(),Promise.all(PILOT_YEARS.map(pullOneEsef)),pullMicrosoftIrProbe()]);
const esefDocs=Object.fromEntries(esefArr.filter(r=>r.status==='retrieved').map(r=>[r.year,r.report]));
const microsoftIr=combineIrReports(microsoftIrProbe.filter(r=>r.status==='retrieved').map(r=>r.report));
const microsoftGeneric=combineIrReports(microsoftIrProbe.filter(r=>r.status==='retrieved').map(r=>r.generic));
const esef=combineEsefYears(esefDocs,{lei:ESEF_LEI});
const report={
 checkedAt:new Date().toISOString(),
 policy:'Research-only: real source facts, no synthetic fallbacks, no portfolio or deployment changes',
 sec:{status:sec.status,source:sec.source,error:sec.error||null,coverage:coverage(sec.report),years:summarizeReport(sec.report)},
 microsoftSemantic:{coverage:coverage(microsoftGeneric),years:summarizeReport(microsoftGeneric),
   sourceTier:'issuer-html-not-xbrl',
   tableSelection:microsoftIrProbe.map(({year,generic})=>({year,statementSelection:generic?.statementSelection,
     candidateCounts:generic?.candidateCounts,yearLists:generic?.yearLists}))},
 microsoftIr:{
   sources:microsoftIrProbe.map(({year,url,status,error,tableRows,report})=>({
     year,url,status,error:error||null,tableRows,
     tablesDetected:report?.tablesDetected,yearsDetected:report?.yearsDetected
   })),
   coverage:coverage(microsoftIr),years:summarizeReport(microsoftIr),
   sourceTier:'official-issuer-html-requires-crosscheck-not-sec-xbrl'
 },
 esef:{source:'https://filings.xbrl.org/',lei:ESEF_LEI,
  sources:esefArr.map(({year,status,source,error,debtConcepts})=>({year,status,source,error:error||null,
   debtConcepts:year===2025?debtConcepts:undefined})),
  coverage:coverage(esef),years:summarizeReport(esef)},
 result:(sec.status==='retrieved'&&coverage(sec.report).complete&&coverage(esef).complete)
   ?'FULL_COVERAGE_EVIDENCE_PROBE':'PARTIAL_OR_BLOCKED_NO_GO'
};
console.log('PILOT_EVIDENCE_BEGIN');
console.log(JSON.stringify(report,null,2));
console.log('PILOT_EVIDENCE_END');
if(process.env.GITHUB_STEP_SUMMARY){
 const c1=report.sec.coverage,c2=report.esef.coverage,c3=report.microsoftIr.coverage,c4=report.microsoftSemantic.coverage;
 const lines=['## Virallisten tilinpäätösten pilotti','**Tulos: '+report.result+'**',
  'Microsoft / SEC: '+c1.ok+'/'+c1.total+' vaadittua lukua',
  'Nokia / ESEF: '+c2.ok+'/'+c2.total+' vaadittua lukua',
  'Microsoft / omat IR-HTML-raportit (vanha lukija): '+c3.ok+'/'+c3.total+' lukua',
  'Microsoft / semanttinen yleislukija: '+c4.ok+'/'+c4.total+' lukua',
  'Datan lähde ja jokaisen kentän tila ovat työajon lokissa.',
  'Tämä ei ole käyttöönotto- eikä sijoituspäätös.'];
 await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n\n')+'\n');
}
