import {test,expect} from '@playwright/test';
test('local comparison uses explicit inputs, both rates; no storage or financial network payload',async({page})=>{
 await page.route('**/*.json*',r=>r.fulfill({json:{assets:{},items:[],dividends:[],rockets:[]}}));
 await page.route('**/*.workers.dev/**',r=>r.fulfill({json:{assets:{}}}));
 await page.goto('/');await page.locator('.nav[data-view="newsView"]').click();await page.locator('[data-panel="dividendPanel"]').click();
 await page.locator('#accountComparison summary').click();await page.locator('#taxCompare').click();await expect(page.locator('#taxResult')).toContainText('Täydennä');
 const before=await page.evaluate(()=>JSON.stringify(localStorage));const requests=[];page.on('request',r=>requests.push(r.url()+' '+(r.postData()||'')));
 await page.locator('#taxPrincipal').fill('12345');await page.locator('#taxYield').fill('5');await page.locator('#taxGrowth').fill('0');await page.locator('#taxReinvest').selectOption('yes');await page.locator('#taxCompare').click();
 await expect(page.locator('#taxResult')).toContainText('30 % skenaario');await expect(page.locator('#taxResult')).toContainText('34 % skenaario');
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(before);expect(requests.join('\n')).not.toContain('12345');
 for(const width of [320,360,412]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 await page.context().setOffline(true);await page.locator('#taxPrincipal').fill('1000');await page.locator('#taxCompare').click();await expect(page.locator('#taxResult')).toContainText('30 % skenaario');
});
