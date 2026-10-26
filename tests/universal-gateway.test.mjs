import {test} from "node:test";
import assert from "node:assert/strict";
import {createUniversalGateway} from "../workers/universal-market-gateway.mjs";
import {yahooAdapter} from "../workers/providers/yahoo-experimental.mjs";

const ORIGIN="https://osakevahti-alpha-naatti21.pages.dev";
const instrument={ticker:"WHATEVER.HE",currency:"EUR",type:"stock"};
const headers={Origin:ORIGIN,"Content-Type":"application/json"};
const now=Date.parse("2026-10-26T12:30:00Z");
const candidate={
  status:"candidate",price:4.5,currency:"EUR",provider:"test",
  quote_at:now-10*60000,fetched_at:now,
  instrument:{providerSymbol:"WHATEVER.HE",currency:"EUR",
    isin:null,mic:null},qualityNote:"no ISIN proof"
};
const fakeProvider={
  id:"fake",search:async q=>[{symbol:q.toUpperCase(),identityStatus:"provider-symbol-only"}],
  quote:async i=>({...candidate,instrument:{...candidate.instrument,providerSymbol:i.ticker}})
};
const app=createUniversalGateway({provider:fakeProvider});
const post=(body,appFn=app)=>appFn(new Request("https://example.workers.dev/v1/quotes",{
  method:"POST",headers,body:JSON.stringify(body)
}));
const get=(path,appFn=app)=>appFn(new Request("https://example.workers.dev"+path,{
  headers:{Origin:ORIGIN}
}));

test("search new unknown symbol without a hardcoded instrument list",async()=>{
  const r=await get("/v1/search?q=FICTIONAL123");
  assert.equal(r.status,200);
  assert.equal((await r.json()).candidates[0].symbol,"FICTIONAL123");
});

test("read-only gateway rejects portfolios and secret-bearing request keys",async()=>{
  for(const bad of [
    {holdings:[instrument]},{instruments:[{...instrument,quantity:45}]},
    {instruments:[{...instrument,buyPrice:23}]},
    {instruments:[{...instrument,account:"AOT"}]},
    {instruments:[{...instrument,broker:"Nordnet"}]},
    {instruments:[{...instrument,token:"SECRET"}]}
  ]){
    const r=await post(bad);
    assert.equal(r.status,400);
    assert.equal((await r.json()).error,"private_portfolio_fields_prohibited");
  }
});

test("quote request needs exact currency, bounded identities and small batch",async()=>{
  for(const body of [
    {instruments:[{...instrument,currency:""}]},
    {instruments:[{...instrument,ticker:"http://example.net/x"}]},
    {instruments:[{...instrument,currency:"BTCX"}]},
    {instruments:[{...instrument,extra:"bad"}]},
    {instruments:Array(9).fill(instrument)}
  ]){
    const response=await post(body);
    assert.equal(response.status,400);
  }
});

test("gateway does not elevate a provider price to verified portfolio NAV",async()=>{
  const r=await post({instruments:[instrument]});
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.results[0].status,"candidate");
  assert.equal(body.results[0].quote_at,now-10*60000);
  assert.equal(body.results[0].fetched_at,now);
  assert.equal(body.results[0].instrument.isin,null);
  assert.equal(body.disclaimer.includes("Candidate"),true);
  assert.equal(r.headers.get("cache-control"),"no-store");
});

test("cross-origin request cannot trigger provider calls",async()=>{
  let called=0;
  const handle=createUniversalGateway({provider:{...fakeProvider,quote:async()=>{called++;return candidate}}});
  const response=await handle(new Request("https://worker.dev/v1/quotes",{
    method:"POST",headers:{Origin:"https://evil.example","Content-Type":"application/json"},
    body:JSON.stringify({instruments:[instrument]})}));
  assert.equal(response.status,403);
  assert.equal(called,0);
});

test("missing data is unavailable, without inventing a quote or date",async()=>{
  const handle=createUniversalGateway({provider:{
    ...fakeProvider,quote:async()=>{throw Error("HTTP 429");}
  }});
  const r=await post({instruments:[instrument]},handle);
  const body=await r.json();
  assert.equal(body.results[0].status,"unavailable");
  assert.equal(body.results[0].price,undefined);
});

test("Yahoo source quote returns original market event time and read time separately",async()=>{
  const requests=[];
  const stub=async url=>{
    requests.push(String(url));
    return {ok:true,json:async()=>({chart:{result:[{
      meta:{symbol:"UNSEEN.HE",currency:"EUR",regularMarketPrice:8.2,
        regularMarketTime:1793013000},
      timestamp:[1793013000,1793013060],
      indicators:{quote:[{close:[8.0,8.3]}]}
    }]}})};
  };
  const provider=yahooAdapter({fetchImpl:stub,now:()=>now});
  const result=await provider.quote({type:"stock",ticker:"UNSEEN.HE",currency:"EUR"});
  assert.equal(result.status,"candidate");
  assert.equal(result.price,8.3);
  assert.equal(result.quote_at,1793013060000);
  assert.equal(result.fetched_at,now);
  assert.equal(result.instrument.isin,null);
  assert.equal(result.instrument.mic,null);
  assert.equal(new URL(requests[0]).hostname,"query1.finance.yahoo.com");
});

test("Yahoo candidate rejected when chart symbol or currency mismatches",async()=>{
  let meta={symbol:"WRONG.HE",currency:"EUR",regularMarketPrice:8,regularMarketTime:1793013000};
  const stub=async()=>({ok:true,json:async()=>({chart:{result:[{
    meta,timestamp:[1793013000],indicators:{quote:[{close:[8]}]}
  }]}})});
  const adapter=yahooAdapter({fetchImpl:stub,now:()=>now});
  assert.equal((await adapter.quote({type:"stock",ticker:"TEST.HE",currency:"EUR"})).reason,"symbol_mismatch");
  meta={...meta,symbol:"TEST.HE",currency:"USD"};
  assert.equal((await adapter.quote({type:"stock",ticker:"TEST.HE",currency:"EUR"})).reason,"currency_conflict");
});

test("fund NAV must come from an actual dated NAV provider, not a stock chart",async()=>{
  let called=0;
  const stub=async()=>{called++;throw Error("must not fetch");};
  const adapter=yahooAdapter({fetchImpl:stub});
  const q=await adapter.quote({type:"fund",ticker:"ABC.HE",currency:"EUR"});
  assert.equal(q.status,"unavailable");
  assert.equal(q.reason,"dated_fund_nav_provider_required");
  assert.equal(called,0);
});

test("provider search returns no invented ISIN, MIC or currency",async()=>{
  const stub=async()=>({ok:true,json:async()=>({quotes:[{
    symbol:"TEST.HE",quoteType:"EQUITY",shortname:"Test Oyj",exchange:"HEL"
  }]})});
  const adapter=yahooAdapter({fetchImpl:stub});
  const list=await adapter.search("test");
  assert.equal(list.length,1);
  assert.equal(list[0].isin,null);
  assert.equal(list[0].mic,null);
  assert.equal(list[0].currency,null);
  assert.equal(list[0].identityStatus,"provider-symbol-only");
});

test("invalid search and unknown URL are reported without leaking portfolio data",async()=>{
  assert.equal((await get("/v1/search?q=%3Cscript%3E")).status,400);
  assert.equal((await get("/random/path")).status,404);
  assert.equal((await get("/v1/search?q=x")).status,400);
});
