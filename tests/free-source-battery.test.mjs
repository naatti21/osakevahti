import {test} from "node:test";
import assert from "node:assert/strict";
import {
  ZERO_COST_SOURCES,freeSourceStatus,eligibleFreeSources,
  uniqueSourceLineages,withinFreeBudget,labelSourceEvidence
} from "../engine/free-source-policy.mjs";
import {openFigiFree,frankfurterFreeFx} from "../workers/providers/free-foundation.mjs";

test("source catalogue never declares paid subscriptions as a free fallback",()=>{
  for(const item of ZERO_COST_SOURCES)assert.equal(item.monthlyEuroCost,0);
  const approved=eligibleFreeSources();
  assert.deepEqual(approved.map(x=>x.id),["openfigi-public","frankfurter"]);
  assert.equal(freeSourceStatus({monthlyEuroCost:1,enabledByDefault:true,
    terms:"documented-public-free"}).usable,false);
  assert.equal(freeSourceStatus({monthlyEuroCost:0,requiresPaidSubscription:true,
    enabledByDefault:true,terms:"documented-public-free"}).usable,false);
});

test("free source selection is capability-aware, not linked to holding tickers",()=>{
  assert.deepEqual(eligibleFreeSources(undefined,{role:"fx"}).map(x=>x.id),["frankfurter"]);
  assert.deepEqual(eligibleFreeSources(undefined,{role:"identity",assetType:"fund"}).map(x=>x.id),["openfigi-public"]);
  assert.deepEqual(eligibleFreeSources(undefined,{role:"quote"}),[]);
});

test("Yahoo Worker and Yahoo GitHub feed are one price lineage, not two independent confirmations",()=>{
  const refs=uniqueSourceLineages([
    {lineage:"yahoo",transport:"cloudflare"},
    {lineage:"yahoo",transport:"github"},
    {lineage:"finnhub",transport:"cloudflare"},
    {lineage:"",transport:"mystery"}
  ]);
  assert.deepEqual(refs.map(x=>x.lineage),["yahoo","finnhub"]);
});

test("quota exhaustion stops requests instead of triggering paid plan",()=>{
  assert.equal(withinFreeBudget({used:24,charge:1,limit:25}).allowed,true);
  assert.equal(withinFreeBudget({used:25,charge:1,limit:25}).allowed,false);
  assert.equal(withinFreeBudget({used:-1,charge:1,limit:25}).allowed,false);
});

test("source label distinguishes NAV, dated market quote and daily FX",()=>{
  assert.equal(labelSourceEvidence({kind:"fund-nav"}).label,"NAV date missing");
  assert.equal(labelSourceEvidence({kind:"quote",fetchedAt:Date.now()}).verifiedTradeTime,false);
  assert.equal(labelSourceEvidence({kind:"fx",valuationDate:"2026-10-26"}).label,"Daily reference FX");
});

test("OpenFIGI maps an arbitrary ISIN without sending portfolio amounts",async()=>{
  const requests=[];
  const api=openFigiFree({fetchImpl:async(url,options)=>{
    requests.push({url,options});
    return {ok:true,json:async()=>[{data:[{
      figi:"BBG000BLNNH6",ticker:"IBM",exchCode:"US",
      name:"INTERNATIONAL BUSINESS MACHINES",
      shareClassFIGI:"BBG001S5S399",compositeFIGI:"BBG000BLNNH6"
    }]}]};
  }});
  const result=await api.lookupIsin("US4592001014");
  assert.equal(result.status,"candidates");
  assert.equal(result.candidates[0].automaticBindingAllowed,false);
  assert.equal(result.candidates[0].mic,null);
  assert.equal(result.candidates[0].currency,null);
  assert.equal(requests[0].url,"https://api.openfigi.com/v3/mapping");
  const request=JSON.stringify(requests[0].options.body);
  assert.equal(request.includes("US4592001014"),true);
  for(const sensitive of ["quantity","buyPrice","account","portfolio","broker","secret"])
    assert.equal(request.includes(sensitive),false);
});

test("OpenFIGI never turns missing candidates into verified identity",async()=>{
  const api=openFigiFree({fetchImpl:async()=>({ok:true,json:async()=>[{error:"No identifier found."}]})});
  const out=await api.lookupIsin("FI4000602453");
  assert.equal(out.status,"unavailable");
  assert.equal(out.candidates.length,0);
});

test("Frankfurter v2 matches pair, date and positive reference rate",async()=>{
  const now=Date.parse("2026-10-26T16:00:00Z");
  const urls=[];
  const fx=frankfurterFreeFx({now:()=>now,fetchImpl:async url=>{
    urls.push(url);
    return {ok:true,json:async()=>({base:"USD",quote:"EUR",rate:0.86,date:"2026-10-26"})};
  }});
  const out=await fx.rate("usd","eur");
  assert.equal(out.rate,0.86);
  assert.equal(out.status,"dated_reference");
  assert.equal(out.intraday,false);
  assert.equal(urls[0],"https://api.frankfurter.dev/v2/rate/usd/eur");
});

test("Frankfurter rejects mismatched, undated, invalid and negative FX observations",async()=>{
  const now=Date.parse("2026-10-26T16:00:00Z");
  for(const d of [
    {base:"EUR",quote:"USD",rate:1.14,date:"2026-10-26"},
    {base:"USD",quote:"EUR",rate:-0.86,date:"2026-10-26"},
    {base:"USD",quote:"EUR",rate:0.86,date:"2026-02-30"},
    {base:"USD",quote:"EUR",rate:0.86,date:""}
  ]){
    const fx=frankfurterFreeFx({now:()=>now,fetchImpl:async()=>({ok:true,json:async()=>d})});
    const out=await fx.rate("USD","EUR");
    assert.equal(out.status,"rejected");
  }
});

test("Frankfurter same-currency identity does not call an external provider",async()=>{
  let calls=0;
  const fx=frankfurterFreeFx({fetchImpl:async()=>{calls++;throw Error("should not run")}});
  const out=await fx.rate("EUR","EUR");
  assert.equal(out.rate,1);
  assert.equal(calls,0);
});

test("HTTP errors remain errors; do not manufacture an FX parity rate",async()=>{
  const fx=frankfurterFreeFx({fetchImpl:async()=>({ok:false,status:429})});
  await assert.rejects(fx.rate("USD","EUR"),/source_http_429/);
});
