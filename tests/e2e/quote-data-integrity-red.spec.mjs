import {test,expect} from '@playwright/test';

// Strict synthetic feed boundary tests. These are intentionally RED against
// today's code and must NOT be merged/deployed as green. Never use user data.
const WORKER='https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**';
async function setup(page,{workerAssets={},marketQuotes={},fundQuotes={}}={}){
  const now=Date.now();
  await page.route(WORKER,route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({schema_version:'worker-v1.1',generated_at:new Date(now).toISOString(),
      assets:workerAssets,health:{ok:Object.keys(workerAssets).length,failed:0},errors:{}})
  }));
  await page.route('**/market-data.json*',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({generated_at:new Date(now).toISOString(),
      quotes:marketQuotes,fund_quotes:fundQuotes})
  }));
  await page.route('**/portfolio-status.json*',route=>route.fulfill({
    status:200,contentType:'application/json',body:'{"assets":{}}'
  }));
  await page.route('**/risk-data.json*',route=>route.fulfill({
    status:200,contentType:'application/json',body:'{"assets":{}}'
  }));
  await page.goto('/index.html');
}
async function refreshOne(page,{symbol='QAST',previousPrice=50,assetType='stock'}={}){
  return await page.evaluate(async arg=>{
    state.baseCurrency='EUR';
    state.holdings=[{id:'qa-synthetic-only',symbol:arg.symbol,name:'Synthetic QA',
      assetType:arg.assetType,quantity:2,buyPrice:40,currentPrice:arg.previousPrice,
      currency:'EUR',fxRate:1,quoteSource:'MANUAL',account:'AOT'}];
    await refreshMarket(false);
    return {price:state.holdings[0].currentPrice,
      source:state.holdings[0].quoteSource,
      timestamp:state.holdings[0].quoteTimestamp,
      savedPrice:JSON.parse(localStorage.getItem(KEY)).holdings[0].currentPrice};
  },{symbol,previousPrice,assetType});
}
test('control: legitimate positive price with a sane timestamp is accepted',async({page})=>{
  const now=Date.now();
  await setup(page,{workerAssets:{QAST:{
    price:72,quote_timestamp:now-60_000,day_change_pct:1,source:'Synthetic',
    currency:'EUR',delayed:false
  }}});
  const r=await refreshOne(page);
  expect(r.price).toBe(72);
  expect(r.savedPrice).toBe(72);
});
test('RED stock: negative Worker quote must never overwrite a last-known good price',async({page})=>{
  await setup(page,{workerAssets:{QAST:{
    price:-12.34,quote_timestamp:Date.now(),source:'Synthetic',currency:'EUR'
  }}});
  const r=await refreshOne(page);
  expect(r.price,'An impossible negative stock price must not be persisted').toBe(50);
});
test('RED fund: negative NAV cannot overwrite last-known good fund valuation',async({page})=>{
  await setup(page,{fundQuotes:{QAFUND:{
    price:-2.5,timestamp:Date.now(),nav_date:'2026-10-13',provider:'Synthetic NAV'
  }}});
  const r=await refreshOne(page,{symbol:'QAFUND',previousPrice:11,assetType:'fund'});
  expect(r.price,'An impossible negative fund NAV must not be persisted').toBe(11);
});
test('RED stock: explicit Worker quote currency mismatch cannot be silently ignored',async({page})=>{
  await setup(page,{workerAssets:{QAST:{
    price:120,quote_timestamp:Date.now(),source:'Synthetic',currency:'USD'
  }}});
  const r=await refreshOne(page);
  // Holding is recorded EUR, but provider explicitly says quote is USD.
  // There is no FX conversion of the *quote currency* at this step.
  expect(r.price,'EUR holding must not silently accept an explicitly USD-priced Worker quote').toBe(50);
});
test('RED stock: quote dated one day into the future must not supersede a known good price',async({page})=>{
  await setup(page,{workerAssets:{QAST:{
    price:140,quote_timestamp:Date.now()+24*60*60*1000,
    source:'Synthetic',currency:'EUR'
  }}});
  const r=await refreshOne(page);
  expect(r.price,'Future-dated stock quote must not be treated as a current valid observation').toBe(50);
});
