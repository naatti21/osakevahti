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
  const result=await page.evaluate(()=>fxRate('USD','EUR'));
  // A failed conversion should be an explicit error or unavailable value.
  // A success-looking rate of 1.0 misvalues all affected foreign holdings.
  expect(result,'Malformed FX JSON MUST NOT synthesize EUR/USD parity').not.toBe(1);
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
