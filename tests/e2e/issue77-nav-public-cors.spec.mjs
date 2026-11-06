import {test,expect} from '@playwright/test';

const base='https://issue77-android-sandbox.osakevahti-alpha-naatti21.pages.dev/';
const feed='https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json';
test('actual QA-origin Chromium can fetch the public NAV list through CORS',async({page})=>{
 await page.goto(base+'nav-test.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('h1')).toContainText('kokeellinen NAV-haku');
 const result=await page.evaluate(async url=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
   try{
     const response=await fetch(url,{mode:'cors',credentials:'omit',
       cache:'no-store',redirect:'error',signal:controller.signal});
     if(!response.ok)return {ok:false,reason:'HTTP '+response.status};
     const raw=await response.json();
     if(!Array.isArray(raw))return {ok:false,reason:'not array'};
     return {ok:true,count:raw.length,
       isinCount:raw.filter(x=>typeof x?.ISIN==='string'&&
         /^[A-Z]{2}[A-Z0-9]{10}$/.test(x.ISIN)).length,
       datedCount:raw.filter(x=>x?.closePriceDate).length};
   }catch(error){return {ok:false,reason:String(error?.message||error)};}
   finally{clearTimeout(timer);}
 },feed);
 console.log('QA_BROWSER_REAL_PUBLIC_NAV_READ',JSON.stringify(result));
 expect(result.ok,'Real browser NAV feed is blocked, likely CORS or availability').toBe(true);
 expect(result.isinCount).toBeGreaterThan(150);
 expect(result.datedCount).toBeGreaterThan(150);
});
