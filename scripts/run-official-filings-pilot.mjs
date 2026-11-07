import {normalizeSecCompanyFacts,normalizeEsefXbrlJson,combineEsefYears,coverage,PILOT_YEARS} from '../engine/official-filings-pilot.mjs';
import {appendFile} from 'node:fs/promises';

const SEC_URL='https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json';
const ESEF_LEI='549300A0JPRWG1KI7U06';
const USER_AGENT='Osakevahti official-filings research https://github.com/naatti21/osakevahti';
const TIMEOUT_MS=25000;
async function get(url,{maxBytes=40000000}={}){
 const target=new URL(url);
 if(target.protocol!=='https:'||!['data.sec.gov','filings.xbrl.org'].includes(target.hostname))
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
const [sec,esefArr]=await Promise.all([pullSec(),Promise.all(PILOT_YEARS.map(pullOneEsef))]);
const esefDocs=Object.fromEntries(esefArr.filter(r=>r.status==='retrieved').map(r=>[r.year,r.report]));
const esef=combineEsefYears(esefDocs,{lei:ESEF_LEI});
const report={
 checkedAt:new Date().toISOString(),
 policy:'Research-only: real source facts, no synthetic fallbacks, no portfolio or deployment changes',
 sec:{status:sec.status,source:sec.source,error:sec.error||null,coverage:coverage(sec.report),years:summarizeReport(sec.report)},
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
 const c1=report.sec.coverage,c2=report.esef.coverage;
 const lines=['## Virallisten tilinpäätösten pilotti','**Tulos: '+report.result+'**',
  'Microsoft / SEC: '+c1.ok+'/'+c1.total+' vaadittua lukua',
  'Nokia / ESEF: '+c2.ok+'/'+c2.total+' vaadittua lukua',
  'Datan lähde ja jokaisen kentän tila ovat työajon lokissa.',
  'Tämä ei ole käyttöönotto- eikä sijoituspäätös.'];
 await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n\n')+'\n');
}
