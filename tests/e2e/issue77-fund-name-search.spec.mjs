import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const KEY='osakevahti.single.v1';
const A='IE00B03HD191',B='SE0013801453';
const day=new Date(Date.now()-86400000).toISOString().slice(0,10);
const feed='https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json';
const rows=[
 {ISIN:A,companyNameFi:'Handelsbanken USA Indeksi A',class:{fi:'A'},
  currency:'EUR',closePrice:'125.2',closePriceDate:day.replaceAll('-','')},
 {ISIN:B,companyNameFi:'Handelsbanken USA Indeksi B',class:{fi:'B'},
  currency:'EUR',closePrice:'104.1',closePriceDate:day.replaceAll('-','')}
];
function routes(page){
 let publicReads=0;
 return {
  async setup(){
   await page.route('**/*',route=>{
     const url=new URL(route.request().url());
     if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
     if(url.href.startsWith(feed)){
       publicReads++;
       return route.fulfill({contentType:'application/octet-stream',body:JSON.stringify(rows)});
     }
     if(url.pathname.endsWith('/v1/search'))return route.fulfill({json:{candidates:[]}});
     return route.fulfill({json:{assets:{},quotes:{},fund_quotes:{}}});
   });
  },
  count(){return publicReads}
 };
}
test('add-fund name search proposes multiple share-class ISINs without silent binding',async({page})=>{
 const traffic=routes(page);await traffic.setup();
 await page.goto('/');
 await page.getByRole('button',{name:'+ Lisää rahasto'}).click();
 await page.locator('#newFundQuery').fill('Handelsbanken USA Indeksi');
 await page.locator('#newFundSearch').click();
 await expect(page.locator('#newFundCandidates button')).toHaveCount(2);
 await expect(page.locator('#newFundCandidates')).toContainText(A);
 await expect(page.locator('#newFundCandidates')).toContainText(B);
 await page.locator('#newFundCandidates button').nth(1).click();
 await expect(page.locator('#newFundIsin')).toHaveValue(B);
 await expect(page.locator('#newFundClass')).toHaveValue('B');
 await expect(page.locator('#newFundCurrency')).toHaveValue('EUR');
 await expect(page.locator('#newFundIdentityConfirmed')).not.toBeChecked();
 await expect(page.locator('#newFundConfirm')).not.toBeChecked();
 expect(traffic.count()).toBe(1);
 const count=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY);
 expect(count).toBe(0);
});
test('read-only NAV diagnostic finds ISIN from name and does not write holdings',async({page})=>{
 const traffic=routes(page);await traffic.setup();
 await page.route('**/nav-test.html',route=>route.fulfill({
   status:200,contentType:'text/html; charset=utf-8',
   body:readFileSync('scripts/qa/issue77-nav-test.html','utf8')
 }));
 await page.goto('/nav-test.html');
 await page.locator('#nameQuery').fill('Handelsbanken USA');
 await page.locator('#searchByName').click();
 await expect(page.locator('#nameResults button')).toHaveCount(2);
 await page.locator('#nameResults button').first().click();
 await expect(page.locator('#isin')).toHaveValue(A);
 await expect(page.locator('#currency')).toHaveValue('EUR');
 await expect(page.locator('#result')).toContainText('ei vielä vahvista instrumenttia');
 await page.locator('#check').click();
 await expect(page.locator('#result')).toContainText('NAV-hinta: 125.2 EUR');
 await expect(page.locator('#result')).toContainText('NAV-päivä: '+day);
 expect(traffic.count()).toBe(1);
 expect(await page.evaluate(k=>localStorage.getItem(k),KEY)).toBeNull();
});
