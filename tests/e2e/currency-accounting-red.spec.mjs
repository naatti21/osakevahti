import { test, expect } from '@playwright/test';

// Independent numerical oracle checks for financial safety. Test-only branch.
// Uses synthetic data and mock responses; never reads user data.
// P1 desired contract: a malformed FX response must NOT silently become 1.0.
// This is intentionally RED against Alpha3, not a release-ready application change.

test('valid USD -> EUR data returns the supplied 0.82 conversion factor', async ({page}) => {
  await page.route('https://api.frankfurter.app/**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({amount:1,base:'USD',rates:{EUR:0.82}})
  }));
  await page.goto('/index.html');
  expect(await page.evaluate(()=>fxRate('USD','EUR'))).toBeCloseTo(0.82,10);
  expect(await page.evaluate(()=>fxRate('EUR','EUR'))).toBe(1);
});

test('RED safety contract: missing USD -> EUR conversion must not impersonate 1:1 parity', async ({page}) => {
  await page.route('https://api.frankfurter.app/**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({amount:1,base:'USD',rates:{}})
  }));
  await page.goto('/index.html');
  let result=null,rejected=false;
  try{result=await page.evaluate(()=>fxRate('USD','EUR'))}
  catch{rejected=true}
  // Strict contract: reject explicitly or return an unavailable value.
  // A plausible numeric conversion is NOT acceptable when the rate is absent.
  expect(rejected||result==null||Number.isNaN(result),
    'Malformed FX JSON must be rejected, not treated as valid rate '+result).toBe(true);
});

test('audit demonstration: current-FX cost basis omits historical purchase currency movement',async({page})=>{
  await page.goto('/index.html');
  const audit=await page.evaluate(()=>{
    // No storage write. Models a synthetic foreign-currency position only.
    const holding={id:'QA-FX-SYNTHETIC',symbol:'QAUSD',name:'Synthetic USD stock',
      assetType:'stock',quantity:10,buyPrice:100,currentPrice:100,
      currency:'USD',fxRate:0.90,quoteSource:'MANUAL',
      account:'AOT',accountType:'AOT',broker:'Synthetic',accountDetailsConfirmed:true};
    state.holdings=[holding];
    state.baseCurrency='EUR';
    state.showDetails=true;
    render();
    return {rowText:document.querySelector('#holdings .item')?.innerText||''};
  });
  // Independent accounting oracle: historical buy FX 0.80 EUR/USD;
  // current FX 0.90 EUR/USD; no stock-price change.
  const quantity=10,usdPrice=100,purchaseFX=0.80,currentFX=0.90;
  const historicalCostEur=quantity*usdPrice*purchaseFX;
  const currentValueEur=quantity*usdPrice*currentFX;
  expect(currentValueEur-historicalCostEur).toBe(100);
  // The current app calls both values "Tuotto" but uses currentFX for BOTH,
  // so it reports 0 euro for this case instead of any purchase-date FX impact.
  expect(audit.rowText).toContain('Tuotto');
  expect(audit.rowText).toMatch(/0[,\.]00/);
  console.log('KNOWN LIMITATION: local-currency-only gain zero; true historical-FX EUR gain +100.00 for synthetic case. Purchase FX absent from model.');
});


// Additional independent FX-error matrix. Expected RED means a genuine defect,
// not a waiver. Either throwing or an explicitly unavailable return is valid.
for (const scenario of [
  {name:'missing rates key',data:{base:'USD'}},
  {name:'zero numeric rate',data:{base:'USD',rates:{EUR:0}}},
  {name:'negative numeric rate',data:{base:'USD',rates:{EUR:-0.8}}},
  {name:'non-numeric rate',data:{base:'USD',rates:{EUR:'unavailable'}}}
]){
  test('RED FX boundary: '+scenario.name+' cannot produce a usable conversion factor',async({page})=>{
    await page.route('https://api.frankfurter.app/**',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify(scenario.data)
    }));
    await page.goto('/index.html');
    let result,failed=false;
    try { result=await page.evaluate(()=>fxRate('USD','EUR')); }
    catch { failed=true; }
    const unavailable=failed||result==null||Number.isNaN(result);
    expect(unavailable,'Invalid FX response was accepted as a conversion factor: '+String(result)).toBe(true);
  });
}

