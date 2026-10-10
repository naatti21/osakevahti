import { test, expect } from '@playwright/test';

const KEY = 'osakevahti.single.v1';
const WORKER = 'https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**';

const ms = iso => new Date(iso).getTime();

function stock({
  id, symbol, name = symbol, quantity = 10, buyPrice = 20,
  currentPrice = 20, currency = 'EUR', account = 'OST',
  dayChangePct = 0, quoteTimestamp, quoteSource = 'WORKER',
  quoteProvider = 'Yahoo Finland', fxRate = 1, targetWeight = 10
}) {
  return {
    id, symbol, name, quantity, buyPrice, currentPrice, currency, account,
    assetType: 'stock', dayChangePct, quoteTimestamp, quoteSource,
    quoteProvider, fxRate, targetWeight, trailingPct: 12, riskClass: 'medium'
  };
}

function appState(holdings = [], extra = {}) {
  return {
    baseCurrency: 'EUR', apiKey: '', holdings, news: [], quoteUpdatedAt: null,
    riskBudgetPct: 1.25, showDetails: false, ...extra
  };
}

async function seed(page, state) {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: KEY, value: state });
}

async function mockNetwork(page, {
  workerAssets = {}, workerStatus = 200, marketQuotes = {}, fundQuotes = {},
  sharedAssets = {}, sharedGeneratedAt = '2026-10-09T12:00:00Z',
  marketGeneratedAt = '2026-10-09T12:00:00Z', fx = { USD: 0.86, SEK: 0.091 }
} = {}) {
  await page.route(WORKER, async route => {
    if (workerStatus !== 200) {
      return route.fulfill({ status: workerStatus, contentType: 'application/json', body: JSON.stringify({ error: 'mock failure' }) });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schema_version: 'worker-v1.1', generated_at: marketGeneratedAt,
        cache_ttl_seconds: 60, assets: workerAssets, errors: {},
        health: { ok: Object.keys(workerAssets).length, failed: 0 }
      })
    });
  });

  await page.route('**/market-data.json*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ generated_at: marketGeneratedAt, quotes: marketQuotes, fund_quotes: fundQuotes })
  }));

  await page.route('**/portfolio-status.json*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ generated_at: sharedGeneratedAt, assets: sharedAssets, market_context: { assets: {} } })
  }));

  await page.route('**/risk-data.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ assets: {} })
  }));
  await page.route('**/market-context.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ assets: {} })
  }));
  await page.route('**/portfolio-news.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] })
  }));
  await page.route('**/dividend-rocket-insights.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({})
  }));

  await page.route('https://api.frankfurter.app/**', route => {
    const url = new URL(route.request().url());
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const rate = from === to ? 1 : (fx[from] ?? fx[to] ?? 1);
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rates: { [to]: rate } }) });
  });
}

async function openApp(page, { time, state, network = {} }) {
  await page.clock.install({ time: new Date(time) });
  await seed(page, state);
  await mockNetwork(page, network);
  await page.goto('/index.html');
  await expect(page.locator('#dailyMoves')).toBeVisible();
}

const friClose = ms('2026-10-09T17:55:00+03:00');
const mon1059 = ms('2026-10-12T10:59:00+03:00');

test('@smoke weekend quick view shows last close instead of blanks', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, buyPrice: 20, dayChangePct: 1.52, quoteTimestamp: friClose }),
      stock({ id: 'n', symbol: 'NDA-FI', currentPrice: 15.25, buyPrice: 14, dayChangePct: -0.16, quoteTimestamp: friClose, targetWeight: 8 })
    ])
  });

  const quick = page.locator('#dailyMoves');
  await expect(quick).toContainText('Markkinat kiinni · viimeisin päätös');
  await expect(quick).toContainText('FORTUM');
  await expect(quick).toContainText('23,39');
  await expect(quick).toContainText('pe päätös');
  await expect(page.locator('#accountSummary')).toContainText('Tänään osakkeet');
  await expect(page.locator('#accountSummary')).toContainText('0,00');
});

test('@smoke quick-view explanation opens by tap', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, dayChangePct: 1.52, quoteTimestamp: friClose })])
  });

  await page.locator('[data-quick-symbol="FORTUM"]').click();
  await expect(page.locator('#quickInfoDlg')).toBeVisible();
  await expect(page.locator('#quickInfoDlg')).toContainText('Päätöskurssi');
  await expect(page.locator('#quickInfoDlg')).toContainText('Viimeisen kaupankäyntipäivän muutos');
});

