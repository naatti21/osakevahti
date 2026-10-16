import {test, expect} from '@playwright/test';
test.use({trace: 'on'});

// Diagnostic-first extension of PR #48. No CSS/viewport patches or real data.
const KEY = 'osakevahti.single.v1';
const viewportMeta = 'width=device-width,initial-scale=1,viewport-fit=cover';
const now = Date.parse('2026-10-16T12:00:00Z');
const holdings = Array.from({length: 13}, (_, i) => ({
  id: `synthetic-${i}`, symbol: `SYNTH${String(i + 1).padStart(2, '0')}`,
  name: i < 7 ? `Synthetic Northern Industrial Company ${i + 1}` :
    `Synthetic Global Sustainable Equity Index Fund Accumulating ${i + 1}`,
  assetType: i < 7 ? 'stock' : 'fund', quantity: 12.75 + i,
  buyPrice: 1100 + i, currentPrice: 1586.82 + i, currency: 'EUR',
  account: i < 7 ? 'OST' : 'FUND', accountType: i < 7 ? 'OST' : 'FUND',
  broker: 'OTHER', accountDetailsConfirmed: true, targetWeight: 10,
  quoteTimestamp: now - 15 * 60000, quoteSource: i < 7 ? 'WORKER' : 'FUND_NAV',
  quoteProvider: 'Synthetic delayed quotes', dayChangePct: i % 2 ? 1.15 : -3.09,
  fxRate: 1, trailingPct: 12, riskClass: 'medium', navDate: '2026-10-15',
}));

async function prepare(context, page) {
  await page.clock.setFixedTime(new Date(now));
  await context.addInitScript(({key, holdings}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      holdings, apiKey: '', baseCurrency: 'EUR', news: [], riskBudgetPct: 1.25,
      showDetails: false, refreshSummary: {updated: 7, marketTracked: 7, fundsUpdated: 6, fundsTracked: 6},
    }));
  }, {key: KEY, holdings});
  let revision = 0;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4173') return route.continue();
    const asset = h => ({price: h.currentPrice + revision * 100, currency: 'EUR',
      quote_timestamp: now, timestamp: now, day_change_pct: h.dayChangePct,
      change_pct: h.dayChangePct, source: 'Synthetic worker', provider: 'Synthetic feed', nav_date: '2026-10-16'});
    let body;
    if (url.hostname.endsWith('.workers.dev')) {
      body = {generated_at: new Date(now).toISOString(), assets: Object.fromEntries(holdings.slice(0, 7).map(h => [h.symbol, asset(h)])), errors: {}};
    } else if (url.hostname === 'naatti21.github.io') {
      const files = {
        'market-data.json': {generated_at: new Date(now).toISOString(),
          quotes: Object.fromEntries(holdings.slice(0, 7).map(h => [h.symbol, asset(h)])),
          fund_quotes: Object.fromEntries(holdings.slice(7).map(h => [h.symbol, asset(h)]))},
        'portfolio-status.json': {assets: {}, generated_at: new Date(now).toISOString()},
        'market-context.json': {assets: {}}, 'risk-data.json': {assets: {}},
        'news-data.json': {items: [{symbol: 'SYNTH01', source: 'Synthetic local fixture',
          headline: 'Synthetic company publishes a long quarterly outlook for northern markets',
          summary: 'Invented financial content for navigation layout testing only.', datetime: now / 1000}]},
        'insights.json': {generated_at: new Date(now).toISOString(),
          dividends: [{ticker: 'SYNTH01', name: 'Synthetic Northern Income Company', score: 75, yield_pct: 5.5, dividend_years: 5}],
          rockets: [{ticker: 'SYNTH02', name: 'Synthetic Northern Growth Company', score: 70, m1: 12, m3: 18, m6: 24, volume_ratio: 1.2}]},
      };
      body = files[url.pathname.split('/').pop()];
    }
    if (!body) return route.abort('blockedbyclient');
    // Entirely in-browser synthetic responses; no external financial request sent.
    return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  });
  return () => revision++;
}

