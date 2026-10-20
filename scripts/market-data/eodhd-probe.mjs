// Read-only data-source qualification probe. NOT an Alpha price provider.
// No localStorage, user holdings, paid credentials, API key output or live app writes.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TODAY = () => new Date().toISOString().slice(0,10);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const positive = v => v !== null && v !== undefined && v !== '' &&
  Number.isFinite(Number(v)) && Number(v) > 0;
const nonnegative = v => v !== null && v !== undefined && v !== '' &&
  Number.isFinite(Number(v)) && Number(v) >= 0;

function checkedDay(raw, today = TODAY()) {
  if (typeof raw !== 'string' || !DAY.test(raw)) return '';
  const dt = new Date(raw+'T12:00:00Z');
  if (!Number.isFinite(dt.getTime()) || dt.toISOString().slice(0,10) !== raw || raw > today) return '';
  return raw;
}

export function qualifyEod(rows, today = TODAY()) {
  if (!Array.isArray(rows) || !rows.length) return {ok:false,reason:'history-missing'};
  const dates = new Set();
  let min = null, max = null;
  for (const row of rows) {
    const date = checkedDay(row?.date,today);
    if (!date || dates.has(date)) return {ok:false,reason:'duplicate-or-invalid-price-date'};
    dates.add(date);
    if (!positive(row?.close) || (row?.adjusted_close != null && !positive(row.adjusted_close)))
      return {ok:false,reason:'invalid-close'};
    if (row?.volume != null && !nonnegative(row.volume))
      return {ok:false,reason:'invalid-volume'};
    if (!min || date < min) min = date;
    if (!max || date > max) max = date;
  }
  return {ok:true,count:rows.length,first:min,last:max,years:(Date.parse(max)-Date.parse(min))/31557600000,
    // Historiarivi ei todista tickerin, ISINin tai osakelajin identiteettiä.
    instrumentIdentityVerified:false};
}

export function qualifyDividends(rows, today = TODAY()) {
  if (!Array.isArray(rows)) return {ok:false,reason:'dividend-history-unavailable'};
  const keys = new Set();
  let first = null, last = null;
  for (const row of rows) {
    // EODHD /div responds with ex-date in "date", paid amount in "value".
    const date = checkedDay(row?.date,today);
    if (!date) return {ok:false,reason:'invalid-dividend-ex-date'};
    if (!positive(row?.value)) return {ok:false,reason:'invalid-dividend-amount'};
    const key = date+'|'+Number(row.value);
    if (keys.has(key)) return {ok:false,reason:'repeated-dividend-record'};
    keys.add(key);
    if (!first || date < first) first = date;
    if (!last || date > last) last = date;
  }
  // Empty dividends are not interpreted as a verified non-dividend payer.
  return {ok:true,events:rows.length,first,last,
    coverageVerified:false,dividendPayerStatus:rows.length?'events-found':'unknown'};
}

function apiUrl(type, symbol, token, start, end) {
  if (!['eod','div'].includes(type) || !/^[A-Z0-9-]+\.[A-Z]+$/.test(symbol))
    throw Error('Invalid read-only probe target');
  const url = new URL('https://eodhd.com/api/'+type+'/'+encodeURIComponent(symbol));
  url.searchParams.set('api_token',token);
  url.searchParams.set('fmt','json');
  url.searchParams.set('from',start);
  url.searchParams.set('to',end);
  return url;
}

async function getArray(type, symbol, token, start, end) {
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),12000);
  try {
    const response=await fetch(apiUrl(type,symbol,token,start,end),{
      signal:abort.signal,headers:{Accept:'application/json'},redirect:'error'
    });
    if(!response.ok) throw Error(type+' endpoint HTTP '+response.status);
    const data=await response.json();
    if (!Array.isArray(data)) throw Error(type+' endpoint did not return array');
    return data;
  } finally {clearTimeout(timeout)}
}

export async function runDemoProbe() {
  const symbol='AAPL.US'; // EODHD public sample only; NEVER evidence of Finland coverage.
  const end=TODAY(),start='2025-01-01',token='demo';
  const [bars,dividends]=await Promise.all([
    getArray('eod',symbol,token,start,end),
    getArray('div',symbol,token,start,end)
  ]);
  const eod=qualifyEod(bars,end),div=qualifyDividends(dividends,end);
  if (!eod.ok || !div.ok) throw Error('Data contract failed: '+(eod.reason||div.reason));
  return {
    provider:'EODHD',mode:'public-demo',ticker:symbol,
    eodBars:eod.count,firstEod:eod.first,lastEod:eod.last,
    dividendEvents:div.events,firstDividend:div.first,lastDividend:div.last,
    finnishCoverage:'NOT_TESTED',instrumentIdentity:'NOT_VERIFIED',
    publicDataDisplayLicense:'NOT_VERIFIED',productionReady:false
  };
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if (process.argv[2]!=='--demo') {
    process.stderr.write('Usage: node scripts/market-data/eodhd-probe.mjs --demo\n');
    process.exitCode=2;
  } else {
    runDemoProbe().then(result=>console.log(JSON.stringify(result,null,2))).catch(e=>{
      // Do not print the request URL: real API tokens must never enter CI logs.
      console.error('EODHD read-only demo probe FAILED: '+String(e?.message||e));
      process.exitCode=1;
    });
  }
}
