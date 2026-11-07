import {normalizeEsefXbrlJson,combineEsefYears,coverage,PILOT_YEARS} from '../engine/official-filings-pilot.mjs';
import {normalizeIssuerIrTables,combineIrReports} from '../engine/issuer-ir-tables-pilot.mjs';
import {normalizeGenericStatementHtml} from '../engine/generic-statement-tables.mjs';
import {normalizeSourceScaledStatementHtml} from '../engine/html-statement-unit-evidence.mjs';
import {auditFilingEvidence} from '../engine/filings-evidence-gate.mjs';
import {createFilingsReceipt} from './filings-receipts.mjs';
import {writeFile,appendFile} from 'node:fs/promises';
// Blind test: same generic engines as Nokia and Microsoft, no issuer-specific concept/label additions.
const LEI='743700TU2S3DXWGU7H32';
const APPLE=[
 {year:2025,url:'https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/c636d8a7-8025-47d2-9b13-bcf5465343b3.html'},
 {year:2023,url:'https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/1999a9bb-1e5c-4aa2-a94e-91da5d7b4006.html'},
 {year:2021,url:'https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/23f4d432-c1c3-43be-9050-596f45eaeee9.html'}
];
const ALLOWED=new Set(['filings.xbrl.org','d18rn0p25nwr6d.cloudfront.net']);
const keys=['revenue','netIncome','operatingCashflow','interestBearingDebt'];
async function get(url,maxBytes=55_000_000){
 const u=new URL(url);if(u.protocol!=='https:'||!ALLOWED.has(u.hostname))throw Error('host-not-allowed');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),27000);
 try{
  const r=await fetch(url,{signal:controller.signal,redirect:'error',
   headers:{'User-Agent':'Osakevahti research https://github.com/naatti21/osakevahti','Accept':'application/json,text/html;q=0.8'}});
  if(!r.ok)throw Error('HTTP '+r.status);
  if(Number(r.headers.get('content-length')||0)>maxBytes)throw Error('too-large');
  const bytes=await r.arrayBuffer();if(bytes.byteLength>maxBytes)throw Error('too-large');
  return new TextDecoder().decode(bytes);
 }finally{clearTimeout(timer)}
}
function findJson(html,page,lei,year){
 for(const m of html.matchAll(/href=["']([^"']+\.json(?:\?[^"']*)?)["']/gi)){
  let u;try{u=new URL(m[1].replaceAll('&amp;','&'),page)}catch{continue}
  if(u.hostname==='filings.xbrl.org'&&u.pathname.includes('/'+lei+'/'+year+'-12-31/')&&u.pathname.endsWith('.json'))
   return u.href;
 }
 return null;
}
async function elisa(year){
 const errors=[];
 for(const language of [1,0]){
  const page='https://filings.xbrl.org/filing/'+LEI+'-'+year+'-12-31-ESEF-FI-'+language;
  try{
   const index=await get(page,1_500_000),source=findJson(index,page,LEI,year);
   if(!source)throw Error('JSON-link-not-present');
   const rawText=await get(source);
   const raw=JSON.parse(rawText);
   const receipt=createFilingsReceipt({sourceUrl:source,body:rawText,format:'xbrl-json',
    issuerId:'LEI:'+LEI});
   const entities=[...new Set(Object.values(raw?.facts||{}).map(x=>x?.dimensions?.entity).filter(x=>typeof x==='string'))];
   if(!entities.length||entities.some(x=>!x.toUpperCase().endsWith(LEI)))throw Error('entity-dimension-mismatch');
   const report=normalizeEsefXbrlJson(raw,{lei:LEI,year,sourceUrl:source});
   return {year,status:'retrieved',source,page,entities,report,receipt};
  }catch(e){errors.push({page,error:String(e?.message||e)})}
 }
 return {year,status:'blocked',errors};
}
async function apple({year,url}){
 try{
  const html=await get(url,15_000_000);
  if(!html.toLowerCase().includes('apple inc.')||!html.toLowerCase().includes('form 10-k'))
   throw Error('not-verified-10k');
  const legacy=normalizeIssuerIrTables(html,{sourceUrl:url,reportYear:year});
  const receipt=createFilingsReceipt({sourceUrl:url,body:html,format:'issuer-html',
   issuerId:'CIK:0000320193',issuerName:'Apple Inc.'});
  const unproven=normalizeGenericStatementHtml(html,{sourceUrl:url,reportYear:year});
  const report=normalizeSourceScaledStatementHtml(html,{sourceUrl:url,reportYear:year});
  return {year,status:'retrieved',source:url,bytes:html.length,
   tablesDetected:report.statementSelection,yearsDetected:report.yearLists,
   statementScales:report.statementScales,legacy,unproven,report,receipt};
 }catch(e){return {year,status:'blocked',source:url,error:String(e?.message||e)}}
}
function facts(data){
 return Object.fromEntries(PILOT_YEARS.map(y=>[y,Object.fromEntries(keys.map(k=>{
  const v=data?.years?.[y]?.[k],out={status:v?.status||'missing'};
  for(const key of ['value','unit','concept','period','sourceUrl','reason','knownLongTermAndCurrentPortion'])
   if(v?.[key]!==undefined)out[key]=v[key];
  return [k,out];
 }))]));
}
const [er,ar]=await Promise.all([Promise.all(PILOT_YEARS.map(elisa)),Promise.all(APPLE.map(apple))]);
const eu=combineEsefYears(Object.fromEntries(er.filter(r=>r.status==='retrieved').map(r=>[r.year,r.report])),{lei:LEI});
const us=combineIrReports(ar.filter(r=>r.status==='retrieved').map(r=>r.report));
const appleLegacy=combineIrReports(ar.filter(r=>r.status==='retrieved').map(r=>r.legacy));
const appleUnproven=combineIrReports(ar.filter(r=>r.status==='retrieved').map(r=>r.unproven));
const ec=coverage(eu),ac=coverage(us);
function htmlScaleCounts(audit){
 let proven=0,unproven=0;
 for(const fields of Object.values(audit.cells)){
  for(const cell of Object.values(fields)){
   if(cell.status!=='needs-review')continue;
   if(cell.scaleEvidence?.status==='ok')proven++;
   else unproven++;
  }
 }
 return {proven,unproven,stillNeedsIndependentAudit:proven+unproven};
}
const auditedAt=new Date().toISOString();
const elisaAudit=auditFilingEvidence(eu,{identity:'LEI:'+LEI,currency:'EUR',
 asOf:auditedAt,receipts:er.flatMap(r=>r.receipt?[r.receipt]:[])});
