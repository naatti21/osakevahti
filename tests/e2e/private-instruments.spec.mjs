import {test,expect} from '@playwright/test';
import {chartInstrumentData,instrumentNews} from '../../engine/instrument-data.mjs';
const now=Date.now(),symbol='NOVEL.HE';
function observation(){
 const times=Array.from({length:400},(_,i)=>Math.floor(now/1000)-(399-i)*86400);
 const value=chartInstrumentData(symbol,{chart:{result:[{meta:{symbol,currency:'EUR',instrumentType:'EQUITY',regularMarketPrice:140,regularMarketTime:Math.floor(now/1000)},
 timestamp:times,indicators:{quote:[{close:times.map((_,i)=>100+i/10)}]},events:{dividends:{a:{date:Math.floor(now/1000)-86400*30,amount:2}}}}]}},now);
 value.news=instrumentNews(symbol,{news:[{title:'Synthetic company results',publisher:'Synthetic',relatedTickers:[symbol],providerPublishTime:Math.floor(now/1000),link:'https://example.test/novel'}]},now);
 return value;
}
async function setup(page){
 await page.route('**/*.json*',route=>route.fulfill({json:{generated_at:new Date(now).toISOString(),quotes:{},fund_quotes:{},assets:{},items:[{symbol:'OTHER',headline:'Unrelated news',datetime:Math.floor(now/1000),url:'https://example.test/other'}],dividends:[],rockets:[],rocket_universe_count:30}}));
 await page.route('**/*.workers.dev/**',route=>route.fulfill({json:{assets:{},generated_at:new Date(now).toISOString()}}));
 await page.route('**/instrument?symbol=*',route=>route.fulfill({json:observation()}));
 await page.goto('/index.html');
}
test('custom listing gets own dividend/momentum cards and no unrelated portfolio news',async({page})=>{
 await setup(page);await page.locator('.nav[data-view="newsView"]').click();
 await page.locator('[data-panel="rocketPanel"]').click();
 await page.locator('#rocketPanel .universeManager summary').click();
 await page.locator('#rocketWatchInput').fill(symbol);await page.locator('[data-watch-add="rockets"]').click();
 await expect(page.locator('#rocketPrivate')).toContainText('Haettu');
 await expect(page.locator('#rocketPrivate')).toContainText('1 kk');
 await expect(page.locator('#news')).not.toContainText('Unrelated news');
 await page.locator('[data-panel="dividendPanel"]').click();
 await page.locator('#dividendPanel .universeManager summary').click();
 await page.locator('#dividendWatchInput').fill(symbol);await page.locator('[data-watch-add="dividends"]').click();
 await expect(page.locator('#dividendPrivate')).toContainText('2.00 EUR');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('osakevahti.single.v1')).holdings)).toEqual([]);
 for(const width of [320,360,412]){await page.setViewportSize({width,height:850});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
});
test('only actual holding news is shown, removal invalidates attribution',async({page})=>{
 await setup(page);
 await page.evaluate(s=>{state.holdings=[{id:'synthetic-position',assetType:'stock',symbol:s,providerSymbol:s,name:'Synthetic Novel',currency:'EUR',quantity:2,buyPrice:100}];save();},symbol);
 await page.evaluate(()=>loadPortfolioNews(true));await page.locator('.nav[data-view="newsView"]').click();
 await expect(page.locator('#news')).toContainText('Synthetic company results');
 await expect(page.locator('#news')).not.toContainText('Unrelated news');
 await page.evaluate(()=>{state.holdings=[];renderNews();});
 await expect(page.locator('#news .news')).toHaveCount(0);
});
test('new holding receives exact dated quote; error and older response preserve last price',async({page})=>{
 await setup(page);
 await page.evaluate(({symbol,now})=>{state.holdings=[{id:'quote-regression',assetType:'stock',symbol,providerSymbol:symbol,name:'Synthetic Novel',currency:'EUR',quantity:2,buyPrice:100,manualStop:90,account:'Synthetic AOT'}];save();}, {symbol,now});
 await page.evaluate(()=>refreshMarket(false));
 let holding=await page.evaluate(()=>state.holdings[0]);
 expect(holding.currentPrice).toBe(140);expect(holding.quoteTimestamp).toBe(Math.floor(now/1000)*1000);
 expect(holding.quoteSource).toBe('INSTRUMENT');
 const identity={id:holding.id,quantity:holding.quantity,buyPrice:holding.buyPrice,account:holding.account};
 await page.route('**/instrument?symbol=*',route=>{const value=observation();value.quote.value.price=120;value.quote.value.observedAt=now-5*86400000;return route.fulfill({json:value});});
 await page.evaluate(()=>refreshMarket(true));
 holding=await page.evaluate(()=>state.holdings[0]);expect(holding.currentPrice).toBe(140);
 expect(holding.quoteHealth.status).toBe('stale');
 await page.route('**/instrument?symbol=*',route=>{const value=observation();value.quote.value.currency='USD';return route.fulfill({json:value});});
 await page.evaluate(()=>refreshMarket(true));
 holding=await page.evaluate(()=>state.holdings[0]);expect(holding.currentPrice).toBe(140);expect(holding.currency).toBe('EUR');
 expect(holding.quoteHealth.status).toBe('failed');
 expect({id:holding.id,quantity:holding.quantity,buyPrice:holding.buyPrice,account:holding.account}).toEqual(identity);
});
test('missing price date and invalid screening metrics cannot claim verified analysis',async({page})=>{
 await setup(page);
 const result=await page.evaluate(()=>({risk:evaluateRisk({symbol:'UNKNOWN',currency:'EUR',currentPrice:10,quantity:1,manualStop:5},100,1),
   row:validScreenRow({ticker:'UNKNOWN',score:90,yield_pct:null,dividend_years:5,return_12m:3,max_drawdown:-2},'dividends')}));
 expect(result.risk.dataStale).toBe(true);expect(result.row).toBe(false);
});
test('quota failure leaves private watchlist unchanged',async({page})=>{
 await setup(page);
 const result=await page.evaluate(()=>{
   const before=JSON.stringify(watchPrefs),original=Storage.prototype.setItem;
   Storage.prototype.setItem=()=>{throw new DOMException('full','QuotaExceededError')};
   try{return {saved:editWatch('rockets','add','NEWQ'),same:JSON.stringify(watchPrefs)===before}}
   finally{Storage.prototype.setItem=original}
 });
 expect(result).toEqual({saved:false,same:true});
});
test('contradictory saved identity is not silently resolved by precedence',async({page})=>{
 await setup(page);
 const values=await page.evaluate(()=>[
  privateListing({symbol:'AAA',providerSymbol:'AAA',currency:'EUR',instrument:{providerSymbol:'BBB',currency:'EUR'}}),
  privateListing({symbol:'AAA',providerSymbol:'AAA',currency:'EUR',instrument:{providerSymbol:'AAA',currency:'USD'}})
 ]);
 expect(values).toEqual(['','']);
});
test('user adds an unregistered company through the real form and receives dated quote, analyses and news',async({page})=>{
 await setup(page);
 await page.locator('#addBtn').click();
 await page.locator('#symbol').fill(symbol);
 await page.locator('#name').fill('Fictional Novel Company');
 await page.locator('#qty').fill('2');await page.locator('#buy').fill('100');
 await page.locator('#currency').selectOption('EUR');
 await page.locator('#accountType').selectOption('AOT');await page.locator('#brokerSelect').selectOption('OTHER');
 await page.locator('#form button[type="submit"]').click();
 await expect(page.locator('#dlg')).not.toBeVisible();
 await expect(page.locator('#refreshBtn')).toBeEnabled();await page.locator('#refreshBtn').click();
 await expect.poll(()=>page.evaluate(()=>state.holdings[0]?.quoteSource)).toBe('INSTRUMENT');
 const holding=await page.evaluate(()=>state.holdings[0]);
 expect(holding.currentPrice).toBe(140);expect(holding.quoteTimestamp).toBe(Math.floor(now/1000)*1000);
 expect(holding.quantity).toBe(2);expect(holding.buyPrice).toBe(100);expect(holding.currency).toBe('EUR');
 await page.locator('.nav[data-view="newsView"]').click();
 await expect(page.locator('#news')).toContainText('Synthetic company results');
 await page.locator('[data-panel="rocketPanel"]').click();await expect(page.locator('#rocketPrivate')).toContainText('1 kk');
 await page.locator('[data-panel="dividendPanel"]').click();await expect(page.locator('#dividendPrivate')).toContainText('2.00 EUR');
});
