import {test,expect} from '@playwright/test';

// Additional reviewer-discovered route: portfolio-status.json can overwrite
// last-known-good holdings independently of refreshMarket(). Synthetic only.
async function exercise(page, quote) {
  const now=Date.now();
  await page.route('**/portfolio-status.json*',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({
      generated_at:new Date(now).toISOString(),
      assets:{QAST:quote}
    })
  }));
  await page.goto('/index.html');
  return await page.evaluate(async()=>{
    state.baseCurrency='EUR';
    state.holdings=[{id:'qa-secondary',symbol:'QAST',name:'Synthetic only',
      assetType:'stock',quantity:2,buyPrice:40,currentPrice:50,
      currency:'EUR',fxRate:1,quoteSource:'MANUAL',quoteTimestamp:Date.now()-3600000,
      account:'AOT'}];
    await loadSharedStatus(false);
    const h=state.holdings[0];
    const saved=JSON.parse(localStorage.getItem(KEY)).holdings[0];
    return {price:h.currentPrice,source:h.quoteSource,
      timestamp:h.quoteTimestamp,savedPrice:saved.currentPrice};
  });
}

test('secondary feed accepts later valid EUR price',async({page})=>{
  const r=await exercise(page,{price:72,currency:'EUR',quote_timestamp:Date.now(),source:'Synthetic'});
  expect(r.price).toBe(72);
  expect(r.savedPrice).toBe(72);
});
test('secondary feed must reject an explicit quote currency mismatch',async({page})=>{
  const r=await exercise(page,{price:120,currency:'USD',quote_timestamp:Date.now(),source:'Synthetic'});
  expect(r.price).toBe(50);
  expect(r.savedPrice).toBe(50);
  expect(r.source).toBe('MANUAL');
});
test('secondary feed must reject a future dated quote',async({page})=>{
  const r=await exercise(page,{price:130,currency:'EUR',quote_timestamp:Date.now()+86400000,source:'Synthetic'});
  expect(r.price).toBe(50);
  expect(r.savedPrice).toBe(50);
});
test('secondary feed must reject negative quote',async({page})=>{
  const r=await exercise(page,{price:-15,currency:'EUR',quote_timestamp:Date.now(),source:'Synthetic'});
  expect(r.price).toBe(50);
  expect(r.savedPrice).toBe(50);
});
