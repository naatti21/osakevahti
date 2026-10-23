import {test,expect} from '@playwright/test';
const KEY='osakevahti.single.v1';
const storebrand={id:'new-storebrand',symbol:'',name:'Storebrand Japan A EUR',
 quantity:.37,buyPrice:180.25,currency:'EUR',account:'Nordnet / Rahastotili',
 accountType:'FUND',broker:'Nordnet',accountDetailsConfirmed:true,
 assetType:'fund',fundQuoteKey:'',instrument:{schemaVersion:1,companyName:'Storebrand Japan A EUR',
 isin:'',listingTicker:'',dataKey:'',currency:'EUR',source:'screenshot',identification:'unverified'}};
const oldNordnet={id:'legacy',symbol:'NORDNET_EUROOPPA_INDEKSI',
 name:'Nordnet Eurooppa Indeksi',quantity:3.01,buyPrice:160.02,
 currency:'EUR',account:'Nordnet / Rahastotili',accountType:'FUND',
 broker:'Nordnet',accountDetailsConfirmed:true,assetType:'fund',currentPrice:185.0,
 navDate:'22.10.',quoteSource:'FUND_NAV',quoteProvider:'Nordnet fund page'};
async function seed(page,holdings,confirm=true){
 await page.addInitScript(({holdings,confirm})=>{
  if(!localStorage.getItem('osakevahti.single.v1'))localStorage.setItem('osakevahti.single.v1',JSON.stringify({
   baseCurrency:'EUR',apiKey:'',holdings,news:[],quoteUpdatedAt:null,riskBudgetPct:1.25,showDetails:false
  }));
  window.confirm=()=>confirm;
 },{holdings,confirm});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return route.continue();
  if(u.hostname==='naatti21.github.io'&&u.pathname.endsWith('/market-data.json'))
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    generated_at:new Date().toISOString(),quotes:{},
    fund_quotes:{STOREBRAND_JAPAN_A_EUR:{price:215.86,nav_date:'22.10.',
      currency:'EUR',timestamp:Date.now(),provider:'Nordnet fund page'}},fund_errors:{}
   })});
  if(u.hostname==='osakevahti-market-ed59.teemu-natunen84.workers.dev')
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    generated_at:new Date().toISOString(),assets:{},health:{failed:0}
   })});
  return route.fulfill({status:404,body:'not supplied in unit test'});
 });
 await page.goto('/index.html');
}
test('New unlinked fund has a helpful amber missing source notice, not a false network error',async({page})=>{
 await seed(page,[storebrand]);
 await page.evaluate(()=>refreshMarket(false));
 await expect(page.locator('#priceHealthNotice')).toHaveAttribute('data-level','warn');
 await expect(page.locator('#priceHealthSummary')).toContainText('Hintalähde puuttuu 1 rahastolta');
 const stateNow=await page.evaluate(()=>({
  h:state.holdings[0],incomplete:!document.querySelector('#valuationWarning').classList.contains('hidden')
 }));
 expect(stateNow.h.quoteHealth.status).toBe('unlinked');
 expect(stateNow.h.currentPrice).toBeUndefined();
 expect(stateNow.incomplete).toBe(true);
});
test('User-confirmed Storebrand source loads only source NAV with unverified day and preserves purchase cost',async({page})=>{
 await seed(page,[storebrand]);
 await page.locator('#holdings .item').click();
 await expect(page.locator('#fundPriceSourceSection')).toBeVisible();
 await page.locator('#fundPriceSource').selectOption('STOREBRAND_JAPAN_A_EUR');
 await page.locator('#form button[type="submit"]').click();
 await expect(page.locator('#dlg')).not.toBeVisible();
 const selected=await page.evaluate(()=>state.holdings[0]);
 expect(selected.fundQuoteKey).toBe('STOREBRAND_JAPAN_A_EUR');
 await page.evaluate(()=>refreshMarket(false));
 const after=await page.evaluate(()=>state.holdings[0]);
 expect(after.currentPrice).toBe(215.86);
 expect(after.navDate).toBe('22.10.');
 expect(after.quoteHealth.status).toBe('unverified-nav-day');
 expect(after.quoteTimestamp).toBe(0);
 expect(after.buyPrice).toBe(180.25);
 expect(after.quantity).toBe(.37);
 expect(after.symbol).toBe('');
 expect(after.instrument.identification).toBe('unverified');
 expect(await page.locator('#priceHealthNotice').getAttribute('data-level')).toBe('info');
});
test('Source selection cancelled at explicit confirmation does not change mapping',async({page})=>{
 await seed(page,[storebrand],false);
 await page.locator('#holdings .item').click();
 await page.locator('#fundPriceSource').selectOption('STOREBRAND_JAPAN_A_EUR');
 await page.locator('#form button[type="submit"]').click();
 await expect(page.locator('#dlg')).toBeVisible();
 const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0],KEY);
 expect(after.fundQuoteKey).toBe('');
});
test('Legacy fund cost edit does not force source remap or alter existing quote metadata',async({page})=>{
 await seed(page,[oldNordnet],false);
 await page.locator('#holdings .item').click();
 await expect(page.locator('#fundPriceSource')).toHaveValue('NORDNET_EUROOPPA_INDEKSI');
 await page.locator('#buy').fill('159.39');
 await page.locator('#form button[type="submit"]').click();
 await expect(page.locator('#dlg')).not.toBeVisible();
 const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0],KEY);
 expect(after.buyPrice).toBe(159.39);
 expect(after.fundQuoteKey).toBe('NORDNET_EUROOPPA_INDEKSI');
 expect(after.symbol).toBe('NORDNET_EUROOPPA_INDEKSI');
 expect(after.currentPrice).toBe(185);
});