test('quick-view explanation is keyboard accessible', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, dayChangePct: 1.52, quoteTimestamp: friClose })])
  });

  const row = page.locator('[data-quick-symbol="FORTUM"]');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#quickInfoDlg')).toBeVisible();
});

test('@smoke stale shared snapshot cannot overwrite a fresher Worker quote', async ({ page }) => {
  const staleTs = ms('2026-10-12T10:30:00+03:00');
  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 22, quoteTimestamp: friClose })]),
    network: {
      marketGeneratedAt: '2026-10-12T07:59:00Z',
      workerAssets: {
        FORTUM: { price: 24.50, quote_timestamp: mon1059, day_change_pct: 1.2, source: 'Yahoo Finland', delayed: false }
      },
      marketQuotes: {
        FORTUM: { price: 24.30, timestamp: ms('2026-10-12T10:58:00+03:00'), change_pct: 1.1, provider: 'GitHub snapshot', realtime: false }
      },
      sharedGeneratedAt: '2026-10-12T07:30:00Z',
      sharedAssets: {
        FORTUM: { price: 21.00, day_change_pct: -2, quote_timestamp: staleTs, source: 'stale shared' }
      }
    }
  });

  await page.locator('#refreshBtn').click();
  await expect(page.locator('[data-quick-symbol="FORTUM"]')).toContainText('24,50');
  await page.waitForTimeout(250);
  await expect(page.locator('[data-quick-symbol="FORTUM"]')).toContainText('24,50');

  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(stored.holdings[0].currentPrice).toBe(24.5);
  expect(stored.holdings[0].quoteSource).toBe('WORKER');
});

test('previous US session is not counted as today while US market is closed', async ({ page }) => {
  const amdFriday = ms('2026-10-09T15:59:00-04:00');
  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([
      stock({ id: 'f', symbol: 'FORTUM', quantity: 10, currentPrice: 24, buyPrice: 20, dayChangePct: 1, quoteTimestamp: mon1059 }),
      stock({ id: 'a', symbol: 'AMD', quantity: 3, currentPrice: 210, buyPrice: 100, currency: 'USD', account: 'OST', fxRate: 0.86, dayChangePct: -3.9, quoteTimestamp: amdFriday, quoteProvider: 'Finnhub', targetWeight: 10 })
    ])
  });

  await expect(page.locator('[data-quick-symbol="AMD"]')).toContainText('pe päätös');
  await expect(page.locator('#accountSummary')).toContainText('+2,38');
});

test('details stay quiet by default and expand on demand', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, dayChangePct: 1.52, quoteTimestamp: friClose })])
  });

  await expect(page.locator('#holdings .priceLine')).toHaveCount(0);
  await expect(page.locator('#detailsToggle')).toHaveText('Näytä tarkemmat luvut');
  await page.locator('#detailsToggle').click();
  await expect(page.locator('#holdings .priceLine')).toHaveCount(1);
  await expect(page.locator('#detailsToggle')).toHaveText('Piilota tarkemmat luvut');
});

test('quote older than 20 minutes is marked stale while Helsinki is open', async ({ page }) => {
  const old = ms('2026-10-12T10:30:00+03:00');
  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, dayChangePct: 1.52, quoteTimestamp: old })])
  });

  await expect(page.locator('#dailyMoves')).toContainText('vanha');
});

test('Friday close is not called stale on Saturday', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, dayChangePct: 1.52, quoteTimestamp: friClose })])
  });

  await expect(page.locator('[data-quick-symbol="FORTUM"]')).toContainText('pe päätös');
  await expect(page.locator('#dailyMoves')).not.toContainText('vanhaa dataa');
});

test('empty first run renders without crashing', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([])
  });

  await expect(page.locator('#holdingsEmpty')).toContainText('Salkku on tyhjä');
  await expect(page.locator('#portfolioValue')).toContainText('0,00');
});

test('mobile quick view is in the first viewport', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, dayChangePct: 1.52, quoteTimestamp: friClose })])
  });

  const box = await page.locator('#dailyMoves').boundingBox();
  expect(box).not.toBeNull();
  expect(box.y).toBeLessThan(915);
});
