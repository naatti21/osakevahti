import {test,expect} from '@playwright/test';

// Independent follow-up safety review of OLD persisted client-side portfolio
// data. Synthetic only. No user backup or holdings are used.
async function stateAsRendered(page,holdings){
  await page.goto('/index.html');
  return await page.evaluate(rows=>{
    state.baseCurrency='EUR';state.holdings=rows;state.showDetails=true;render();
    return {
      total:document.querySelector('#portfolioValue')?.textContent||'',
      profit:document.querySelector('#portfolioProfit')?.textContent||'',
      warning:document.querySelector('#valuationWarning')?.textContent||'',
      warningVisible:!document.querySelector('#valuationWarning')?.classList.contains('hidden'),
      row:document.querySelector('#holdings .item')?.innerText||''
    };
  },holdings);
}
function foreign(overrides={}){
  return {id:'synthetic-foreign',symbol:'QAUSD',name:'Synthetic USD Holding',
    currency:'USD',quantity:10,buyPrice:50,currentPrice:100,fxRate:0.8,
    // Isolate FX quality: the stock price has a current observation timestamp.
    quoteTimestamp:Date.now(),
    assetType:'stock',account:'AOT',accountDetailsConfirmed:true,...overrides};
}

test('legacy foreign FX=1 without verification cannot masquerade as proven parity',async({page})=>{
  const result=await stateAsRendered(page,[foreign({fxRate:1,fxRateStatus:undefined,fxRateUpdatedAt:undefined})]);
  expect(result.total).toBe('—');
  expect(result.warningVisible).toBe(true);
  expect(result.warning).toMatch(/puutteellinen/i);
  expect(result.profit).toMatch(/ei laskettavissa/i);
});

test('explicitly verified FX=1 is allowed; parity itself is not forbidden',async({page})=>{
  const result=await stateAsRendered(page,[foreign({fxRate:1,fxRateStatus:'fresh',fxRateUpdatedAt:Date.now()})]);
  expect(result.warningVisible).toBe(false);
  expect(result.total).toMatch(/1\s?000,00/);
});

test('older 0.82 FX is a clearly labeled estimate, not silently precise',async({page})=>{
  const result=await stateAsRendered(page,[foreign({fxRate:0.82,fxRateStatus:'stale',fxRateUpdatedAt:Date.now()-86400000})]);
  expect(result.warningVisible).toBe(true);
  expect(result.total).toMatch(/^≈/);
  expect(result.warning).toMatch(/aiempaa valuuttakurssia/i);
});

test('corrupt negative local quote cannot render a negative holding valuation',async({page})=>{
  const result=await stateAsRendered(page,[foreign({currency:'EUR',fxRate:1,currentPrice:-7,manualPrice:0})]);
  expect(result.total).toBe('—');
  expect(result.warningVisible).toBe(true);
  expect(result.row).not.toContain('-70,00 €');
});

test('missing FX hides misleading risk, concentration and account summary',async({page})=>{
  await page.goto('/index.html');
  const result=await page.evaluate(()=>{
    state.baseCurrency='EUR';state.holdings=[
      {id:'qa-1',symbol:'QAEUR',quantity:1,buyPrice:100,currentPrice:100,currency:'EUR',assetType:'stock',account:'OST'},
      {id:'qa-2',symbol:'QAUSD',quantity:1,buyPrice:100,currentPrice:100,currency:'USD',fxRate:0,assetType:'stock',account:'AOT'}
    ];render();
    return {
      total:document.querySelector('#portfolioValue')?.textContent||'',
      risk:document.querySelector('#riskSummary')?.textContent||'',
      weights:document.querySelector('#portfolioPulse')?.textContent||'',
      targets:document.querySelector('#targetMap')?.textContent||''
    };
  });
  expect(result.total).toBe('—');
  expect(result.risk).toMatch(/ei laskettavissa/i);
  expect(result.weights).toMatch(/ei laskettavissa/i);
  expect(result.targets).toMatch(/ei laskettavissa/i);
});
