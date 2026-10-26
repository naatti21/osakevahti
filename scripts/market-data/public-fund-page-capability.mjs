/**
 * One-request public page capability probe, NOT a scraper or price fetch.
 * - One GET per page; no login/session/API endpoint discovery.
 * - No personal instruments, accounts, amounts, API keys or URL query strings.
 * - Does not collect/reprint/share any fund prices.
 * - Fail closed if a site does not expose a usable ordinary public HTML table.
 */
const targets=[
  "https://www.rahastoraportti.fi/",
  "https://www.rahastoraportti.fi/robots.txt"
];
async function probe(url) {
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),11000);
  try {
    const r=await fetch(url,{
      redirect:"error",signal:ctrl.signal,
      headers:{"Accept":"text/html,text/plain;q=0.5","User-Agent":"Osakevahti-personal-readonly-capability/0.1"}
    });
    const kind=(r.headers.get("content-type")||"").split(";")[0];
    if(!r.ok)return {path:new URL(url).pathname,status:r.status,ok:false};
    const reader=r.body?.getReader(),dec=new TextDecoder();
    let count=0,body="";
    if(reader)for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      count+=value.length;
      if(count>300000){await reader.cancel();return {
        path:new URL(url).pathname,status:r.status,tooLarge:true,contentType:kind
      };}
      body+=dec.decode(value,{stream:true});
    }
    // Report capability metadata only, not page data.
    return {
      path:new URL(url).pathname,status:r.status,contentType:kind,
      bytes:count,
      clientRenderedShell:/enable javascript to run this app|<div id=["']root["']><\/div>/i.test(body),
      serverRenderedTable:/<table(?:\s|>)/i.test(body),
      robotsContainsRelevantRules:new URL(url).pathname.endsWith("robots.txt")?
        /disallow:|allow:/i.test(body):null,
      usablePlainTable:/<table(?:\s|>)/i.test(body)&&
        !/enable javascript to run this app/i.test(body)
    };
  }finally{clearTimeout(timer);}
}
const outcome={probe:"public-web-page-only",verifiedAutomatedFundData:false,results:[]};
for(const url of targets){
  try{outcome.results.push(await probe(url));}
  catch(err){outcome.results.push({path:new URL(url).pathname,
    ok:false,error:String(err?.name||"network_failure")});}
}
process.stdout.write(JSON.stringify(outcome,null,2)+"\n");
// Advisory: no nonzero exit for a public page that lacks a server-side HTML table.
