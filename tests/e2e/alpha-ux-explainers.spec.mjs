import {test,expect} from '@playwright/test';

// Synthetic-only UX oracles. No real holdings, credentials or deployments.
test('Alpha uses one semantic version and keeps optional technical settings collapsed',async({page})=>{
  await page.goto('/index.html');
  await expect(page.locator('header .eyebrow')).toHaveText('ALPHA · v2.17.8');
  await page.locator('.nav[data-view="settingsView"]').click();
  const advanced=page.locator('#settingsView .techOptions');
  await expect(advanced).not.toHaveAttribute('open', '');
  await expect(page.locator('#testNordnetBtn')).toBeHidden();
  await advanced.locator('summary').click();
  await expect(page.locator('#testNordnetBtn')).toBeVisible();
  await expect(page.locator('#testNordnetBtn')).toHaveText('Testaa kurssipalvelu');
  await expect(page.locator('#apiKey')).toBeVisible();
});

test('technical Worker never appears as a user-facing data status',async({page})=>{
  await page.goto('/index.html');
  const states=await page.evaluate(()=>{
    const now=Date.now();
    const base={symbol:'TEST',assetType:'stock',currency:'EUR',currentPrice:100,manualPrice:0,quoteTimestamp:now-60_000};
    return [
      dataState({...base,quoteSource:'WORKER',quoteProvider:'Yahoo Finance'}),
      dataState({...base,quoteSource:'WORKER',quoteProvider:'Finnhub'}),
      dataState({...base,quoteSource:'WORKER',quoteProvider:'Finnhub',quoteTimestamp:0}),
      dataState({...base,quoteSource:'PORTFOLIO_STATUS'})
    ];
  });
  expect(states).toHaveLength(4);
  for(const x of states){expect(x.label).not.toMatch(/WORKER|YAHOO|FINNHUB|HELSINKI|YHTEINEN/);}
  expect(states[2].label).toBe('AIKA PUUTTUU');
});

test('risk terminology is explained on demand without adding an onboarding mode',async({page})=>{
  await page.goto('/index.html');
  await page.locator('.nav[data-view="riskView"]').click();
  const help=page.locator('#riskView details.learnHelp').first();
  await expect(help).not.toHaveAttribute('open','');
  await help.locator('summary').click();
  await expect(help).toHaveAttribute('open','');
  await expect(help.locator('.detailsBody')).toContainText('ATR(14)');
  await expect(help.locator('.detailsBody')).toContainText('ei tee myyntitoimeksiantoja');
});

test('dividend and momentum vocabulary is available but not cluttering cards',async({page})=>{
  await page.goto('/index.html');
  await page.locator('.nav[data-view="newsView"]').click();
  await page.locator('.insightTab[data-panel="dividendPanel"]').click();
  const dividend=page.locator('#dividendPanel details.learnHelp:not(.universeManager)');
  await expect(dividend).not.toHaveAttribute('open','');
  await dividend.locator('summary').click();
  await expect(dividend.locator('.detailsBody')).toContainText('Max pudotus');
  await expect(dividend.locator('.detailsBody')).toContainText('osinkoa');

  await page.locator('.insightTab[data-panel="rocketPanel"]').click();
  const radar=page.locator('#rocketPanel details.learnHelp:not(.universeManager)');
  await expect(radar).not.toHaveAttribute('open','');
  await radar.locator('summary').click();
  await expect(radar.locator('.detailsBody')).toContainText('Volatiliteetti');
  await expect(radar.locator('.detailsBody')).toContainText('Volyymi 1,6×');
  await expect(radar.locator('.detailsBody')).toContainText('nousun todennäköisyys');
});

test('facts about triggered stop remain visible despite contextual decision wording',async({page})=>{
  await page.goto('/index.html');
  const s=await page.evaluate(()=>{
    const h={symbol:'TEST',name:'Test instrument',assetType:'stock',quantity:2,buyPrice:100,currentPrice:90,
      currency:'EUR',manualStop:95,trailingPct:0,quoteTimestamp:Date.now(),quoteSource:'WORKER',quoteProvider:'Finnhub'};
    const r=evaluateRisk(h,10000,1);
    renderRiskCard({h,p:90,val:180,fx:1},r,10000,
      {severity:'OK',action:'EI TOIMENPIDETTÄ',reason:'markkina seuraa',techLabel:'taso rikottu',portfolioLabel:'ok',
       thesis:{label:'ei uutisia',reason:'ei uutisia'},marketLabel:'markkina'},0,false);
    const card=document.querySelector('#risks .card');
    return {status:r.status,
      factVisibleInCard:card?.textContent?.includes('Suojataso on rikkoutunut laskennassa.'),
      contextRetained:card?.textContent?.includes('EI TOIMENPIDETTÄ')};
  });
  expect(s).toEqual({status:'TRIGGERED',factVisibleInCard:true,contextRetained:true});
});
