import {test,expect} from '@playwright/test';

// Postdeployment regression on the real isolated Cloudflare Pages stable URL.
// Synthetic browser profile, no holdings, credentials or destructive actions.
const origin='https://osakevahti-alpha-naatti21.pages.dev/';
test('P1 Alpha5 deployed origin loads direct browser FX and visible refresh status',async({page})=>{
  test.setTimeout(70_000);
  await page.goto(origin+'?alpha5-smoke='+Date.now(),{waitUntil:'domcontentloaded'});
  await expect(page.locator('header .eyebrow')).toHaveText('ALPHA 5 · VALUUTTAKURSSIT');
  const manifest=await page.evaluate(async()=>await(await fetch('./manifest.webmanifest')).json());
  expect(manifest.id).toBe('./?channel=alpha');
  expect(manifest.name).toBe('Osakevahti Alpha');
  const fx=await page.evaluate(async()=>{
    try{return {rate:await fxRate('USD','EUR')}}
    catch(err){return {error:String(err)}}
  });
  console.log('LIVE_ALPHA5_BROWSER_FX',JSON.stringify(fx));
  expect(fx.error,'Cloudflare Alpha5 currency request must not fail in browser').toBeUndefined();
  expect(fx.rate).toBeGreaterThan(0);
  expect(fx.rate).toBeLessThan(2);
  // Fresh CI browser has no user's holdings. Clicking update must still tell
  // them it ran, rather than leaving an unresponsive-looking circular arrow.
  await page.locator('#refreshBtn').click();
  await expect(page.locator('#refreshFeedback')).toContainText('Päivitys valmis:',{timeout:30000});
  await expect(page.locator('#refreshBtn')).toHaveText('↻');
});