async function geometry(page, phase) {
  return page.evaluate(phase => {
    const rect = el => {
      const r = el.getBoundingClientRect();
      return {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height};
    };
    const vv = visualViewport;
    return {phase, meta: document.querySelector('meta[name="viewport"]').content,
      viewport: {width: vv.width, height: vv.height, left: vv.offsetLeft, top: vv.offsetTop, scale: vv.scale},
      innerWidth, innerHeight, scrollX, scrollY, docWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth, nav: rect(document.querySelector('nav')),
      buttons: [...document.querySelectorAll('nav .nav')].map(el => {
        const r = rect(el), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {...r, view: el.dataset.view, x, y, hit: hit === el || el.contains(hit)};
      }),
      moveRows: [...document.querySelectorAll('.moveRow')].map(el => ({
        symbol: el.dataset.quickSymbol, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, ...rect(el),
      })),
      overflow: [...document.querySelectorAll('.view.active *')].filter(el => {
        const r = el.getBoundingClientRect(); return r.width && r.right > document.documentElement.clientWidth + 1;
      }).slice(0, 15).map(el => ({tag: el.tagName, id: el.id, className: el.className, ...rect(el)})),
      standalone: matchMedia('(display-mode: standalone)').matches,
      serviceWorker: navigator.serviceWorker?.controller?.scriptURL ?? null,
    };
  }, phase);
}

async function check(page, phase, samples) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const g = await geometry(page, phase); samples.push(g);
  expect(g.meta).toBe(viewportMeta);
  expect(g.viewport.scale, JSON.stringify(g)).toBeCloseTo(1, 2);
  expect(g.docWidth, JSON.stringify(g)).toBeLessThanOrEqual(g.clientWidth + 1);
  expect(g.innerWidth, JSON.stringify(g)).toBeLessThanOrEqual(g.viewport.width + 1);
  expect(g.nav.left).toBeGreaterThanOrEqual(g.viewport.left - 1);
  expect(g.nav.right).toBeLessThanOrEqual(g.viewport.left + g.viewport.width + 1);
  expect(g.nav.top).toBeGreaterThanOrEqual(g.viewport.top - 1);
  expect(g.nav.bottom).toBeLessThanOrEqual(g.viewport.top + g.viewport.height + 1);
  expect(g.buttons).toHaveLength(4);
  for (const button of g.buttons) {
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.hit, `${phase}: ${button.view} obscured`).toBe(true);
  }
  return g;
}

async function tapTabs(page, phase, samples, testInfo) {
  for (const view of ['riskView', 'newsView', 'settingsView', 'portfolioView']) {
    const g = await check(page, `${phase}-before-${view}`, samples);
    const b = g.buttons.find(b => b.view === view);
    // Raw touchscreen coordinates: no locator auto-scroll or DOM click shortcut.
    await page.touchscreen.tap(b.x, b.y);
    await expect(page.locator(`#${view}`)).toHaveClass(/active/);
    await expect(page.locator(`nav [data-view="${view}"]`)).toHaveClass(/active/);
    await check(page, `${phase}-after-${view}`, samples);
    if (testInfo && view === 'riskView') {
      await expect(page.locator('#risks .riskHead .name').first()).toContainText('Synthetic Northern Industrial Company');
      await page.screenshot({path: testInfo.outputPath('risk-view.png')});
    }
  }
}

