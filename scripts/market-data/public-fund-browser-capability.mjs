/**
 * One-off browser capability probe (no scraping/export of fund values).
 * This uses the public UI exactly once, without login or hidden API discovery.
 * Logs: number of visible table rows and public data response host/path only.
 * No cookies, URLs with query tokens, request bodies or quote values saved.
 */
import {chromium} from "@playwright/test";

const seen=new Set();
const dataRoutes=new Set();
const pageURL="https://www.rahastoraportti.fi/";
let browser=null;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({locale:"fi-FI"});
  page.on("response",response=>{
    try{
      const url=new URL(response.url());
      const kind=response.request().resourceType();
      if(["xhr","fetch"].includes(kind)&&url.protocol==="https:"&&dataRoutes.size<16){
        const safePath=url.pathname.replace(/[a-f0-9]{16,}/gi,"[opaque]").slice(0,120);
        dataRoutes.add(url.hostname+safePath+" ["+response.status()+"]");
      }
      const type=(response.headers()["content-type"]||"").toLowerCase();
      if((type.includes("application/json")||type.includes("application/graphql")) &&
         url.protocol==="https:" &&
         seen.size<15){
        // Never log query strings, URL credentials or response bodies.
        seen.add(url.hostname+url.pathname.slice(0,110));
      }
    }catch{}
  });
  await page.goto(pageURL,{waitUntil:"domcontentloaded",timeout:20000});
  await page.waitForTimeout(7500);
  const result=await page.evaluate(()=>{
    const body=document.body?.innerText||"";
    const tables=[...document.querySelectorAll("table")];
    const rows=tables.reduce((a,t)=>a+t.querySelectorAll("tr").length,0);
    return {
      title:document.title.slice(0,80),
      bodyHasFundPriceHeader:/fund prices|rahastojen arvot|osuussarja|share class/i.test(body),
      javascriptShellOnly:/^you need to enable javascript to run this app\.?$/i.test(body.trim()),
      tableCount:tables.length,
      visibleRowCount:rows,
      // only capability signals, not actual fund names/prices:
      bodyNonempty:body.trim().length>1000
    };
  });
  process.stdout.write(JSON.stringify({
    probe:"single-public-browser-render",...result,
    observedPublicJsonPaths:[...seen],
    observedPublicFetchPaths:[...dataRoutes]
  },null,2)+"\n");
} catch(err) {
  process.stdout.write(JSON.stringify({probe:"single-public-browser-render",
    status:"failed",reason:String(err?.name||"browser_error")})+"\n");
}finally {
  await browser?.close();
}
