import {test,expect} from '@playwright/test';

// Isolated RED audit of the current *production main source*.
// PR only: no application changes, no deployment, synthetic data only.
test('control: valid USD to EUR factor 0.82 is applied correctly',async({page})=>{
  await page.route('https://api.frankfurter.app/**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:'{"base":"USD","rates":{"EUR":0.82}}'
  }));
  await page.goto('/index.html');
  expect(await page.evaluate(()=>fxRate('USD','EUR'))).toBeCloseTo(0.82,10);
  expect(await page.evaluate(()=>fxRate('EUR','EUR'))).toBe(1);
});

test('RED production: absent USD/EUR rate must not become 1.0',async({page})=>{
  await page.route('https://api.frankfurter.app/**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:'{"base":"USD","rates":{}}'
  }));
  await page.goto('/index.html');
  let rate=null,failed=false;
  try{rate=await page.evaluate(()=>fxRate('USD','EUR'))}catch{failed=true}
  expect(failed||rate==null||Number.isNaN(rate),'Missing rate was silently interpreted as '+rate).toBe(true);
});

test('RED production: negative conversion factor must not be accepted',async({page})=>{
  await page.route('https://api.frankfurter.app/**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:'{"base":"USD","rates":{"EUR":-0.82}}'
  }));
  await page.goto('/index.html');
  let rate=null,failed=false;
  try{rate=await page.evaluate(()=>fxRate('USD','EUR'))}catch{failed=true}
  expect(failed||rate==null||Number.isNaN(rate),'Negative FX factor was accepted: '+rate).toBe(true);
});

test('RED production: unavailable USD FX cannot silently hide a position from the portfolio total',async({page})=>{
  await page.goto('/index.html');
  const result=await page.evaluate(()=>{
    state.baseCurrency='EUR';
    state.holdings=[
      {id:'qa-eur',symbol:'QA_EUR',name:'Synthetic EUR',quantity:1,buyPrice:100,
       currentPrice:100,assetType:'stock',currency:'EUR',fxRate:1,account:'AOT'},
      {id:'qa-usd',symbol:'QA_USD',name:'Synthetic USD',quantity:1,buyPrice:100,
       currentPrice:100,assetType:'stock',currency:'USD',fxRate:0,account:'AOT'}
    ];
    render();
    return {total:document.querySelector('#portfolioValue')?.textContent||'',
      number:document.querySelectorAll('#holdings .item').length};
  });
  expect(result.number).toBe(2);
  expect(result.total.replace(/[\u00a0\u202f]/g,' ').trim(),
    'Incomplete portfolio total displayed as whole: '+result.total).not.toMatch(/^100,00\s*€/);
});
