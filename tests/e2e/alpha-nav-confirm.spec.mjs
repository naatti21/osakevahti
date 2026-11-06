import {test,expect} from "@playwright/test";
const KEY="osakevahti.single.v1",ISIN="SE0005993102";
const day=new Date(Date.now()-86400000).toISOString().slice(0,10);
const feed="https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json";
const one={id:"old-fund-1",assetType:"fund",name:"Nordnet Suomi Indeksi",
  symbol:"NORDNET_SUOMI",currency:"EUR",account:"Nordnet FUND",accountType:"FUND",
  broker:"Nordnet",accountLabel:"Rahastot",accountDetailsConfirmed:true,
  quantity:0.37,buyPrice:201.25,currentPrice:350.01,manualPrice:349.99,
  navDate:"2026-11-01",fundQuoteKey:"LEGACY_KEY",
  instrument:{isin:"",identification:"legacy-unverified"},importMeta:{source:"old-import"}};
const two={...one,id:"old-fund-2",name:"Unknown Local Fund",symbol:"OTHER_FUND",
  account:"Different fund account",quantity:4.3,buyPrice:50.25,
  currentPrice:49.7,manualPrice:49.5};
async function setup(page){
 let requests=0;
 await page.addInitScript(({key,holdings})=>{
   localStorage.setItem(key,JSON.stringify({baseCurrency:"EUR",holdings,
     news:[],apiKey:"",riskBudgetPct:1.25}));
 },{key:KEY,holdings:[one,two]});
 await page.route("**/*",route=>{
   const u=new URL(route.request().url());
   if(u.hostname==="127.0.0.1"||u.hostname==="localhost")return route.continue();
   if(u.href.startsWith(feed)){
     requests++;
     return route.fulfill({status:200,contentType:"application/octet-stream",body:JSON.stringify([
       {ISIN,companyNameFi:"Nordnet Suomi Indeksi",
        class:{fi:"Osakerahastot Suomi"},
        currency:"EUR",closePrice:"361.67",closePriceDate:day.replaceAll("-","")}
     ])});
   }
   if(u.pathname.endsWith("market-data.json"))return route.fulfill({json:{quotes:{},fund_quotes:{}}});
   return route.fulfill({status:200,contentType:"application/json",body:"{}"});
 });
 await page.goto("/");
 await page.locator('[data-view="settingsView"]').click();
 await page.locator("#navLinkPanel > summary").click();
 return ()=>requests;
}
test("legacy fund source linkage requires backup acknowledgment, explicit user confirmation and keeps old fields",async({page})=>{
 const requests=await setup(page);
 const initial=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(initial).toHaveLength(2);
 await expect(page.locator("#navLinkStatus")).toContainText("2 rahastoa");
 await expect(page.locator("#navLinkStatus")).toContainText("0 NAV-seurantaa");
 await page.locator("#navLinkList button").first().click();
 await expect(page.locator("#navLinkDlg")).toBeVisible();
 await page.locator("#navLinkSearch").click();
 await expect(page.locator("#navLinkCandidates button").first()).toContainText("Nordnet Suomi Indeksi");
 await page.locator("#navLinkCandidates button").first().click();
 await expect(page.locator("#navLinkSearchStatus")).toContainText("Vie ensin JSON-varmuuskopio");
 let confirmed=0;
 page.on("dialog",async dialog=>{confirmed++;await dialog.accept()});
 await page.locator("#navLinkBackupConfirmed").check();
 await page.locator("#navLinkCandidates button").first().click();
 await expect(page.locator("#navLinkDlg")).not.toBeVisible();
 const linked=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(linked).toHaveLength(2);
 for(const k of ["id","quantity","buyPrice","account","accountType","broker","accountLabel","currentPrice","manualPrice","navDate","fundQuoteKey","symbol","importMeta"]){
   expect(linked[0][k]).toEqual(initial[0][k]);
   expect(linked[1][k]).toEqual(initial[1][k]);
 }
 expect(linked[0].navBinding).toMatchObject({isin:ISIN,currency:"EUR"});
 expect(linked[1].navBinding).toBeUndefined();
 expect(confirmed).toBe(1);
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings[0].navObservation?.price,KEY),
    {timeout:15000}).toBe(361.67);
 expect(await page.evaluate(()=>navConsentCore?.effectiveFundPrice(state.holdings[0]))).toBe(361.67);
 await page.locator("#navLinkList button").first().click();
 const removed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings[0],KEY);
 expect(removed.navBinding).toBeUndefined();
 expect(removed.quantity).toBe(0.37);
 expect(removed.buyPrice).toBe(201.25);
 expect(removed.currentPrice).toBe(350.01);
 expect(requests()).toBe(1);
});
test("existing positions get proposals automatically but never link without consent",async({page})=>{
 const requests=await setup(page);
 await expect(page.locator("#navLinkStatus")).toContainText("0 NAV-seurantaa");
 await expect(page.locator("#navLinkStatus")).toContainText("1/2 rahastolle löytyi ehdokkaita");
 await expect(page.locator("#navLinkList button").first()).toHaveText("Tarkista ehdotus");
 await expect(page.locator("#navLinkList button").nth(1)).toHaveText("Hae / tarkista");
 await page.locator("#navLinkList button").first().click();
 await expect(page.locator("#navLinkCandidates button").first()).toContainText("Nordnet Suomi Indeksi");
 await expect(page.locator("#navLinkQuery")).toHaveValue("Nordnet Suomi Indeksi");
 await page.locator("#navLinkLater").click();
 const h=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(h.every(x=>!x.navBinding)).toBe(true);
 expect(requests()).toBe(1); // a single shared public download, never per holding
});

