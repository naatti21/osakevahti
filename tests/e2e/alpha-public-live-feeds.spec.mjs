import { test, expect } from '@playwright/test';

// Alpha3 release-gate contract. The six datasets are public and read-only.
// True browser requests verify the public GitHub Pages CORS allowlist.
// No user holdings, API keys or account data are used.
const dataNames = [
  'market-data.json','insights.json','news-data.json',
  'market-context.json','portfolio-status.json','risk-data.json'
];
const remote = 'https://naatti21.github.io/osakevahti/';

test('Alpha3 browser gets all six live financial JSON feeds and renders actual insight lists', async ({page}) => {
  test.setTimeout(90_000);
  await page.goto('/index.html');
  await expect(page.locator('header .eyebrow')).toHaveText('ALPHA · v2.17.2');

  const results=await page.evaluate(async (files) => {
    return await Promise.all(files.map(async file => {
      const url=publicFeedUrl(file);
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15_000)});
      const contentType=response.headers.get('content-type')||'';
      const data=await response.json();
      return {file,url,status:response.status,contentType,
        keys:Object.keys(data||{}),
        countDividends:Array.isArray(data?.dividends)?data.dividends.length:null,
        countRockets:Array.isArray(data?.rockets)?data.rockets.length:null,
        validMarket:Boolean(data?.quotes && typeof data.quotes==='object')
      };
    }));
  },dataNames);
  for(const result of results){
    expect(result.url).toMatch(/^https:\/\/naatti21\.github\.io\/osakevahti\//);
    expect(result.status, result.file).toBe(200);
    expect(result.contentType, result.file).toContain('json');
    expect(result.keys.length,result.file).toBeGreaterThan(0);
    expect(result.url).toContain('/'+result.file+'?t=');
  }
  const market=results.find(x=>x.file==='market-data.json');
  expect(market.validMarket).toBe(true);
  const insights=results.find(x=>x.file==='insights.json');
  expect(insights.countDividends).toBeGreaterThan(0);
  expect(insights.countRockets).toBeGreaterThan(0);

  // Initial page asynchronously fetches the public feed and renders its content.
  await expect.poll(()=>page.locator('#dividendList .card').count(),{timeout:20_000})
    .toBe(insights.countDividends);
  await expect.poll(()=>page.locator('#rocketList .card').count(),{timeout:20_000})
    .toBe(insights.countRockets);
});

test('Alpha3 original refresh dependencies: Worker and the live fallback both respond', async ({page}) => {
  test.setTimeout(90_000);
  await page.goto('/index.html');
  const live=await page.evaluate(async() => {
    const [worker,github]=await Promise.all([
      loadWorkerData(false,1),
      loadHelsinkiData(1)
    ]);
    return {
      worker:Boolean(worker?.assets && typeof worker.assets==='object'),
      market:Boolean(github?.quotes && typeof github.quotes==='object'),
      funds:Boolean(github?.fund_quotes && typeof github.fund_quotes==='object'),
      workerHealth:state.workerHealth?.ok,
      fallbackHealth:state.marketDataHealth?.ok
    };
  });
  expect(live).toMatchObject({worker:true,market:true,funds:true,workerHealth:true,fallbackHealth:true});
});
