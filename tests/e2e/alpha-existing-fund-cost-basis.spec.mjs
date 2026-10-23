import {test,expect} from '@playwright/test';
const KEY='osakevahti.single.v1';
const legacyFund={
 id:'legacy-fund',symbol:'NORDNET_KEHITTYVAT_MARKKINAT_INDEKSI',
 name:'Nordnet Kehittyvät Markkinat Indeksi',quantity:4.3,buyPrice:152.17,
 currency:'EUR',account:'Nordnet / AOT',accountType:'AOT',broker:'Nordnet',
 accountLabel:'',accountDetailsConfirmed:true,assetType:'fund',
 currentPrice:182.05,navDate:'2026-10-22',quoteSource:'FUND_NAV',
 quoteTimestamp:1792620000000,
 instrument:{schemaVersion:1,companyName:'Nordnet Kehittyvät Markkinat Indeksi',
   isin:'',listingTicker:'NORDNET_KEHITTYVAT_MARKKINAT_INDEKSI',providerSymbol:'',
   dataKey:'NORDNET_KEHITTYVAT_MARKKINAT_INDEKSI',currency:'EUR',
   identification:'legacy-unverified',source:'migration'}
};
const regularStock={id:'stock-one',symbol:'MSFT',name:'Microsoft',
 assetType:'stock',quantity:2,buyPrice:300,currency:'USD',
 account:'Nordnet / AOT',accountType:'AOT',broker:'Nordnet',
 accountLabel:'',accountDetailsConfirmed:true};
async function setup(page,holdings=[legacyFund,regularStock]){
 await page.addInitScript(({holdings})=>{
   if(!localStorage.getItem('osakevahti.single.v1')){
     localStorage.setItem('osakevahti.single.v1',JSON.stringify({
       baseCurrency:'EUR',apiKey:'',holdings,news:[],quoteUpdatedAt:null,
       riskBudgetPct:1.25,showDetails:false
     }));
   }
 },{holdings});
 await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return route.continue();
   return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.goto('/index.html');
}
test('AOT fund with 36-character legacy identifier can change only average acquisition price',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:/Nordnet Kehittyvät Markkinat Indeksi/}).click();
 await expect(page.locator('#dlg')).toBeVisible();
 await expect(page.locator('#symbol')).not.toBeVisible();
 await expect(page.locator('#fundEditInfo')).toBeVisible();
 await expect(page.locator('#symbol')).not.toHaveAttribute('required','');
 await expect(page.locator('#instrumentLookupAction')).not.toBeVisible();
 await expect(page.locator('#buy')).toHaveValue('152.17');
 await expect(page.locator('#manualPrice')).toHaveValue('');
 await page.locator('#buy').fill('159.39');
 await page.locator('#form button[type="submit"]').click();
 await expect(page.locator('#dlg')).not.toBeVisible();
 const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY);
 expect(stored).toHaveLength(2);
 const before=legacyFund,after=stored.find(x=>x.id==='legacy-fund');
 expect(after.buyPrice).toBe(159.39);
 expect(after.quantity).toBe(4.3);
 expect(after.symbol).toBe(before.symbol);
 expect(after.assetType).toBe('fund');
 expect(after.accountType).toBe('AOT');
 expect(after.currentPrice).toBe(182.05);
 expect(after.manualPrice).toBe(null);
 expect(after.navDate).toBe(before.navDate);
 expect(after.instrument.listingTicker).toBe(before.instrument.listingTicker);
 expect(after.instrument.dataKey).toBe(before.instrument.dataKey);
 expect(stored.find(x=>x.id==='stock-one').buyPrice).toBe(300);
 await page.reload();
 const persisted=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY);
 expect(persisted.find(x=>x.id==='legacy-fund').buyPrice).toBe(159.39);
});
test('Fresh import-style fund with blank ticker can also edit cost basis',async({page})=>{
 const fresh={...legacyFund,id:'new-fund',symbol:'',name:'Storebrand Japan A EUR',
   quantity:.37,buyPrice:170.5,manualPrice:null,currentPrice:undefined,
   instrument:{...legacyFund.instrument,companyName:'Storebrand Japan A EUR',
     listingTicker:'',dataKey:'',identification:'unverified'}};
 await setup(page,[fresh]);
 await page.locator('#holdings .item').click();
 await expect(page.locator('#fundEditInfo')).toBeVisible();
 await page.locator('#buy').fill('171.25');
 await page.locator('#form button[type="submit"]').click();
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY);
 expect(saved).toHaveLength(1);
 expect(saved[0].buyPrice).toBe(171.25);
 expect(saved[0].symbol).toBe('');
 expect(saved[0].instrument.identification).toBe('unverified');
});
test('Stock ticker restrictions still apply and fund edit mode resets for a stock',async({page})=>{
 await setup(page);
 await page.locator('#holdings .item').first().click();
 await page.locator('#cancelDlg').click();
 await page.locator('#holdings .item').nth(1).click();
 await expect(page.locator('#fundEditInfo')).not.toBeVisible();
 await expect(page.locator('#symbol')).toBeVisible();
 await expect(page.locator('#symbol')).toHaveAttribute('required','');
 await page.locator('#symbol').fill('NOT_A_VALID_EXCHANGE_TICKER_LONGER_THAN_24');
 page.on('dialog',dialog=>dialog.accept());
 await page.locator('#form button[type="submit"]').click();
 await expect(page.locator('#dlg')).toBeVisible();
 const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY);
 expect(stored.find(h=>h.id==='stock-one').symbol).toBe('MSFT');
 expect(stored.find(h=>h.id==='stock-one').buyPrice).toBe(300);
});
test('Cancel fund cost edit keeps holdings unchanged',async({page})=>{
 await setup(page,[legacyFund]);
 await page.locator('#holdings .item').click();
 await page.locator('#buy').fill('159.39');
 await page.locator('#cancelDlg').click();
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY);
 expect(saved[0].buyPrice).toBe(152.17);
});
