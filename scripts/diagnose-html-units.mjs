// Read-only diagnostic: locate actual currency/scale text near selected annual
// statements; don't assume all report tables share a single multiplier.
import {normalizeGenericStatementHtml} from '../engine/generic-statement-tables.mjs';
const cases=[
 {label:'Microsoft FY2025',url:'https://www.microsoft.com/investor/reports/ar25/'},
 {label:'Apple FY2025',url:'https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/c636d8a7-8025-47d2-9b13-bcf5465343b3.html'}
];
const strip=s=>String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ')
 .replace(/&nbsp;|&#160;|&#xA0;/gi,' ').replace(/\s+/g,' ').trim();
const results=[];
for(const c of cases){
 try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),26000);
  let html;try{const resp=await fetch(c.url,{signal:controller.signal,redirect:'error',
   headers:{'User-Agent':'Osakevahti research https://github.com/naatti21/osakevahti'}});
   if(!resp.ok)throw Error('HTTP '+resp.status);html=await resp.text();
  }finally{clearTimeout(timer)}
  const data=normalizeGenericStatementHtml(html,{sourceUrl:c.url,reportYear:2025});
  const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  const selected={};
  for(const [kind,index] of Object.entries(data.statementSelection)){
   if(index==null){selected[kind]={error:'statement-not-unique'};continue}
   const entry=tables[index];
   const before=strip(html.slice(Math.max(0,entry.index-10000),entry.index)).slice(-1600);
   const after=strip(html.slice(entry.index+entry[0].length,entry.index+entry[0].length+900)).slice(0,400);
   const first=strip(entry[1].slice(0,1600)).slice(0,650);
   selected[kind]={index,precedingText:before,firstTableText:first,followingText:after,
    inTableUnitHints:[...first.matchAll(/.{0,70}(?:million|thousand|dollar|usd).{0,70}/gi)].map(x=>x[0]).slice(0,4)};
  }
  results.push({label:c.label,status:'retrieved',tableCounts:data.candidateCounts,selected});
 }catch(e){results.push({label:c.label,error:String(e?.message||e)})}
}
console.log('HTML_UNIT_CONTEXT_BEGIN');console.log(JSON.stringify(results,null,2));console.log('HTML_UNIT_CONTEXT_END');
