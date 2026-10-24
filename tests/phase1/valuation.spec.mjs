import {test,expect} from '@playwright/test';
import {setup,quote} from './helpers.mjs';
import {legacyFund} from './fixtures.mjs';
for(const [label,navDate] of [['stale','2026-09-01'],['yearless','23.10.'],['missing','']])test('uncertain NAV consistently qualifies totals performance and risk: '+label,async({page})=>{
 const h={...legacyFund,navDate,quoteTimestamp:0};await setup(page,{holdings:[h],quotes:{[h.symbol]:quote({nav_date:navDate})}});
 await expect(page.locator('#portfolioValue')).toHaveText(/^≈ /);await expect(page.locator('#portfolioProfit')).toHaveText(/^≈ /);await expect(page.locator('#valuationWarning')).toContainText('NAV');await page.locator('[data-view="riskView"]').click();await expect(page.locator('#riskSummary')).toContainText('≈');await expect(page.locator('#riskSummary')).toHaveAttribute('data-valuation-quality','indicative');
});
test('current verified NAV retains numeric valuation and acquisition cost',async({page})=>{
 const h={...legacyFund,navDate:'2026-10-23'};await setup(page,{holdings:[h],quotes:{[h.symbol]:quote()}});await expect(page.locator('#portfolioValue')).not.toHaveText(/^≈ /);await expect(page.locator('#valuationWarning')).toBeHidden();expect(await page.evaluate(()=>state.holdings[0].buyPrice)).toBe(121.25);
});
