import {test} from "node:test";
import assert from "node:assert/strict";
import {previewGatewayQuotes} from "../engine/gateway-preview.mjs";

const url="https://dev.example.workers.dev";
const holdings=[
  {id:"p1",symbol:"RANDOM.HE",name:"Fictional",assetType:"stock",currency:"EUR",
    account:"OST",broker:"Nordnet",buyPrice:19.75,quantity:120,
    instrument:{mic:"XHEL",providerSymbol:"RANDOM.HE"}},
  {id:"p2",symbol:"RANDOM.HE",name:"Fictional",assetType:"stock",currency:"EUR",
    account:"AOT",broker:"Another Bank",buyPrice:5.25,quantity:80,
    instrument:{mic:"XHEL",providerSymbol:"RANDOM.HE"}}
];
function transport({mutate=null,fail=false}={}){
  const bodies=[];
  const fetchImpl=async (address,opts)=>{
    assert.equal(new URL(address).pathname,"/v1/quotes");
    assert.equal(opts.cache,"no-store");
    const body=JSON.parse(opts.body);bodies.push(body);
    if(fail)return {ok:false,status:503};
    const results=body.instruments.map((i,index)=>({
      index,status:"candidate",
      requested:{ticker:i.ticker,type:i.type,currency:i.currency},
      price:8,currency:i.currency,provider:"test-provider",
      quote_at:1793010000000,fetched_at:1793013000000,
      instrument:{providerSymbol:i.ticker,currency:i.currency,isin:i.isin||null,mic:null}
    })).map(mutate||((x)=>x));
    return {ok:true,json:async()=>({results})};
  };
  return {fetchImpl,bodies};
}
test("multiple positions produce one dynamic quote request without personal portfolio data",async()=>{
  const t=transport();
  const result=await previewGatewayQuotes(holdings,{gatewayUrl:url,fetchImpl:t.fetchImpl});
  assert.equal(t.bodies.length,1);
  assert.equal(t.bodies[0].instruments.length,1);
  const sent=JSON.stringify(t.bodies);
  for(const forbidden of ["quantity","120","80","buyPrice","19.75","5.25","broker","account","Another Bank","OST"])
    assert.equal(sent.includes(forbidden),false,forbidden);
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].portfolioWriteAllowed,false);
  assert.equal(result.candidates[0].reviewRequired,true);
});

test("unknown arbitrarily named ETF does not require editing a code list",async()=>{
  const t=transport();
  const result=await previewGatewayQuotes([{id:"x",assetType:"etf",symbol:"UNHEARD.XL",
    currency:"EUR",instrument:{mic:"XLON",providerSymbol:"UNHEARD.XL"}}],
    {gatewayUrl:url,fetchImpl:t.fetchImpl});
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].instrument.ticker,"UNHEARD.XL");
});

test("gateway refusal never alters the original holdings",async()=>{
  const original=structuredClone(holdings);
  const t=transport({fail:true});
  const result=await previewGatewayQuotes(holdings,{gatewayUrl:url,fetchImpl:t.fetchImpl});
  assert.deepEqual(holdings,original);
  assert.equal(result.candidates.length,0);
  assert.equal(result.issues.length,1);
});

test("bad quote symbol or currency is rejected, never silently used",async()=>{
  for(const mutate of [
    x=>({...x,currency:"USD"}),
    x=>({...x,instrument:{...x.instrument,providerSymbol:"WRONG.HE"}}),
    x=>({...x,price:0})
  ]){
    const t=transport({mutate});
    const result=await previewGatewayQuotes(holdings,
      {gatewayUrl:url,fetchImpl:t.fetchImpl});
    assert.equal(result.candidates.length,0);
    assert.equal(result.issues[0].status,"rejected");
  }
});

test("fund without symbol and ISIN cannot be sent to quote gateway",async()=>{
  const t=transport();
  const fund={assetType:"fund",name:"Undetermined Class A",currency:"EUR",symbol:"",
    quantity:4,account:"Nordnet"};
  const result=await previewGatewayQuotes([fund],{gatewayUrl:url,fetchImpl:t.fetchImpl});
  assert.equal(result.candidates.length,0);
  assert.equal(t.bodies.length,0);
  assert.equal(result.issues[0].status,"needs_instrument_resolution");
});

test("request batches are capped at 8 and responses match indexes",async()=>{
  const t=transport();
  const fundList=Array.from({length:19},(_,i)=>({id:"h"+i,assetType:"stock",
    name:"Synthetic "+i,symbol:"TEST"+i+".HE",currency:"EUR"}));
  const result=await previewGatewayQuotes(fundList,{gatewayUrl:url,fetchImpl:t.fetchImpl});
  assert.deepEqual(t.bodies.map(x=>x.instruments.length),[8,8,3]);
  assert.equal(result.candidates.length,19);
});
