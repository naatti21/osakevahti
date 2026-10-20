// Non-commercial research: check whether EODHD demo could be called from the personal Alpha
// and whether Nasdaq's public post-trade portal exposes stable downloadable CSV links.
// Never fetch raw market CSVs, upload holdings, or send user API credentials.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ORIGIN='https://osakevahti-alpha-naatti21.pages.dev';
const DEMO='https://eodhd.com/api/eod/AAPL.US?api_token=demo&fmt=json&from=2026-10-16&to=2026-10-19';
const NASDAQ='https://tradereports.nasdaq.com/shares/trade-reports/post-trade';

function allowedCors(value) {
  return value==='*'||value===ORIGIN;
}

async function get(url) {
  const controller=new AbortController();
  const t=setTimeout(()=>controller.abort(),12000);
  try {
    const res=await fetch(url,{
      signal:controller.signal,redirect:'error',
      headers:{'Origin':ORIGIN,'Accept':'text/html,application/json'}
    });
    const text=await res.text();
    return {status:res.status,type:res.headers.get('content-type')||'',
      cors:res.headers.get('access-control-allow-origin')||null,
      text:text.slice(0,1_000_000)};
  } finally {clearTimeout(t)}
}

function inspectLinks(html) {
  // No undocumented URL construction or crawling.
  const links=[...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(x=>x[1]);
  const csv=links.filter(x=>/\.csv(?:[?#]|$)/i.test(x)).slice(0,12);
  return {anchors:links.length,explicitCsvLinks:csv.length,
    // No third-party URL returned to avoid accidental unverified data download.
    hasDownloadLabels:/download\s+csv|\.csv/i.test(html)};
}

export async function runPublicAccessProbe() {
  let eod={ok:false,reason:'not-attempted'};
  try {
    const r=await get(DEMO);
    let hasArray=false;
    try {hasArray=Array.isArray(JSON.parse(r.text))}catch{}
    eod={status:r.status,hasPriceArray:hasArray,
      corsForAlpha:allowedCors(r.cors),corsHeader:r.cors||'none',
      // A CORS header alone is not a verified browser fetch; browser test next if positive.
      personalBrowserIntegrationVerified:false,
      readyForFinland:false};
  } catch(err) {
    eod={ok:false,reason:String(err?.name||'fetch-failure')};
  }
  let nasdaq={reachable:false};
  try {
    const r=await get(NASDAQ);
    nasdaq={status:r.status,reachable:r.status===200,
      ...inspectLinks(r.text),
      // This page is regulatory transparency, NOT a guaranteed price API.
      csvContractVerified:false,
      automaticDownloadAuthorized:false,
      lastTradeIsClose:false};
  } catch(err) {
    nasdaq={reachable:false,reason:String(err?.name||'fetch-failure')};
  }
  return {checkedAt:new Date().toISOString(),researchOnly:true,
    publicDemo:eod,nasdaqPortal:nasdaq,
    commercialDataRights:'NOT_VERIFIED',
    historicalFinnishDividends:'NOT_TESTED',
    productionReady:false};
}

if (process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  runPublicAccessProbe().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{
    console.error('Research probe failed: '+String(e?.message||e));process.exitCode=1;
  });
}
