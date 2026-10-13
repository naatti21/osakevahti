import {test,expect} from '@playwright/test';

// Read-only real browser test against public Alpha4 with a fresh CI browser.
// No personal holdings, cookies, secrets, backups or deployment operations.
test('Alpha4 real browser can fetch USD/EUR via current Frankfurter redirect',async({page})=>{
  test.setTimeout(60_000);
  await page.goto('https://osakevahti-alpha-naatti21.pages.dev/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('header .eyebrow')).toHaveText('ALPHA 4 · DATAN EHEYS');
  const output=await page.evaluate(async()=>{
    const t=Date.now();
    try{
      const r=await fxRate('USD','EUR');
      return {rate:r,elapsedMs:Date.now()-t};
    }catch(e){return {error:String(e),elapsedMs:Date.now()-t}}
  });
  console.log('ALPHA4_PUBLIC_BROWSER_FX',JSON.stringify(output));
  expect(output.error, 'The real Alpha browser must fetch FX: '+output.error).toBeUndefined();
  expect(output.rate).toBeGreaterThan(0);
  expect(output.rate).toBeLessThan(2);
});

test('Official Frankfurter v1 direct endpoint is accessible with Alpha origin in browser',async({page})=>{
  test.setTimeout(60_000);
  await page.goto('https://osakevahti-alpha-naatti21.pages.dev/',{waitUntil:'domcontentloaded'});
  const output=await page.evaluate(async()=>{
    try{
      const response=await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR',{cache:'no-store'});
      const j=await response.json();
      return {status:response.status,rate:j.rates?.EUR,base:j.base};
    }catch(e){return {error:String(e)}}
  });
  console.log('ALPHA4_PUBLIC_BROWSER_OFFICIAL_FX',JSON.stringify(output));
  expect(output.error).toBeUndefined();
  expect(output.status).toBe(200);
  expect(output.base).toBe('USD');
  expect(output.rate).toBeGreaterThan(0);
});