test('RED FX HTTP: a 503 response with plausible data must not be treated as success',async({page})=>{
  await page.route('https://api.frankfurter.app/**',route=>route.fulfill({
    status:503,contentType:'application/json',
    body:JSON.stringify({base:'USD',rates:{EUR:0.84}})
  }));
  await page.goto('/index.html');
  let failed=false;
  try { await page.evaluate(()=>fxRate('USD','EUR')); }
  catch { failed=true; }
  expect(failed,'Non-2xx FX fetch cannot be accepted as valid conversion').toBe(true);
});

test('control: malformed JSON in FX provider is rejected',async({page})=>{
  await page.route('https://api.frankfurter.app/**',route=>route.fulfill({
    status:200,contentType:'application/json',body:'{invalid JSON'
  }));
  await page.goto('/index.html');
  await expect(page.evaluate(()=>fxRate('USD','EUR'))).rejects.toThrow();
});

test('control: failed FX network request propagates an error',async({page})=>{
  await page.route('https://api.frankfurter.app/**',route=>route.abort('failed'));
  await page.goto('/index.html');
  await expect(page.evaluate(()=>fxRate('USD','EUR'))).rejects.toThrow();
});

test('RED integration: refresh cannot save invented 1:1 currency rate to persisted holding',async({page})=>{
  await page.route('https://api.frankfurter.app/**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({base:'USD',rates:{}})
  }));
  await page.route('https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**',
    route=>route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({assets:{},health:{ok:0,failed:0}})}));
  await page.route('**/market-data.json*',
    route=>route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({quotes:{},fund_quotes:{}})}));
  await page.route('**/portfolio-status.json*',
    route=>route.fulfill({status:200,contentType:'application/json',body:'{"assets":{}}'}));
  await page.route('**/risk-data.json*',
    route=>route.fulfill({status:200,contentType:'application/json',body:'{"assets":{}}'}));
  await page.goto('/index.html');
  const observed=await page.evaluate(async()=>{
    state.baseCurrency='EUR';
    state.holdings=[{id:'qa-fx-usd',symbol:'ZZUSDX',name:'Synthetic USD',
      assetType:'stock',quantity:5,buyPrice:100,currentPrice:100,
      currency:'USD',fxRate:0.82,quoteSource:'MANUAL',account:'AOT'}];
    await refreshMarket(false);
    const saved=JSON.parse(localStorage.getItem(KEY));
    return {inMemory:state.holdings[0].fxRate,saved:saved.holdings[0].fxRate};
  });
  expect(observed.inMemory,'Rejected FX data must not silently replace a good factor with 1').not.toBe(1);
  expect(observed.saved,'Rejected FX data must not persist invented parity').not.toBe(1);
});

test('RED aggregation: absent currency rate cannot silently show an incomplete total as complete',async({page})=>{
  await page.goto('/index.html');
  const observed=await page.evaluate(()=>{
    state.baseCurrency='EUR';state.showDetails=false;
    state.holdings=[
      {id:'qa-eur',symbol:'ZZEU',name:'Synthetic EUR',quantity:1,buyPrice:100,
       currentPrice:100,assetType:'stock',currency:'EUR',fxRate:1,account:'AOT'},
      {id:'qa-usd',symbol:'ZZUSD',name:'Synthetic USD',quantity:1,buyPrice:100,
       currentPrice:100,assetType:'stock',currency:'USD',fxRate:0,account:'AOT'}
    ];
    render();
    return {total:document.querySelector('#portfolioValue')?.textContent||'',
      cardCount:document.querySelectorAll('#holdings .item').length};
  });
  expect(observed.cardCount).toBe(2);
  // This total excludes the existing USD position because fxRate=0. An
  // unqualified EUR-only subtotal must not be labeled a full portfolio total.
  const formatted=observed.total.replace(/[\u00a0\u202f]/g,' ').trim();
  expect(formatted,'Portfolio hides unconvertible holding in total without a warning')
    .not.toMatch(/^100,00\s*€/);
});
