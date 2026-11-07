import {test,expect} from '@playwright/test';
import {chartInstrumentData} from '../../engine/instrument-data.mjs';
const now=Date.now(),symbol='UNLISTED-TEST.HE';
function observation(code=symbol,type='EQUITY'){
 const stamp=now/1000|0;
 const timestamps=Array.from({length:400},(_,i)=>stamp-(399-i)*86400);
 return chartInstrumentData(code,{chart:{result:[{
  meta:{symbol:code,currency:'EUR',instrumentType:type,regularMarketPrice:37,
   regularMarketTime:stamp,longName:'New fictional issuer'},
  timestamp:timestamps,indicators:{quote:[{close:timestamps.map((_,i)=>20+i/50)}]},
  events:{dividends:{a:{date:stamp-86400*60,amount:.37},b:{date:stamp-86400*180,amount:.18}}}
 }]}},now);
}
async function prepare(page,handler){
 await page.route('**/*.json*',r=>r.fulfill({json:{assets:{},items:[],dividends:[],rockets:[]}}));
 await page.route('**/*.workers.dev/**',r=>r.fulfill({json:{assets:{}}}));
 await page.route('**/instrument?symbol=*',handler);
 await page.goto('/index.html');
 await page.locator('#stockInspectionPanel summary').click();
}
test('never-coded ticker gets source-dated price, trend, TTM events and honest missing fundamentals',async({page})=>{
 const requests=[];
 await prepare(page,async route=>{requests.push(route.request());
   return route.fulfill({json:observation()});});
 const original=await page.evaluate(()=>JSON.stringify(state.holdings));
 await page.locator('#stockInspectionSymbol').fill(symbol);
 await page.locator('#stockInspectionRun').click();
 await expect(page.locator('#stockInspectionResult [data-stock-inspection]')).toHaveCount(1);
 const out=page.locator('#stockInspectionResult');
 await expect(out).toContainText(symbol);
 await expect(out).toContainText('37 EUR');
 await expect(out).toContainText('Yahoo Finance chart');
 await expect(out).toContainText('1 kk');
 await expect(out).toContainText('0.55 EUR'); // locale may be dot decimals for toFixed
 await expect(out).toContainText('Tieto ei riitä');
 await expect(out).toContainText('Ei vahvistettu yhtiökokoushistoria');
 await expect(out).not.toContainText('Osinkolaatu: 90');
 await out.locator('details.stockInspectionGaps summary').click();
 await expect(out).toContainText('Kassavirta, tulos ja velkaantuminen');
 expect(await page.evaluate(()=>JSON.stringify(state.holdings))).toBe(original);
 expect(requests.length).toBe(1);
 const url=new URL(requests[0].url());
 expect([...url.searchParams.keys()]).toEqual(['symbol']);
 expect(url.searchParams.get('symbol')).toBe(symbol);
 expect(requests[0].postData()).toBe(null);
 for(const width of [320,360,412]){await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
});
test('bad listing does not reach server; contradictory quote and ETF fail closed',async({page})=>{
 let mode='invalid',hits=0;
 await prepare(page,async route=>{
  hits++;
  const o=observation();
  if(mode==='invalid')o.quote.value.currency='USD';
  if(mode==='etf')o.instrumentType='ETF';
  return route.fulfill({json:o});
 });
 await page.locator('#stockInspectionSymbol').fill('https://bad.test');
 await page.locator('#stockInspectionRun').click();
 await expect(page.locator('#stockInspectionStatus')).toContainText('Anna oikea');
 expect(hits).toBe(0);
 await page.locator('#stockInspectionSymbol').fill(symbol);
 await page.locator('#stockInspectionRun').click();
 await expect(page.locator('#stockInspectionResult')).toContainText('Ei luotettavaa kurssia');
 await expect(page.locator('#stockInspectionResult')).toContainText('Ei tarkoita nollaosinkoa');
 mode='etf';
 await page.locator('#stockInspectionRun').click();
 await expect(page.locator('#stockInspectionStatus')).toContainText('ei ole lähteen mukaan pörssiosake');
 expect(hits).toBe(2);
 await expect(page.locator('#stockInspectionResult')).toBeEmpty();
});
