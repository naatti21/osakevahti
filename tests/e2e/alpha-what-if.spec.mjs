import {test,expect} from '@playwright/test';

// No real accounts, holdings, API credentials or buy orders in these tests.
function sampleHoldings(){
  const common={assetType:'stock',currency:'EUR',buyPrice:10,
    currentPrice:10,manualPrice:0,quoteTimestamp:Date.now(),quoteSource:'MANUAL'};
  return [
    {...common,id:'A',symbol:'FAKE.HE',name:'Synthetic Holdings One',
      quantity:10,accountType:'AOT',broker:'Test Bank',accountDetailsConfirmed:true,accountLabel:'First'},
    {...common,id:'B',symbol:'FAKE.HE',name:'Synthetic Holdings Two',
      quantity:20,accountType:'OST',broker:'Test Bank',accountDetailsConfirmed:true,accountLabel:'Second'},
    {...common,id:'C',symbol:'TESTF',name:'Synthetic Fund',
      quantity:5,currentPrice:60,assetType:'fund',navDate:'2026-10-19',
      accountType:'FUND',broker:'Test Bank',accountDetailsConfirmed:true},
    {...common,id:'D',symbol:'OTHER',name:'Synthetic Other',quantity:40,
      accountType:'AOT',broker:'Test Bank',accountDetailsConfirmed:true}
  ];
}
test.beforeEach(async({page})=>{
  await page.addInitScript(holdings=>{
    localStorage.setItem('osakevahti.single.v1',JSON.stringify({holdings,baseCurrency:'EUR'}));
  },sampleHoldings());
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
    return route.fulfill({status:404,body:'Offline synthetic exercise'});
  });
  await page.goto('/index.html');
});
test('what-if math uses complete portfolio and never changes other accounts',async({page})=>{
  const r=await page.evaluate(()=>{
    const sample=[
      {h:{id:'a',quantity:10,assetType:'stock'},p:10,fx:1,val:100},
      {h:{id:'b',quantity:20,assetType:'stock'},p:10,fx:1,val:200},
      {h:{id:'c',quantity:5,assetType:'fund'},p:60,fx:1,val:300},
      {h:{id:'d',quantity:40,assetType:'stock'},p:10,fx:1,val:400}
    ];
    const original=JSON.stringify(sample);
    const result=calculateWhatIf(sample,'a','100',false);
    return {...result,unchanged:JSON.stringify(sample)===original};
  });
  expect(r.ok).toBe(true);
  expect(r.beforeTotal).toBe(1000);
  expect(r.afterTotal).toBe(1100);
  expect(r.beforeWeight).toBeCloseTo(10,8);
  expect(r.afterWeight).toBeCloseTo(200/1100*100,8);
  expect(r.beforeTop3).toBeCloseTo(90,8);
  expect(r.afterTop3).toBeCloseTo(900/1100*100,8);
  expect(r.beforeFundPct).toBeCloseTo(30,8);
  expect(r.afterFundPct).toBeCloseTo(300/1100*100,8);
  expect(r.unchanged).toBe(true);
});
test('missing market price or foreign FX rejects a misleading result',async({page})=>{
  const issues=await page.evaluate(()=>{
    const stock={h:{id:'a',quantity:10,assetType:'stock'},p:10,fx:0,val:0};
    const good={h:{id:'b',quantity:10,assetType:'stock'},p:10,fx:1,val:100};
    return [
      calculateWhatIf([stock,good],'b',500,true),
      calculateWhatIf([stock,good],'b',500,false),
      calculateWhatIf([good],'b',-500,false),
      calculateWhatIf([good],'a',500,false)
    ];
  });
  for(const result of issues)expect(result.ok).toBe(false);
  expect(issues[0].reason).toContain('valuuttakursseja');
  expect(issues[1].reason).toContain('valuuttakursseja');
  expect(issues[2].reason).toContain('positiivinen');
  expect(issues[3].reason).toContain('olemassa oleva');
});
test('scenario distinguishes duplicate tickers by account ID and leaves saved quantities unchanged',async({page})=>{
  const p=page.locator('#whatIfBox');
  await expect(p).not.toHaveAttribute('open','');
  await p.locator('summary').click();
  await expect(p.locator('#whatIfHolding option')).toHaveCount(4);
  const before=await page.evaluate(()=>state.holdings.map(h=>({
    id:h.id,symbol:h.symbol,quantity:h.quantity,buyPrice:h.buyPrice,accountType:h.accountType
  })));
  await page.locator('#whatIfHolding').selectOption('B');
  await page.locator('#whatIfAmount').fill('500');
  await expect(page.locator('#whatIfResult')).toContainText('Omistuksen paino nyt');
  await expect(page.locator('#whatIfResult')).toContainText('Rahastojen osuus');
  const simulated=await page.evaluate(()=>calculateWhatIf([
    {h:{id:'A',quantity:10,assetType:'stock'},p:10,fx:1,val:100},
    {h:{id:'B',quantity:20,assetType:'stock'},p:10,fx:1,val:200},
    {h:{id:'C',quantity:5,assetType:'fund'},p:60,fx:1,val:300},
    {h:{id:'D',quantity:40,assetType:'stock'},p:10,fx:1,val:400}
  ],'B',500,false));
  expect(simulated.afterWeight).toBeCloseTo(700/1500*100,8);
  const after=await page.evaluate(()=>state.holdings.map(h=>({
    id:h.id,symbol:h.symbol,quantity:h.quantity,buyPrice:h.buyPrice,accountType:h.accountType
  })));
  expect(after).toEqual(before);
});
test('what-if controls fit a narrow phone and never persist a simulation',async({page})=>{
  await page.setViewportSize({width:320,height:720});
  await page.locator('#whatIfBox summary').click();
  await page.locator('#whatIfAmount').fill('350');
  const info=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
    scenarioStored:JSON.stringify(localStorage.getItem('osakevahti.whatif')),
    amount:document.querySelector('#whatIfAmount').value
  }));
  expect(info.scroll).toBeLessThanOrEqual(info.viewport+1);
  expect(info.scenarioStored).toBe('null');
  expect(info.amount).toBe('350');
});