for (const width of [320, 360, 393]) {
  test(`Alpha nav diagnostic: rendered portfolio, refresh, touch tabs and resize at ${width}px`, async ({browser}, testInfo) => {
    test.setTimeout(60000);
    const context = await browser.newContext({viewport: {width, height: 740}, isMobile: true,
      hasTouch: true, deviceScaleFactor: 3, serviceWorkers: 'block', timezoneId: 'Europe/Helsinki'});
    const page = await context.newPage(), samples = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      const update = await prepare(context, page);
      await page.goto('/index.html');
      await expect(page.locator('.moveRow')).toHaveCount(7);
      await expect(page.locator('#holdings .item')).toHaveCount(13);
      await check(page, 'initial-render', samples);
      await page.screenshot({path: testInfo.outputPath('initial.png')});
      const before = await page.locator('#portfolioValue').textContent();
      update();
      await page.locator('#refreshBtn').tap();
      await expect(page.locator('#refreshBtn')).toBeEnabled();
      await expect(page.locator('#portfolioValue')).not.toHaveText(before);
      await expect(page.locator('#quoteAge')).toContainText('NAV 6/6');
      await check(page, 'after-real-render-refresh', samples);
      await page.locator('#detailsToggle').tap();
      await expect(page.locator('#holdings .priceLine')).toHaveCount(13);
      await check(page, 'expanded-details', samples);
      await page.locator('#targetMapBox summary').tap();
      await check(page, 'expanded-target-map', samples);
      await tapTabs(page, 'touch-tabs', samples, testInfo);
      // Real content interactions remain available; modal intentionally blocks nav.
      await page.locator('.moveRow').first().tap();
      await expect(page.locator('#quickInfoDlg')).toBeVisible();
      await page.locator('#closeQuickInfo').tap();
      await check(page, 'dialog-dismissed', samples);
      for (const fraction of [0.5, 1]) {
        await page.evaluate(f => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), fraction);
        await check(page, `scroll-${fraction}`, samples);
        await page.screenshot({path: testInfo.outputPath(`scroll-${fraction}.png`)});
      }
      await tapTabs(page, 'scrolled-touch-tabs', samples);
      for (const size of [{width, height: 480}, {width: 740, height: width}, {width, height: 740}]) {
        await page.setViewportSize(size);
        await tapTabs(page, `resize-${size.width}x${size.height}`, samples);
        await page.screenshot({path: testInfo.outputPath(`resize-${size.width}x${size.height}.png`)});
      }
      await page.reload();
      await expect(page.locator('#holdings .item')).toHaveCount(13);
      await check(page, 'reload', samples);
      const positions = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).holdings
        .map(({id, quantity, buyPrice}) => ({id, quantity, buyPrice})), KEY);
      expect(positions).toEqual(holdings.map(({id, quantity, buyPrice}) => ({id, quantity, buyPrice})));
      expect(errors).toEqual([]);
    } finally {
      await testInfo.attach('geometry', {body: JSON.stringify({width, samples, errors}, null, 2), contentType: 'application/json'});
      await page.screenshot({path: testInfo.outputPath('final.png')}).catch(() => {});
      await context.close();
    }
  });
}

test('Alpha nav diagnostic: visual zoom observation and reset (not an Android root-cause assertion)', async ({browser}, testInfo) => {
  const context = await browser.newContext({viewport: {width: 393, height: 740}, isMobile: true, hasTouch: true, serviceWorkers: 'block'});
  const page = await context.newPage(), samples = [];
  try {
    await prepare(context, page); await page.goto('/index.html');
    await check(page, 'zoom-1', samples);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setPageScaleFactor', {pageScaleFactor: 2});
    samples.push(await geometry(page, 'zoom-2-observation-only'));
    await page.screenshot({path: testInfo.outputPath('zoom-2.png')});
    // Pinch zoom deliberately shrinks the visual viewport. Clipping here is not
    // proof of the user's failure, and is not used to justify a CSS change.
    await cdp.send('Emulation.setPageScaleFactor', {pageScaleFactor: 1});
    await tapTabs(page, 'zoom-reset', samples);
  } finally {
    await testInfo.attach('zoom-geometry', {body: JSON.stringify(samples, null, 2), contentType: 'application/json'});
    await context.close();
  }
});
