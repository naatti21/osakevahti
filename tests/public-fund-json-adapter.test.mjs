import {test} from "node:test";
import assert from "node:assert/strict";
import {
  fundJsonRow,indexPublicFundJson,createRahastoraporttiPublicSource,PUBLIC_FUND_JSON_URL
} from "../workers/providers/rahastoraportti-public.mjs";
import {createFundNavAdapter} from "../workers/providers/fund-nav-contract.mjs";
import worker from "../workers/universal-market-gateway.mjs";

const at=Date.parse("2026-10-26T12:00:00Z");
const isin="IE00B03HD191",otherIsin="SE0013801453";
const item=(over={})=>({
  ISIN:isin,currency:"EUR",closePrice:"271.3100000000000",
  closePriceDate:"20261023",companyNameFi:"Unseen Synthetic Fund A EUR",
  companyNameEn:"Unseen Synthetic Fund A EUR",fundCode:"CODE-123",
  class:{fi:"A",en:"A",sv:"A"},...over
});
function sourceFake(rows) {
  let calls=0;
  const fetchImpl=async(url)=>{
    calls++;
    assert.equal(url,PUBLIC_FUND_JSON_URL);
    return new Response(JSON.stringify(rows),{status:200,
      headers:{"Content-Type":"application/octet-stream"}});
  };
  return {fetchImpl,get calls(){return calls}};
}

test("real JSON schema YYYYMMDD and precision-string NAV become validated values",()=>{
  const out=fundJsonRow(item(),at);
  assert.equal(out.isin,isin);
  assert.equal(out.navDate,"2026-10-23");
  assert.equal(out.price,271.31);
  assert.equal(out.currency,"EUR");
});

test("public fund index uses actual ISIN; no name matching or code allowlist",()=>{
  const data=indexPublicFundJson([
    item(),item({ISIN:otherIsin,companyNameFi:"Another New Fund",closePrice:"113.42"})
  ],at);
  assert.equal(data.index.size,2);
  assert.equal(data.index.get(isin).price,271.31);
  assert.equal(data.index.get(otherIsin).price,113.42);
});

test("duplicate ISIN is ambiguous, never take arbitrary first NAV",()=>{
  const data=indexPublicFundJson([item(),item({closePrice:"999.99"})],at);
  assert.equal(data.index.has(isin),true);
  assert.equal(data.index.get(isin),null);
});

test("invalid calendar day, missing currency and zero/negative price cannot become NAV",()=>{
  for(const raw of [
    item({closePriceDate:"20260230"}),
    item({closePriceDate:"20281023"}),
    item({closePriceDate:""}),
    item({currency:""}),
    item({closePrice:"0"}),
    item({closePrice:"-12.34"})
  ]) assert.equal(fundJsonRow(raw,at),null);
});

test("one global 2k-row source read shared across multiple unknown funds for a day",async()=>{
  const transport=sourceFake([
    item(),item({ISIN:otherIsin,closePrice:"123.45",
      companyNameFi:"Another Nonlisted Brand New Fund"})
  ]);
  let clock=at;
  const source=createRahastoraporttiPublicSource({
    fetchImpl:transport.fetchImpl,now:()=>clock});
  const a=await source.getNav({isin});
  const b=await source.getNav({isin:otherIsin});
  assert.equal(a.price,271.31);
  assert.equal(b.price,123.45);
  assert.equal(a.navDate,"2026-10-23");
  assert.equal(a.sourceKind,"public-web-publication");
  assert.equal(a.requiresManualReview,true);
  assert.equal(transport.calls,1);
  clock+=23*60*60*1000;
  await source.getNav({isin});
  assert.equal(transport.calls,1);
  clock+=2*60*60*1000;
  await source.getNav({isin});
  assert.equal(transport.calls,2);
});

test("source search returns candidates by name or exact ISIN without ticker lists",async()=>{
  const t=sourceFake([item(),item({ISIN:otherIsin,companyNameFi:"Synthetic Scandinavian Equity"})]);
  const p=createRahastoraporttiPublicSource({fetchImpl:t.fetchImpl,now:()=>at});
  const results=await p.search("Synthetic Scandinavian");
  assert.equal(results.length,1);
  assert.equal(results[0].isin,otherIsin);
  assert.equal(results[0].identityStatus,"public-isin-candidate");
});

test("strict fund contract accepts verified exact ISIN with source-date and review flag",async()=>{
  const t=sourceFake([item()]);
  const src=createRahastoraporttiPublicSource({fetchImpl:t.fetchImpl,now:()=>at});
  const nav=createFundNavAdapter({source:src,now:()=>at});
  const result=await nav.quote({type:"fund",isin,shareClass:"A",currency:"EUR"});
  assert.equal(result.status,"candidate");
  assert.equal(result.nav_date,"2026-10-23");
  assert.equal(result.sourceKind,"public-web-publication");
  assert.equal(result.requiresManualReview,true);
});

test("wrong currency and ISIN ambiguity keep public source out of portfolio",async()=>{
  const t=sourceFake([item(),item({closePrice:"999.99"})]);
  const p=createRahastoraporttiPublicSource({fetchImpl:t.fetchImpl,now:()=>at});
  await assert.rejects(p.getNav({isin}),/fund_isin_ambiguous/);
  const k=sourceFake([item()]);
  const src=createRahastoraporttiPublicSource({fetchImpl:k.fetchImpl,now:()=>at});
  const nav=createFundNavAdapter({source:src,now:()=>at});
  assert.equal((await nav.quote({type:"fund",isin,currency:"USD"})).reason,"currency_mismatch");
});

test("released Worker never activates fund backup without a deliberate environment flag",async()=>{
  const r=await worker.fetch(new Request("https://example.workers.dev/v1/quotes",{
    method:"POST",headers:{"Origin":"https://osakevahti-alpha-naatti21.pages.dev",
      "Content-Type":"application/json"},
    body:JSON.stringify({instruments:[{ticker:"",isin,type:"fund",currency:"EUR"}]})
  }),{});
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,"quote_source_not_qualified");
});
