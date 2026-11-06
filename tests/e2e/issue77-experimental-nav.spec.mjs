import {test,expect} from '@playwright/test';

const KEY='osakevahti.single.v1';
const ISIN='IE00B03HD191';
const dateDaysAgo=n=>new Date(Date.now()-n*86400000).toISOString().slice(0,10);
const day=dateDaysAgo(1),manualDay=dateDaysAgo(2);
const source='https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json';

function manualHolding(optIn=true){
  return {
    id:'manual-fund-fixture',name:'Synthetic Northern Index A EUR',
    assetType:'fund',symbol:'',providerSymbol:'',account:'Example · Long term',accountType:'FUND',
    broker:'Example',accountLabel:'Long term',accountDetailsConfirmed:true,
    currency:'EUR',quantity:0.37,buyPrice:8.5,manualPrice:10.2,navDate:manualDay,
    quoteSource:'MANUAL_NAV',quoteProvider:'Manual fixture',experimentalAutoNav:optIn,
    instrument:{id:'fund-1',isin:ISIN,shareClass:'A',currency:'EUR',
      identification:'user-confirmed',assetType:'fund',companyName:'Synthetic Northern Index A EUR'},
    identityEvidence:{reviewedAt:Date.now(),independentlyVerified:false},
    sourceBinding:{mode:'manual',providerId:'manual',isin:ISIN,shareClass:'A',
      currency:'EUR',automatic:false,acceptedAt:Date.now()},
    quoteObservation:{sourceKind:'manual',price:10.2,currency:'EUR',
      navDate:manualDay,sourceDescription:'Manual fixture',recordedAt:Date.now()}
  };
}
async function setup(page,{optIn=true,feedCurrency='EUR',feedPrice='10.40'}={}){
 let count=0;
 const portfolio={holdings:[manualHolding(optIn)],baseCurrency:'EUR',apiKey:'',
    riskBudgetPct:1.25,news:[],quoteUpdatedAt:null,settings:{}};
 await page.addInitScript(({key,portfolio})=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(portfolio));
 },{key:KEY,portfolio});
 await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
   if(url.href.startsWith(source)){
     count++;
     return route.fulfill({status:200,contentType:'application/octet-stream',
       body:JSON.stringify([{ISIN,currency:feedCurrency,
         closePrice:feedPrice,closePriceDate:day.replaceAll('-','') }])});
   }
   return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({assets:{},fund_quotes:{},quotes:{}})});
 });
 await page.goto('/index.html');
 await expect.poll(()=>page.evaluate(()=>!!state?.holdings?.length)).toBe(true);
 return ()=>count;
}
test('explicit user consent adds indicative ISIN NAV without replacing any manual/cost fields',async({page})=>{
 const count=await setup(page);
 await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0].experimentalNavObservation?.price,KEY)).toBe(10.4);
 const h=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0],KEY);
 expect(h.quantity).toBe(0.37);
 expect(h.buyPrice).toBe(8.5);
 expect(h.manualPrice).toBe(10.2);
 expect(h.quoteObservation).toMatchObject({sourceKind:'manual',price:10.2,navDate:manualDay});
 expect(h.navDate).toBe(manualDay);
 expect(h.quoteSource).toBe('MANUAL_NAV');
 expect(h.experimentalNavObservation).toMatchObject({isin:ISIN,currency:'EUR',price:10.4,navDate:day});
 expect(count()).toBe(1);
 await expect(page.locator('#holdings')).toContainText('KOKEILU-NAV');
 const p=await page.evaluate(()=>effectiveHoldingPrice(state.holdings[0]));
 expect(p).toBe(10.4);
 const quality=await page.evaluate(()=>holdingValuationQuality(state.holdings[0],effectiveHoldingPrice(state.holdings[0]),1));
 expect(quality.status).toBe('indicative');
});
test('currency mismatch and lack of opt-in keep manual value, with no unauthorized public fetch',async({page})=>{
 const count=await setup(page,{feedCurrency:'USD'});
 await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0].experimentalNavDiagnostic?.reason,KEY)).toBe('currency_mismatch');
 const h=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0],KEY);
 expect(h.experimentalNavObservation).toBeUndefined();expect(h.manualPrice).toBe(10.2);
 expect(await page.evaluate(()=>effectiveHoldingPrice(state.holdings[0]))).toBe(10.2);
 expect(count()).toBe(1);
});
test('no consent never fetches the public feed',async({page})=>{
 const count=await setup(page,{optIn:false});
 await page.waitForFunction(()=>lastAutoRefresh>0&&!refreshMarketInFlight);
 expect(count()).toBe(0);
 expect(await page.evaluate(()=>effectiveHoldingPrice(state.holdings[0]))).toBe(10.2);
});
test('unchecked experimental option discards quote overlay but keeps position and manual NAV',async({page})=>{
 await setup(page);
 await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0].experimentalNavObservation?.price,KEY)).toBe(10.4);
 await page.evaluate(()=>openManualFund(state.holdings[0]));
 await expect(page.locator('#newFundAutoNav')).toBeChecked();
 await page.locator('#newFundAutoNav').uncheck();
 await page.locator('#newFundIdentityConfirmed').check();
 await page.locator('#newFundSourceConfirmed').check();
 await page.locator('#newFundConfirm').check();
 await page.locator('#newFundForm button[type="submit"]').click();
 await expect(page.locator('#newFundDialog')).not.toBeVisible();
 const h=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0],KEY);
 expect(h.experimentalAutoNav).toBeUndefined();
 expect(h.experimentalNavObservation).toBeUndefined();
 expect(h.quantity).toBe(0.37);expect(h.buyPrice).toBe(8.5);
 expect(h.manualPrice).toBe(10.2);
 expect(await page.evaluate(()=>effectiveHoldingPrice(state.holdings[0]))).toBe(10.2);
});
