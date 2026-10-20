import {test,expect} from '@playwright/test';

// Fictional holdings, no real portfolio or market data; all calculations run in browser.
const fake=()=>[
 {id:'same-aot',symbol:'SAMPLE.HE',name:'Fictional Sample',assetType:'stock',quantity:10,buyPrice:20,
  currentPrice:20,currency:'EUR',accountType:'AOT',accountDetailsConfirmed:true,broker:'Test Broker'},
 {id:'same-ost',symbol:'SAMPLE.HE',name:'Fictional Sample',assetType:'stock',quantity:5,buyPrice:20,
  currentPrice:20,currency:'EUR',accountType:'OST',accountDetailsConfirmed:true,broker:'Test Broker'},
 {id:'other',symbol:'DIFFERENT.HE',name:'Fictional Different',assetType:'stock',quantity:15,buyPrice:20,
  currentPrice:20,currency:'EUR',accountType:'OST',accountDetailsConfirmed:true,broker:'Test Broker'},
 {id:'fund',symbol:'FICTION-FUND',name:'Fictional fund',assetType:'fund',quantity:4,buyPrice:100,
  currentPrice:100,currency:'EUR',navDate:'2026-10-19',accountType:'FUND',accountDetailsConfirmed:true,broker:'Test Broker'}
];
test.beforeEach(async({page})=>{
 await page.addInitScript(holdings=>localStorage.setItem('osakevahti.single.v1',
  JSON.stringify({holdings,baseCurrency:'EUR'})),fake());
 await page.route('**/*',route=>{
  const h=new URL(route.request().url()).hostname;
  if(h==='localhost'||h==='127.0.0.1')return route.continue();
  return route.fulfill({status:404,body:'synthetic-only'});
 });
 await page.goto('/index.html');
});
test('structure radar groups the same listing across accounts, not by row count',async({page})=>{
 const result=await page.evaluate(()=>{
  const rows=[
   {h:{id:'1',symbol:'FAKE.HE',assetType:'stock',quantity:1,currency:'EUR',accountType:'AOT',accountDetailsConfirmed:true},val:200,p:200,fx:1},
   {h:{id:'2',symbol:'FAKE.HE',assetType:'stock',quantity:1,currency:'EUR',accountType:'OST',accountDetailsConfirmed:true},val:100,p:100,fx:1},
   {h:{id:'3',symbol:'DIFFERENT.HE',assetType:'stock',quantity:1,currency:'EUR',accountType:'AOT',accountDetailsConfirmed:true},val:300,p:300,fx:1},
   {h:{id:'4',symbol:'FUND',assetType:'fund',quantity:1,currency:'EUR'},val:400,p:400,fx:1}
  ];
  const before=JSON.stringify(rows);
  const out=portfolioStructure(rows);
  return {...out,immutable:before===JSON.stringify(rows)};
 });
 expect(result.ok).toBe(true);
 expect(result.positions).toBe(4);
 expect(result.instrumentCount).toBe(3);
 expect(result.largestPct).toBeCloseTo(40,8);
 expect(result.top3Pct).toBeCloseTo(100,8);
 expect(result.repeats).toHaveLength(1);
 expect(result.repeats[0].val).toBe(300);
 expect(result.immutable).toBe(true);
});
test('same symbol with different ISIN or MIC stays distinct',async({page})=>{
 const r=await page.evaluate(()=>{
  const h=(id,isin,mic)=>({id,symbol:'ABC',assetType:'stock',quantity:1,currency:'EUR',
    instrument:{isin,mic}});
  const rows=[
   {h:h('a','FI0000000001','XHEL'),p:10,fx:1,val:10},
   {h:h('b','FI0000000002','XHEL'),p:10,fx:1,val:10},
   {h:h('c','','XNYS'),p:10,fx:1,val:10},
   {h:h('d','','XHEL'),p:10,fx:1,val:10},
  ];
  return portfolioStructure(rows);
 });
 expect(r.instrumentCount).toBe(4);
 expect(r.repeats).toHaveLength(0);
});
test('shock applies to total symbol exposure across AOT and OST, not only one card',async({page})=>{
 const r=await page.evaluate(()=>{
  const h=(id,symbol)=>({id,symbol,quantity:1,assetType:'stock',currency:'EUR'});
  const rows=[
    {h:h('A','SAMPLE'),p:100,fx:1,val:100},
    {h:h('B','SAMPLE'),p:200,fx:1,val:200},
    {h:h('C','DIFFERENT'),p:700,fx:1,val:700}
  ];
  return scenarioPortfolio(rows,'A',100,false,20);
 });
 expect(r.ok).toBe(true);
 expect(r.afterGroupWeight).toBeCloseTo(400/1100*100,8);
 expect(r.sameTickerAccounts).toBe(2);
 expect(r.loss).toBeCloseTo(80,8);
 expect(r.lossPortfolioPct).toBeCloseTo(80/1100*100,8);
 expect(r.after.top3Pct).toBeCloseTo(100,8);
});
test('no calculation for incomplete data and invalid stress values',async({page})=>{
 const results=await page.evaluate(()=>{
  const h={id:'a',symbol:'A',quantity:1,assetType:'stock',currency:'EUR'};
  const missing=[{h,p:0,fx:1,val:0}];
  const valid=[{h,p:100,fx:1,val:100}];
  return [portfolioStructure(missing),scenarioPortfolio(missing,'a',50,false,20),
    scenarioPortfolio(valid,'a',50,false,0),scenarioPortfolio(valid,'a',50,false,90)];
 });
 for(const r of results)expect(r.ok).toBe(false);
 expect(results[0].reason).toContain('puutteellisia');
 expect(results[2].reason).toContain('1–80');
});
test('radar and two comparison scenarios visible and no buy/persist',async({page})=>{
 await page.locator('#portfolioAnalysisBox summary').click();
 await expect(page.locator('#portfolioAnalysisResult')).toContainText('Keskittymät');
 await expect(page.locator('#portfolioAnalysisResult')).toContainText('SAMPLE.HE');
 await expect(page.locator('#portfolioAnalysisResult')).toContainText('2 riviä');
 await expect(page.locator('#portfolioAnalysisResult')).toContainText('Toimiala-');
 await page.locator('#whatIfBox summary').click();
 await page.locator('#whatIfHolding').selectOption('same-aot');
 await page.locator('#whatIfAlternative').selectOption('other');
 await page.locator('#whatIfAmount').fill('250');
 await page.locator('#whatIfShock').fill('25');
 const box=page.locator('#whatIfResult');
 await expect(box).toContainText('Vaihtoehto A');
 await expect(box).toContainText('Vaihtoehto B');
 await expect(box).toContainText('Sama instrumentti yhteensä');
 await expect(box).toContainText('25,0 %');
 const q=await page.evaluate(()=>({
   amount:document.getElementById('whatIfAmount').value,
   positions:state.holdings.map(h=>[h.id,h.quantity,h.buyPrice]),
   persisted:JSON.parse(localStorage.getItem('osakevahti.single.v1')).holdings.map(h=>[h.id,h.quantity,h.buyPrice])
 }));
 expect(q.positions).toEqual(q.persisted);
 expect(q.positions).toHaveLength(4);
 expect(q.amount).toBe('250');
});
test('mobile 320px remains within viewport with A/B scenarios',async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await page.locator('#portfolioAnalysisBox summary').click();
 await page.locator('#whatIfBox summary').click();
 await page.locator('#whatIfAlternative').selectOption('other');
 await page.locator('#whatIfAmount').fill('500');
 const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
 expect(dims.scroll).toBeLessThanOrEqual(dims.viewport+1);
});
