import {test,expect} from '@playwright/test';

const fxApi='https://api.frankfurter.dev/v1/latest**';
async function mockFeeds(page){
  const now=Date.now(),iso=new Date(now).toISOString();
  await page.route('https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({schema_version:'worker-v1.1',generated_at:iso,assets:{
      QAST:{price:100,currency:'USD',source:'QA',quote_timestamp:now-60000,day_change_pct:0}
    },health:{ok:1,failed:0}})
  }));
  await page.route('**/market-data.json*',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({generated_at:iso,quotes:{},fund_quotes:{}})
  }));
  for(const file of ['portfolio-status.json','risk-data.json']){
    await page.route('**/'+file+'*',route=>route.fulfill({status:200,contentType:'application/json',body:'{"assets":{}}'}));
  }
}
async function prepareSyntheticUSD(page){
  await page.goto('/index.html');
  return page.evaluate(()=>{
    state.baseCurrency='EUR';
    state.holdings=[{id:'qa-fx-only',name:'Synthetic USD holding',symbol:'QAST',assetType:'stock',
      currency:'USD',quantity:1,buyPrice:90,currentPrice:100,fxRate:0.82,fxRateStatus:'stale',
      account:'AOT',accountType:'AOT',accountDetailsConfirmed:true}];
    render();
    return {warning:!document.querySelector('#valuationWarning').classList.contains('hidden')};
  });
}
test('browser fetch from official direct FX v1 works without redirect or keys',async({page})=>{
  test.setTimeout(40_000);
  await page.goto('/index.html');
  const output=await page.evaluate(async()=>{
    try{return {rate:await fxRate('USD','EUR')}}
    catch(err){return {error:String(err)}}
  });
  expect(output.error,'Official direct FX domain must be available in browser').toBeUndefined();
  expect(output.rate).toBeGreaterThan(0);
  expect(output.rate).toBeLessThan(2);
});
test('manual refresh shows progress and clears stale FX when provider succeeds',async({page})=>{
  await mockFeeds(page);
  await page.route(fxApi,route=>route.fulfill({status:200,contentType:'application/json',
    body:'{"base":"USD","rates":{"EUR":0.90}}'}));
  const seed=await prepareSyntheticUSD(page);
  expect(seed.warning).toBe(true);
  await page.locator('#refreshBtn').click();
  await expect(page.locator('#refreshFeedback')).toContainText('Päivitys valmis:',{timeout:20000});
  await expect(page.locator('#refreshFeedback')).toContainText('valuuttaparit 1/1');
  await expect(page.locator('#valuationWarning')).toHaveClass(/hidden/);
  const h=await page.evaluate(()=>state.holdings[0]);
  expect(h.fxRate).toBeCloseTo(0.90);
  expect(h.fxRateStatus).toBe('fresh');
  expect(await page.locator('#refreshBtn').textContent()).toBe('↻');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).holdings[0].fxRate)).toBeCloseTo(0.90);
});
test('manual refresh reports FX HTTP error instead of appearing to do nothing',async({page})=>{
  await mockFeeds(page);
  await page.route(fxApi,route=>route.fulfill({status:503,contentType:'application/json',
    body:'{"error":"test-unavailable"}'}));
  await prepareSyntheticUSD(page);
  await page.locator('#refreshBtn').click();
  await expect(page.locator('#refreshFeedback')).toContainText('Päivitys valmis:',{timeout:20000});
  await expect(page.locator('#refreshFeedback')).toContainText('Valuuttakurssien virheet: USD/EUR');
  await expect(page.locator('#refreshFeedback')).toContainText('HTTP 503');
  await expect(page.locator('#valuationWarning')).not.toHaveClass(/hidden/);
  const h=await page.evaluate(()=>state.holdings[0]);
  expect(h.fxRate).toBeCloseTo(0.82);
  expect(h.fxRateStatus).toBe('stale');
});