import {test} from "node:test";
import assert from "node:assert/strict";
import {
  instrumentFromHolding, instrumentIdentityKey, buildMarketRequests,
  candidateDecision, normalizeObservation, navDayInfo, quoteFreshness
} from "../engine/market-core.mjs";

const sample=(overrides={})=>({
  id:"loc-1",assetType:"stock",symbol:"EXAMPLE.HE",
  name:"Example Oyj",currency:"EUR",quantity:120,buyPrice:9.35,
  account:"OST",broker:"Nordnet",importMeta:{secret:"do not send"},
  instrument:{mic:"XHEL",isin:"FI1234567890",providerSymbol:"EXAMPLE.HE"},
  ...overrides
});

test("unknown tickers are requests without a compiled ticker allowlist",()=>{
  const req=buildMarketRequests([
    sample({symbol:"ZZZ999.HE",instrument:{mic:"XHEL",providerSymbol:"ZZZ999.HE"}}),
    sample({id:"loc-2",symbol:"NEW-STARTUP.N",currency:"USD",
      instrument:{mic:"XNYS",providerSymbol:"NEW-STARTUP.N"}}),
    sample({id:"loc-3",assetType:"etf",symbol:"GLOBAL.AS",
      instrument:{mic:"XAMS",providerSymbol:"GLOBAL.AS",isin:"IE1234567890"}})
  ]);
  assert.equal(req.rejected.length,0);
  assert.equal(req.requests.length,3);
  assert.deepEqual(req.requests.map(x=>x.instrument.providerSymbol),
    ["ZZZ999.HE","NEW-STARTUP.N","GLOBAL.AS"]);
});

test("request payload contains no local portfolio amounts or personal account details",()=>{
  const raw=JSON.stringify(buildMarketRequests([sample()]));
  for(const secret of ["quantity","buyPrice","broker","account","120","9.35","do not send"]){
    assert.equal(raw.includes(secret),false,secret);
  }
});

test("identical positions share a quote without merging position data",()=>{
  const a=sample(),b=sample({id:"other-position",quantity:1,account:"AOT"});
  const req=buildMarketRequests([a,b]);
  assert.equal(req.requests.length,1);
  assert.equal(req.rejected.length,0);
});

test("same ticker on different venues and currencies must stay distinct",()=>{
  const a=instrumentFromHolding(sample({instrument:{mic:"XHEL",providerSymbol:"EXAMPLE"}}));
  const b=instrumentFromHolding(sample({instrument:{mic:"XSTO",providerSymbol:"EXAMPLE"}}));
  const c=instrumentFromHolding(sample({currency:"USD",instrument:{mic:"XHEL",providerSymbol:"EXAMPLE"}}));
  assert.notEqual(instrumentIdentityKey(a),instrumentIdentityKey(b));
  assert.notEqual(instrumentIdentityKey(a),instrumentIdentityKey(c));
});

test("fund without a fabricated ticker can still request identity search",()=>{
  const req=buildMarketRequests([sample({
    assetType:"fund",symbol:"",name:"Unlisted Nordic Fund A",
    instrument:{isin:"FI1234567890",shareClass:"A",companyName:"Unlisted Nordic Fund A"}
  })]);
  assert.equal(req.requests.length,1);
  assert.equal(req.requests[0].instrument.ticker,"");
  assert.equal(req.requests[0].instrument.type,"fund");
});

test("invalid/missing instrument identity is rejected, not patched to a known symbol",()=>{
  const req=buildMarketRequests([
    sample({currency:"",symbol:"",name:"",instrument:{}}),
    sample({currency:"BTC",instrument:{mic:"XHEL",providerSymbol:"@@INVALID"}})
  ]);
  assert.equal(req.requests.length,0);
  assert.equal(req.rejected.length,2);
});