const appleAudit=auditFilingEvidence(us,{identity:'CIK:0000320193',currency:'USD',
 asOf:auditedAt,receipts:ar.flatMap(r=>r.receipt?[r.receipt]:[])});
const output={checkedAt:new Date().toISOString(),
 methodology:'IFRS + semantic HTML source evidence; original out-of-sample baseline retained; missing is not zero',
 sourceAudit:{elisa:elisaAudit,apple:appleAudit},
 htmlSourceScale:htmlScaleCounts(appleAudit),
 receiptDiagnostics:er.map(x=>({year:x.year,entities:x.receipt?.entityDimensions,
 count:x.receipt?.dimensionFactCount,matched:x.receipt?.entityMatched})),
 elisa:{identity:'LEI:'+LEI,coverage:ec,runs:er.map(({report,receipt,...x})=>x),years:facts(eu)},
 apple:{identity:'CIK:0000320193',coverage:ac,legacyCoverage:coverage(appleLegacy),
   previousUnprovenCoverage:coverage(appleUnproven),
   runs:ar.map(({report,legacy,unproven,receipt,...x})=>x),years:facts(us)},
 total:{ok:ec.ok+ac.ok,of:40,gate:ec.complete&&ac.complete?'REVIEW_REQUIRED':'NO_GO_PARTIAL'}};
console.log('OUT_OF_SAMPLE_EVIDENCE_BEGIN');
console.log(JSON.stringify(output,null,2));
console.log('OUT_OF_SAMPLE_EVIDENCE_END');
await writeFile('out-of-sample-pilot-report.json',JSON.stringify(output,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,[
 '## Out-of-sample: Elisa ESEF and Apple 10-K',
 '**'+output.total.gate+'**',
 'Elisa '+ec.ok+'/20 · downloaded '+er.filter(r=>r.status==='retrieved').length+'/5 reports.',
 'Apple '+ac.ok+'/20 · downloaded '+ar.filter(r=>r.status==='retrieved').length+'/3 reports.',
 'Total '+output.total.ok+'/40. Research execution success is not publication approval.',
 'Elisa evidence: '+elisaAudit.counts.sourceConsistent+' source-consistent, '+elisaAudit.counts.blocked+' blocked.',
 'Apple evidence: '+appleAudit.counts.needsReview+' HTML facts need review, '+appleAudit.counts.blocked+' blocked.',
 'Apple HTML monetary scale backed by statement declaration: '+output.htmlSourceScale.proven+'/'+output.htmlSourceScale.stillNeedsIndependentAudit,
 'All evidence and missing fields available in out-of-sample-pilot-report artifact.'
].join('\n\n')+'\n');
