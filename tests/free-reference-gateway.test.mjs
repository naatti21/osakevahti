import {test} from "node:test";
import assert from "node:assert/strict";
import {createFreeReferenceGateway} from "../workers/free-reference-gateway.mjs";

const ORIGIN="https://osakevahti-alpha-naatti21.pages.dev";
const now=Date.parse("2026-10-26T13:00:00Z");
const ID="US4592001014";
let clock=now;
function fakeSources(){
  const calls={isin:0,fx:0};
  const identity={async lookupIsin(isin){
    calls.isin++;
    assert.equal(isin,ID);
    return {status:"candidates",requiresConfirmation:true,
      candidates:[{isinQuery:isin,figi:"BBG000BLNNH6",mic:null,currency:null,
        verifiedPrice:false,automaticBindingAllowed:false}]};
  }};
  const fx={async rate(base,quote){
    calls.fx++;
    assert.equal(base,"USD");assert.equal(quote,"EUR");
    return {status:"dated_reference",base,quote,rate:0.85,date:"2026-10-26",
      provider:"Frankfurter",intraday:false};
  }};
  return {calls,identity,fx};
}
const get=(path,handle,origin=ORIGIN)=>
  handle(new Request("https://gateway.example"+path,{headers:{Origin:origin}}));

test("valid ISIN produces only unverified mapping candidates, no price",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({...s,now:()=>clock});
  const r=await get("/v1/identity?isin="+ID,handle);
  const j=await r.json();
  assert.equal(r.status,200);
  assert.equal(j.provider,"OpenFIGI");
  assert.equal(j.verifiedPrice,false);
  assert.equal(j.automaticBindingAllowed,false);
  assert.equal(j.candidates[0].isinQuery,ID);
  assert.equal(j.candidates[0].mic,null);
  assert.equal(j.candidates[0].currency,null);
  assert.equal(s.calls.isin,1);
  assert.equal(r.headers.get("Cache-Control"),"no-store");
});

test("bad ISIN checksum is rejected before any upstream access",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({...s,now:()=>clock});
  const r=await get("/v1/identity?isin=US4592001015",handle);
  assert.equal(r.status,400);
  assert.equal((await r.json()).error,"invalid_isin_checksum");
  assert.equal(s.calls.isin,0);
});

test("ISIN identity success cache prevents repeat API calls",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({...s,now:()=>clock});
  const a=await get("/v1/identity?isin="+ID,handle);
  const b=await get("/v1/identity?isin="+ID,handle);
  assert.equal((await a.json()).cached,false);
  assert.equal((await b.json()).cached,true);
  assert.equal(s.calls.isin,1);
});

test("FX has explicit central bank reference date and no fake intraday label",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({...s,now:()=>clock});
  const r=await get("/v1/fx?base=USD&quote=EUR",handle);
  const j=await r.json();
  assert.equal(r.status,200);
  assert.equal(j.rate,0.85);
  assert.equal(j.date,"2026-10-26");
  assert.equal(j.intraday,false);
  assert.equal(j.paidSourceUsed,false);
  assert.equal(s.calls.fx,1);
});

test("unknown query keys cannot transmit portfolio fields to gateway",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({...s,now:()=>clock});
  for(const path of [
    "/v1/fx?base=USD&quote=EUR&quantity=10",
    "/v1/identity?isin="+ID+"&account=AOT",
    "/v1/identity?isin="+ID+"&isin="+ID,
    "/v1/fx?base=USD&quote=EUR&quote=SEK"
  ]){
    const r=await get(path,handle);
    assert.equal(r.status,400);
  }
  assert.equal(s.calls.isin,0);
  assert.equal(s.calls.fx,0);
});

test("cross-origin and POST are rejected before vendor requests",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({...s,now:()=>clock});
  assert.equal((await get("/v1/fx?base=USD&quote=EUR",handle,"https://other.example")).status,403);
  assert.equal((await handle(new Request("https://gateway.example/v1/identity?isin="+ID,
    {method:"POST",headers:{Origin:ORIGIN}}))).status,405);
  assert.equal(s.calls.isin,0);
  assert.equal(s.calls.fx,0);
});

test("free request budget is fail-closed, reset after one minute",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({...s,now:()=>clock});
  const currencies=["EUR","USD","SEK","GBP","NOK","CAD","CHF","JPY","DKK","AUD","NZD","PLN","CZK","HUF","RON","TRY"];
  const fx={...s.fx,async rate(base,quote){
    s.calls.fx++;
    return {status:"dated_reference",base,quote,rate:1.1,date:"2026-10-26",provider:"Frankfurter"};
  }};
  const gate=createFreeReferenceGateway({identity:s.identity,fx,now:()=>clock});
  for(const quote of currencies.slice(0,15)) {
    const r=await get("/v1/fx?base=USD&quote="+quote,gate);
    assert.equal(r.status,200);
  }
  const rejected=await get("/v1/fx?base=USD&quote=TRY",gate);
  assert.equal(rejected.status,429);
  assert.equal(rejected.headers.get("Retry-After")!==null,true);
  assert.equal(s.calls.fx,15);
  clock+=61000;
  assert.equal((await get("/v1/fx?base=USD&quote=TRY",gate)).status,200);
  clock=now;
});

test("concurrent requests for the same ISIN coalesce",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({...s,now:()=>clock});
  const responses=await Promise.all(
    Array.from({length:5},()=>get("/v1/identity?isin="+ID,handle))
  );
  assert.equal(responses.every(x=>x.status===200),true);
  assert.equal(s.calls.isin,1);
});

test("provider 429 returns non-price error and never exhausts paid quota",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({
    identity:{lookupIsin:async()=>{throw Error("source_http_429")}},
    fx:s.fx,now:()=>clock
  });
  const response=await get("/v1/identity?isin="+ID,handle);
  assert.equal(response.status,503);
  const data=await response.json();
  assert.equal(data.price,undefined);
  assert.equal(data.error,"free_source_unavailable");
});

test("OPTIONS preflight and unsupported paths preserve routing semantics",async()=>{
  const s=fakeSources(),handle=createFreeReferenceGateway({...s,now:()=>clock});
  const preflight=await handle(new Request("https://gateway.example/v1/fx",
    {method:"OPTIONS",headers:{Origin:ORIGIN}}));
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"),ORIGIN);
  assert.equal(await preflight.text(),"");
  assert.equal(await get("/v1/not-free",handle),null);
});