test("candidate mismatch rejects wrong fund class, ISIN, currency and exchange",()=>{
  const wanted=instrumentFromHolding(sample({assetType:"fund",
    instrument:{isin:"FI1234567890",shareClass:"A",mic:"XHEL"}}));
  assert.equal(candidateDecision(wanted,{isin:"FI0000000000",currency:"EUR"}).reason,"isin_conflict");
  assert.equal(candidateDecision(wanted,{isin:"FI1234567890",currency:"USD"}).reason,"currency_conflict");
  assert.equal(candidateDecision(wanted,{isin:"FI1234567890",currency:"EUR",shareClass:"B"}).reason,"share_class_conflict");
  assert.equal(candidateDecision(wanted,{isin:"FI1234567890",currency:"EUR",mic:"XSTO"}).reason,"listing_conflict");
});

test("name-only candidate requires confirmation, not a guessed auto-match",()=>{
  const wanted=instrumentFromHolding(sample({assetType:"fund",symbol:"",
    instrument:{},name:"Fund A EUR"}));
  assert.equal(candidateDecision(wanted,{name:"Fund A EUR",currency:"EUR"}).status,"confirm");
});

test("a market trade has distinct fetched time and actual trade time",()=>{
  const at=Date.parse("2026-10-26T12:00:00Z");
  const i=instrumentFromHolding(sample({instrument:{mic:"XHEL",providerSymbol:"EXAMPLE.HE"}}));
  const q=normalizeObservation(i,{price:18.40,currency:"EUR",
    provider:"Test Feed",symbol:"EXAMPLE.HE",mic:"XHEL",
    quote_at:at-600000,fetched_at:at},at);
  assert.equal(q.status,"usable");
  assert.equal(q.quoteAt,at-600000);
  assert.equal(q.fetchedAt,at);
  assert.equal(q.quality,"dated_market_trade");
});

test("undated fund NAV is never turned into today's market timestamp",()=>{
  const now=Date.parse("2026-10-26T12:00:00Z");
  const fund=instrumentFromHolding(sample({
    assetType:"fund",symbol:"",instrument:{isin:"FI1234567890"}}));
  const q=normalizeObservation(fund,{price:23.5,currency:"EUR",
    isin:"FI1234567890",provider:"Fund Source",fetched_at:now,nav_date:""},now);
  assert.equal(q.status,"usable");
  assert.equal(q.quoteAt,null);
  assert.equal(q.navDate,null);
  assert.equal(q.quality,"undated_nav");
  assert.equal(quoteFreshness(q,null,now).status,"unverified");
});

test("a yearless NAV has clearly inferred year, including around New Year",()=>{
  const now=Date.parse("2027-01-02T13:00:00Z");
  const nav=navDayInfo("31.12.",now);
  assert.equal(nav.date,"2026-12-31");
  assert.equal(nav.yearInferred,true);
  assert.equal(nav.verified,false);
  assert.equal(navDayInfo("31.02.",now),null);
  assert.equal(navDayInfo("2026-12-31",now).verified,true);
});

test("provider trade delay and actual session time determine quote freshness",()=>{
  const now=Date.parse("2026-10-26T13:00:00Z");
  const obs={status:"usable",quality:"dated_market_trade",quoteAt:now-25*60000};
  const session={status:"open",openedAt:now-4*3600000,providerDelayMinutes:30,openingGraceMinutes:0};
  assert.equal(quoteFreshness(obs,session,now).status,"current");
  session.providerDelayMinutes=15;
  assert.equal(quoteFreshness(obs,session,now).status,"stale");
  session.status="holiday";
  assert.equal(quoteFreshness(obs,session,now).status,"last_session");
});

test("opening grace prevents false price failures at the opening bell",()=>{
  const now=Date.parse("2026-10-26T13:30:00Z");
  const obs={status:"usable",quality:"dated_market_trade",quoteAt:now-3*86400000};
  const session={status:"open",openedAt:now,providerDelayMinutes:15,openingGraceMinutes:20};
  assert.equal(quoteFreshness(obs,session,now).status,"opening_grace");
});

test("unknown market hours mean unknown freshness, not a fabricated error",()=>{
  const now=Date.parse("2026-10-26T13:00:00Z");
  const obs={status:"usable",quality:"dated_market_trade",quoteAt:now-5*3600000};
  assert.equal(quoteFreshness(obs,null,now).status,"unverified");
});
