import {test} from "node:test";
import assert from "node:assert/strict";
import {fetchMarketUniverse} from "../engine/market-router.mjs";

const instrument={id:"local-x",symbol:"NEWCO.HE",name:"New Company",
  quantity:5,buyPrice:1.25,broker:"Private",account:"AOT",currency:"EUR",
  assetType:"stock",instrument:{mic:"XHEL",isin:"FI1234567890",providerSymbol:"NEWCO.HE"}};
const requested={
  isin:"FI1234567890",symbol:"NEWCO.HE",mic:"XHEL",currency:"EUR"
};
const now=Date.parse("2026-10-26T13:00:00Z");
function goodProvider(id="Test"){
  return {id,supports:()=>true,
    resolve:async()=>[requested],
    observe:async()=>({instrument:requested,price:20,currency:"EUR",provider:id,
      quote_at:now-120000,fetched_at:now})};
}

test("onboarding a never-hardcoded stock yields a priced observation",async()=>{
  const result=await fetchMarketUniverse([instrument],{
    providers:[goodProvider()],now
  });
  assert.equal(result.observations.length,1);
  assert.equal(result.observations[0].observation.price,20);
  assert.equal(result.issues.length,0);
  assert.equal(result.rejected.length,0);
});

test("provider only receives asset identity; no quantity, cost, broker or account",async()=>{
  let incoming="";
  const p=goodProvider();
  p.resolve=async i=>{
    incoming=JSON.stringify(i);
    return [requested];
  };
  await fetchMarketUniverse([instrument],{providers:[p],now});
  for(const forbidden of ["quantity","buyPrice","broker","account","Private","1.25"]){
    assert.equal(incoming.includes(forbidden),false);
  }
});

test("one source failure falls through to a second source without guessing prices",async()=>{
  const fail={...goodProvider("Fail"),observe:async()=>{throw Error("HTTP 429")}};
  const good=goodProvider("Backup");
  const result=await fetchMarketUniverse([instrument],{providers:[fail,good],now});
  assert.equal(result.observations.length,1);
  assert.equal(result.observations[0].observation.provider,"Backup");
});

test("wrong ISIN is rejected even if the ticker and name look identical",async()=>{
  const p=goodProvider();
  p.resolve=async()=>[{...requested,isin:"FI0000000000"}];
  const result=await fetchMarketUniverse([instrument],{providers:[p],now});
  assert.equal(result.observations.length,0);
  assert.equal(result.issues[0].status,"unavailable");
});

test("name-only fund selection cannot silently contaminate the portfolio",async()=>{
  const fund={id:"u",name:"Brand New Fund A",assetType:"fund",currency:"EUR",symbol:""};
  const p={id:"FundSource",supports:i=>i.type==="fund",
    resolve:async()=>[{name:"Brand New Fund A",currency:"EUR"}],
    observe:async()=>({price:10,currency:"EUR",nav_date:"22.10."})};
  const result=await fetchMarketUniverse([fund],{providers:[p],now});
  assert.equal(result.observations.length,0);
  assert.equal(result.issues[0].status,"needs_confirmation");
});

test("fund quote with exact identity carries NAV quality, not a fabricated trade time",async()=>{
  const fund={id:"u",name:"Brand New Fund A",assetType:"fund",currency:"EUR",symbol:"",
    instrument:{isin:"FI1234567890",shareClass:"A"}};
  const candidate={isin:"FI1234567890",shareClass:"A",currency:"EUR"};
  const p={id:"FundSource",supports:i=>i.type==="fund",
    resolve:async()=>[candidate],
    observe:async()=>({instrument:candidate,price:10,currency:"EUR",
      nav_date:"22.10.",fetched_at:now,provider:"FundSource"})};
  const result=await fetchMarketUniverse([fund],{providers:[p],now});
  assert.equal(result.observations.length,1);
  assert.equal(result.observations[0].observation.quality,"inferred_year_nav");
  assert.equal(result.observations[0].observation.quoteAt,null);
});

test("unsupported instruments are explicitly unavailable, not labeled successful",async()=>{
  const r=await fetchMarketUniverse([instrument],{providers:[],now});
  assert.equal(r.observations.length,0);
  assert.equal(r.issues[0].status,"unavailable");
});
