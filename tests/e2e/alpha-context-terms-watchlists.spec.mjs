import {test,expect} from '@playwright/test';

// Synthetic data only: tests UX, never user holdings or public feed writes.
const synthetic={
 generated_at:'2026-10-14T10:00:00Z',rocket_universe_count:30,
 dividends:[{ticker:'FORTUM.HE',name:'Fortum',score:62,yield_pct:7.1,dividend_years:4,
  return_12m:1.4,max_drawdown:-19.5,reason:'TTM-osinko 7.1 %, osinkoa 4/5 viime vuodesta, 12 kk +1.4 %.'},
 {ticker:'SAMPO.HE',name:'Sampo',score:57,yield_pct:4.2,dividend_years:5,
  return_12m:4.1,max_drawdown:-15,reason:'TTM-osinko 4.2 %, osinkoa 5/5 viime vuodesta.'}],
 rockets:[{ticker:'AMD',name:'AMD',score:67,m1:9,m3:18,m6:31,volume_ratio:1.6,label:'SEURAA',reason:'kurssitrendi',risk:'korkea'}]
};
test.beforeEach(async({page})=>{
 await page.route('**/insights.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(synthetic)}));
 await page.goto('/index.html');
 await page.locator('.nav[data-view="newsView"]').click();
});
test('TTM is directly tappable, explains meaning and closing returns to list',async({page})=>{
 await page.locator('.insightTab[data-panel="dividendPanel"]').click();
 const card=page.locator('#dividendList .card').first();
 await expect(card).toContainText('TTM-osinko');
 await card.getByRole('button',{name:/Selitä TTM-osinko/}).click();
 await expect(page.locator('#metricHelpDlg')).toBeVisible();
 await expect(page.locator('#metricHelpBody')).toContainText('365');
 await page.locator('#closeMetricHelp').click();
 await expect(page.locator('#metricHelpDlg')).not.toBeVisible();
 await card.getByRole('button',{name:/Selitä Max pudotus/}).click();
 await expect(page.locator('#metricHelpTitle')).toContainText('Max pudotus');
});
test('source-universe is transparent without claiming a market-wide scan',async({page})=>{
 await page.locator('.insightTab[data-panel="dividendPanel"]').click();
 await expect(page.locator('#dividendPanel')).toContainText('10 valittua suomalaisyhtiötä');
 await page.locator('.insightTab[data-panel="rocketPanel"]').click();
 await expect(page.locator('#rocketPanel')).toContainText('30 valittua kansainvälistä yhtiötä');
});
test('hide, restore and custom unrated tracking persist separately from holdings',async({page})=>{
 await page.locator('.insightTab[data-panel="dividendPanel"]').click();
 const before=await page.evaluate(()=>localStorage.getItem('osakevahti.single.v1'));
 await expect(page.locator('#dividendList .card')).toHaveCount(2);
 await page.locator('#dividendList [data-watch-action="hide"]').first().click();
 await expect(page.locator('#dividendList .card')).toHaveCount(1);
 await page.locator('#dividendPanel .universeManager summary').click();
 await expect(page.locator('#dividendWatchList')).toContainText('Piilotetut yhtiöt');
 await page.locator('#dividendWatchList [data-watch-action="restore"]').click();
 await expect(page.locator('#dividendList .card')).toHaveCount(2);
 await page.locator('#dividendWatchInput').fill('FSKRS.HE');
 await page.locator('#dividendPanel [data-watch-add="dividends"]').click();
 await expect(page.locator('#dividendWatchList')).toContainText('FSKRS.HE');
 await expect(page.locator('#dividendWatchList')).toContainText('ei vielä analyysiä');
 expect(await page.evaluate(()=>localStorage.getItem('osakevahti.single.v1'))).toBe(before);
 await page.reload();
 await page.locator('.nav[data-view="newsView"]').click();
 await page.locator('.insightTab[data-panel="dividendPanel"]').click();
 await page.locator('#dividendPanel .universeManager summary').click();
 await expect(page.locator('#dividendWatchList')).toContainText('FSKRS.HE');
 await page.locator('#dividendWatchList [data-watch-action="remove"]').click();
 await expect(page.locator('#dividendWatchList')).not.toContainText('FSKRS.HE');
});
test('unknown symbols are not assigned synthetic scores and malformed symbols rejected',async({page})=>{
 await page.locator('.insightTab[data-panel="rocketPanel"]').click();
 await page.locator('#rocketPanel .universeManager summary').click();
 await page.locator('#rocketWatchInput').fill('bad symbol <script>');
 await page.locator('#rocketPanel [data-watch-add="rockets"]').click();
 await expect(page.locator('#rocketWatchFeedback')).toContainText('Anna pörssitunnus');
 await page.locator('#rocketWatchInput').fill('TSLA');
 await page.locator('#rocketPanel [data-watch-add="rockets"]').click();
 await expect(page.locator('#rocketWatchList')).toContainText('TSLA');
 await expect(page.locator('#rocketList .card')).toHaveCount(1);
 await expect(page.locator('#rocketList')).not.toContainText('TSLA');
});
