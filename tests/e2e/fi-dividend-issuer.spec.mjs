import {test,expect} from '@playwright/test';
test('issuer AGM evidence cards distinguish Kesko future payment and Metso paid proof, without portfolio writes',async({page})=>{
 await page.route('**/*.json*',r=>r.fulfill({json:{assets:{},items:[],dividends:[],rockets:[]}}));
 await page.route('**/*.workers.dev/**',r=>r.fulfill({json:{assets:{}}}));
 await page.goto('/');
 await page.locator('.nav[data-view="newsView"]').click();
 await page.locator('[data-panel="dividendPanel"]').click();
 await expect(page.locator('#fiDividendIssuerList [data-fi-issuer]')).toHaveCount(3);
 await expect(page.locator('#fiDividendStatus')).toContainText('3 / 3');
 const before=await page.evaluate(()=>JSON.stringify(state.holdings));
 const kesko=page.locator('[data-fi-issuer="KESKOB.HE"]');
 await expect(kesko).toContainText('0,90');
 await kesko.locator('summary').click();
 await expect(kesko).toContainText('2027-01-21');
 await expect(kesko).toContainText('Tuleva päätetty maksuerä');
 const metso=page.locator('[data-fi-issuer="METSO.HE"]');await metso.locator('summary').click();
 await expect(metso).toContainText('Maksettu – vahvistettu');
 await expect(metso).toContainText('toteutunutta maksua ei vahvistettu erikseen');
 expect(await page.evaluate(()=>JSON.stringify(state.holdings))).toBe(before);
 await metso.getByRole('button',{name:'Vertaa OST / AOT'}).click();
 await expect(page.locator('#accountComparison')).toHaveAttribute('open','');
 await expect(page.locator('#taxListing')).toHaveValue('METSO.HE');
 await expect(page.locator('#taxYield')).toHaveValue(''); // Never invent yield from an AGM decision.
 for(const width of [320,360,412]){await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
});
