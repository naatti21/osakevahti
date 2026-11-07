import {test,expect} from '@playwright/test';

const KEY='osakevahti.single.v1';
const DAY=new Date(Date.now()-86400000).toISOString().slice(0,10);
const NAV_FEED='https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json';
async function prepare(page){
 let reads=0;
 await page.addInitScript(key=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({
     baseCurrency:'EUR',holdings:[],apiKey:'',news:[],riskBudgetPct:1.25
   }));
 },KEY);
 await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
   if(route.request().url().startsWith(NAV_FEED)){
     reads++;
     return route.fulfill({status:200,contentType:'application/octet-stream',
       body:JSON.stringify([
         {ISIN:'SE0005993102',companyNameFi:'Nordnet Suomi Indeksi',
           class:{fi:'Osakerahastot Suomi'},currency:'EUR',
           closePrice:'361.67',closePriceDate:DAY.replaceAll('-','')}
       ])});
   }
   return route.fulfill({status:200,contentType:'application/json',body:'{"assets":{},"quotes":{}}'});
 });
 await page.goto('/');
 return ()=>reads;
}
function newFund(){
 return {
  id:'new-fund-1',assetType:'fund',name:'Nordnet Suomi Indeksi',
  instrument:{isin:'',identification:'unverified',assetType:'fund',currency:'EUR'},
  currency:'EUR',quantity:0.37,buyPrice:200.25,manualPrice:349.99,currentPrice:350.01,
  account:'Nordnet Fund 1',accountType:'FUND',broker:'Nordnet',accountLabel:'Test',
  accountDetailsConfirmed:true
 };
}
test('saving a new fund immediately searches NAV candidates, opens review but NEVER auto binds',async({page})=>{
 const reads=await prepare(page);
 await page.evaluate((h)=>{
   const before=state.holdings.length;
   state.holdings.push(h);save();render();
   if(state.holdings.length!==before+1)throw Error('test fixture insertion failed');
   onNewFundsSaved([h.id]);
 },newFund());
 await expect(page.locator('#settingsView')).toHaveClass(/active/);
 await expect(page.locator('#navLinkPanel')).toHaveAttribute('open','');
 await expect(page.locator('#navLinkStatus')).toContainText('1/1 rahastolle löytyi ehdokkaita',{timeout:18000});
 await expect(page.locator('#navLinkList')).toContainText('Nordnet Suomi Indeksi');
 await expect(page.locator('#navLinkList button')).toHaveText('Tarkista ehdotus');
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings[0],KEY);
 expect(after.navOptIn).toBeUndefined();
 expect(after.navBinding).toBeUndefined();
 expect(after.quantity).toBe(.37);
 expect(after.buyPrice).toBe(200.25);
 expect(after.account).toBe('Nordnet Fund 1');
 expect(reads()).toBe(1);
 await page.locator('#navLinkList button').click();
 await expect(page.locator('#navLinkDlg')).toBeVisible();
 await expect(page.locator('#navLinkCandidates button').first()).toContainText('Nordnet Suomi Indeksi');
 await page.locator('#navLinkLater').click();
 expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings[0],KEY)).navBinding).toBeUndefined();
});
test('repeated new-fund hook is safe for already bound holding or for a stock',async({page})=>{
 const reads=await prepare(page);
 await page.evaluate(()=>{
   state.holdings.push({id:'new-stock',name:'Stock',assetType:'stock',quantity:3,
    buyPrice:100,currency:'EUR',account:'AOT'});
   save();render();onNewFundsSaved(['new-stock']);
 });
 await expect(page.locator('#navLinkDlg')).not.toBeVisible();
 expect(reads()).toBe(0);
});
