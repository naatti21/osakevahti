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
