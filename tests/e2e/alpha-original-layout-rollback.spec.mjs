import {test,expect} from '@playwright/test';

// One-purpose QA for user-requested rollback:
// keep the original v2.17.1 metric layout; only remove dotted underline.
test('restored Alpha metric layout has no dotted underline and no newer flex/viewport hacks',async({page})=>{
  await page.goto('/index.html');
  const props=await page.evaluate(()=>{
    const rules=[...document.styleSheets].flatMap(sheet=>{
      try{return [...sheet.cssRules]}catch{return []}
    });
    const metric=rules.find(x=>x.selectorText==='.metricHelp');
    return {
      rule:metric?.cssText||'',
      header:document.querySelector('header .eyebrow')?.textContent,
      hasViewportPatch:typeof syncNavigationToVisibleScreen!=='undefined'||
        typeof syncVisibleViewportNav!=='undefined',
      hasFullscreenClip:[...rules].some(x=>/overflow-x:\\s*(clip|hidden)/.test(x.cssText||''))
    };
  });
  expect(props.header).toBe('ALPHA · v2.17.7');
  expect(props.rule).toContain('min-height: 30px');
  expect(props.rule).not.toMatch(/dotted|border-bottom|inline-flex|gap:\\s*4px/);
  expect(props.hasViewportPatch).toBe(false);
  expect(props.hasFullscreenClip).toBe(false);
  await page.locator('.nav[data-view="newsView"]').click();
  await page.locator('.insightTab[data-panel="dividendPanel"]').click();
  // Explanations remain available in their original accordion even without
  // an active public-feed response.
  const help=page.locator('#dividendPanel details.learnHelp:not(.universeManager)');
  await help.locator('summary').click();
  await expect(help).toHaveAttribute('open','');
  await expect(help.locator('.detailsBody')).toContainText('TTM');
});
