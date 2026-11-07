// Research diagnostic only: disclose structural metadata, never portfolio data.
const apple='https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/c636d8a7-8025-47d2-9b13-bcf5465343b3.html';
const elisa='https://filings.xbrl.org/743700TU2S3DXWGU7H32/2025-12-31/ESEF/FI/1/743700TU2S3DXWGU7H32-2025-12-31-1-en.json';
async function get(url){
 const r=await fetch(url,{headers:{'User-Agent':'Osakevahti research https://github.com/naatti21/osakevahti'},signal:AbortSignal.timeout(26000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 return r.text();
}
const attr=(text,key)=>{const m=text.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*["\\x27]([^"\\x27]+)["\\x27]','i'));return m?.[1]||''};
const appleHtml=await get(apple);
const tags=[...appleHtml.matchAll(/<ix:nonfraction\b([^>]*?)>([\s\S]*?)<\/ix:nonfraction>/gi)];
const ixFocus=tags.filter(m=>/(revenue|netincome|cashprovided|operatingactivities|deb(t|tcurrent)|longtermdebt|shorttermborrow|shorttermdebt)/i.test(attr(m[1],'name')));
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/\s+/g,' ').trim();
const sample=ixFocus.slice(0,24).map(m=>({name:attr(m[1],'name'),context:attr(m[1],'contextRef'),
 unit:attr(m[1],'unitRef'),scale:attr(m[1],'scale'),value:clean(m[2]).slice(0,55)}));
const contexts=[...appleHtml.matchAll(/<(?:xbrli:)?context\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?context>/gi)];
const contextSamples=contexts.slice(0,8).map(m=>({id:attr(m[1],'id'),period:clean(m[2]).slice(0,160),dimensions:(m[2].match(/<xbrldi:/gi)||[]).length}));
const docTypes={tableCount:(appleHtml.match(/<table\b/gi)||[]).length,ixTagCount:tags.length,
 focusCount:ixFocus.length,contextCount:contexts.length};
const htmlRows=[...appleHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
 .map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>clean(c[1])).filter(Boolean));
const rowSamples=htmlRows.filter(a=>/(net sales|net income|cash generated|total assets|total liabilities|short-term debt|long-term debt)/i.test(a[0]||''))
 .slice(0,28).map(x=>x.slice(0,6).map(s=>s.slice(0,80)));
const units=[...appleHtml.matchAll(/<(?:xbrli:)?unit\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?unit>/gi)]
 .slice(0,8).map(m=>({id:attr(m[1],'id'),value:clean(m[2]).slice(0,90)}));
let elisaData;
try{
 const raw=JSON.parse(await get(elisa));
 const focus=[...Object.values(raw.facts||{})].filter(x=>/borrow|debt|loan|lease/i.test(x?.dimensions?.concept||''));
 const map=new Map();
 for(const x of focus){
  const d=x.dimensions,concept=d.concept;
  if(!map.has(concept))map.set(concept,[]);
  const arr=map.get(concept);
  if(arr.length<3)arr.push({period:d.period,unit:d.unit,extraDimensions:Object.keys(d).filter(k=>!['concept','entity','period','unit'].includes(k)),
   value:String(x.value).slice(0,45)});
 }
 elisaData=[...map].map(([concept,examples])=>({concept,examples})).slice(0,65);
}catch(err){elisaData={error:String(err)}}
const summary={apple:{url:apple,metadata:docTypes,ixConceptSamples:sample,
 ixConceptNames:[...new Set(ixFocus.map(x=>attr(x[1],'name')))].slice(0,70),
 contextSamples,unitSamples:units,tableRowSamples:rowSamples},elisa:{source:elisa,debtConceptSamples:elisaData}};
console.log('STRUCTURE_DIAGNOSTIC_BEGIN');
console.log(JSON.stringify(summary,null,2));
console.log('STRUCTURE_DIAGNOSTIC_END');
