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
  marketGeneratedAt = '2026-10-09T12:00:00Z', fx = { USD: 0.86, SEK: 0.091 },
  marketContext = { assets: {} }, portfolioNews = [], instrumentResolver = {}
} = {}) {
  await page.route(WORKER, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/resolve') {
      const q = url.searchParams.get('q') || '';
      const candidates = instrumentResolver[q] || [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 'instrument-resolver-v1',
          generated_at: marketGeneratedAt,
          provider: 'Yahoo Finance search + chart metadata',
          query: q,
          candidates
        })
      });
    }
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
    body: JSON.stringify({ generated_at: sharedGeneratedAt, assets: sharedAssets, market_context: marketContext })
  }));

  await page.route('**/risk-data.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ assets: {} })
  }));
  await page.route('**/market-context.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(marketContext)
  }));
  await page.route('**/portfolio-news.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: portfolioNews })
  }));
  await page.route('**/dividend-rocket-insights.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({})
  }));
  await page.route('**/insights.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({})
  }));
  await page.route('**/news-data.json*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] })
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


test('equal timestamp prefers Worker over GitHub fallback', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 22, quoteTimestamp: friClose })]),
    network: {
      marketGeneratedAt: '2026-10-12T07:59:00Z',
      workerAssets: {
        FORTUM: { price: 24.50, quote_timestamp: mon1059, day_change_pct: 1.2, source: 'Yahoo Finland', delayed: false }
      },
      marketQuotes: {
        FORTUM: { price: 24.30, timestamp: mon1059, change_pct: 1.1, provider: 'GitHub snapshot', realtime: false }
      }
    }
  });

  await page.locator('#refreshBtn').click();
  await expect(page.locator('[data-quick-symbol="FORTUM"]')).toContainText('24,50');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(stored.holdings[0].quoteSource).toBe('WORKER');
});

test('GitHub snapshot fills a quote when Worker has no matching symbol', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 22, quoteTimestamp: friClose })]),
    network: {
      workerAssets: {},
      marketQuotes: {
        FORTUM: { price: 24.30, timestamp: mon1059, change_pct: 1.1, provider: 'GitHub snapshot', realtime: false }
      }
    }
  });

  await page.locator('#refreshBtn').click();
  await expect(page.locator('[data-quick-symbol="FORTUM"]')).toContainText('24,30');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(stored.holdings[0].quoteSource).toBe('HELSINKI_CACHE');
});

test('shared status without a timestamp cannot overwrite an existing quote', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 24.50, quoteTimestamp: mon1059 })]),
    network: {
      sharedGeneratedAt: null,
      sharedAssets: {
        FORTUM: { price: 21.00, day_change_pct: -4.2, source: 'timestamp missing' }
      }
    }
  });

  await expect(page.locator('[data-quick-symbol="FORTUM"]')).toContainText('24,50');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(stored.holdings[0].currentPrice).toBe(24.5);
});

test('newer shared status may fill a missing quote', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 0, quoteTimestamp: null })]),
    network: {
      sharedGeneratedAt: '2026-10-12T07:59:00Z',
      sharedAssets: {
        FORTUM: { price: 23.80, day_change_pct: 0.7, quote_timestamp: mon1059, source: 'shared status' }
      }
    }
  });

  await expect(page.locator('[data-quick-symbol="FORTUM"]')).toContainText('23,80');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(stored.holdings[0].quoteSource).toBe('PORTFOLIO_STATUS');
});

test('13 minute Helsinki trade is a recent trade, not stale data', async ({ page }) => {
  const thirteenMinutesOld = ms('2026-10-12T10:47:00+03:00');
  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([stock({
      id: 'f', symbol: 'FORTUM', currentPrice: 24.10,
      dayChangePct: 0.4, quoteTimestamp: thirteenMinutesOld
    })])
  });

  const quick = page.locator('#dailyMoves');
  await expect(quick).toContainText('kauppa 13 min');
  await expect(quick).not.toContainText('vanhaa dataa');
});

test('details preference is persisted when changed', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, quoteTimestamp: friClose })])
  });

  await page.locator('#detailsToggle').click();
  await expect(page.locator('#detailsToggle')).toHaveText('Piilota tarkemmat luvut');
  await expect(page.locator('#holdings .priceLine')).toHaveCount(1);

  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(stored.showDetails).toBe(true);
});

test('same ticker in OST and AOT stays as two separate holdings', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({ id: 'ost-f', symbol: 'FORTUM', quantity: 10, account: 'OST', currentPrice: 23.39, quoteTimestamp: friClose }),
      stock({ id: 'aot-f', symbol: 'FORTUM', quantity: 5, account: 'AOT', currentPrice: 23.39, quoteTimestamp: friClose })
    ])
  });

  await expect(page.locator('#holdings .item')).toHaveCount(2);
  await expect(page.locator('#holdings')).toContainText('10 kpl · OST');
  await expect(page.locator('#holdings')).toContainText('5 kpl · AOT');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(stored.holdings.map(h => h.account).sort()).toEqual(['AOT', 'OST']);
});

test('fund NAV is excluded from stock daily moves', async ({ page }) => {
  const fund = {
    id: 'fund-1', symbol: 'FUND', name: 'Testirahasto', quantity: 12,
    buyPrice: 10, currentPrice: 12, currency: 'EUR', account: 'Rahastot',
    assetType: 'fund', fxRate: 1, navDate: '2026-10-09'
  };
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([fund])
  });

  await expect(page.locator('#holdings')).toContainText('Testirahasto');
  await expect(page.locator('#dailyMoves')).not.toContainText('FUND');
});

test('USD holding uses FX rate in portfolio value', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({
        id: 'amd', symbol: 'AMD', quantity: 2, buyPrice: 100,
        currentPrice: 200, currency: 'USD', fxRate: 0.86,
        quoteTimestamp: ms('2026-10-09T15:59:00-04:00'), quoteProvider: 'Finnhub'
      })
    ])
  });

  await expect(page.locator('#portfolioValue')).toContainText('344,00');
});

test('mobile layout has no horizontal page overflow', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, quoteTimestamp: friClose })])
  });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('market-driven technical warning does not become an automatic sell action', async ({ page }) => {
  const h = stock({
    id: 'f', symbol: 'FORTUM', currentPrice: 100, buyPrice: 80,
    dayChangePct: -2.2, quoteTimestamp: mon1059, targetWeight: 0
  });
  h.manualStop = 98;
  h.trailingPct = 0;
  h.highWatermark = 100;

  const marketContext = {
    assets: {
      HELSINKI: { day_change_pct: -2.0 },
      EUROPE: { day_change_pct: -1.0 },
      SP_FUT: { day_change_pct: -1.0 },
      NQ_FUT: { day_change_pct: -1.1 }
    }
  };

  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([h]),
    network: { marketContext }
  });

  await page.locator('[data-view="riskView"]').click();
  await expect(page.locator('#risks')).toContainText('EI TOIMENPIDETTÄ');
  await expect(page.locator('#risks')).toContainText('Tekninen taso yksin ei riitä toimenpiteeseen');
});

test('corrupt local state falls back to an empty app instead of crashing', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-10T08:00:00+03:00') });
  await page.addInitScript(key => localStorage.setItem(key, '{not-valid-json'), KEY);
  await mockNetwork(page);
  await page.goto('/index.html');

  await expect(page.locator('#holdingsEmpty')).toContainText('Salkku on tyhjä');
  await expect(page.locator('#portfolioValue')).toContainText('0,00');
});


test('backup export excludes Finnhub API key', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState(
      [stock({ id: 'f', symbol: 'FORTUM', currentPrice: 23.39, quoteTimestamp: friClose })],
      { apiKey: 'SECRET-KEY-MUST-NOT-LEAVE-DEVICE' }
    )
  });

  await page.locator('[data-view="settingsView"]').click();
  const backupDetails = page.locator('details').filter({ hasText: 'Varmuuskopio' });
  await backupDetails.locator('summary').click();
  await expect(page.locator('#exportBtn')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let raw = '';
  for await (const chunk of stream) raw += chunk.toString();
  const backup = JSON.parse(raw);

  expect(backup.apiKey).toBeUndefined();
  expect(backup.holdings).toHaveLength(1);
  expect(backup.holdings[0].symbol).toBe('FORTUM');
});

test('portfolio target weight is written in plain language', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({
        id: 'f', symbol: 'FORTUM', quantity: 10, currentPrice: 20,
        buyPrice: 18, targetWeight: 10, quoteTimestamp: friClose
      }),
      stock({
        id: 'n', symbol: 'NDA-FI', quantity: 10, currentPrice: 10,
        buyPrice: 9, targetWeight: 8, quoteTimestamp: friClose
      })
    ])
  });

  await page.locator('#detailsToggle').click();
  const badge = page.locator('#holdings .weightBadge').first();
  await expect(badge).toContainText('Salkusta');
  await expect(badge).toContainText('tavoite');
  await expect(badge).not.toContainText('→');
});


test('holding numbers explain value, return and price', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({
        id: 'f', symbol: 'FORTUM', quantity: 10, currentPrice: 23.39,
        buyPrice: 20, dayChangePct: 1.2, quoteTimestamp: friClose
      })
    ])
  });

  const card = page.locator('#holdings .item').first();
  await expect(card).toContainText('Arvo');
  await expect(card).toContainText('Tuotto');

  await page.locator('#detailsToggle').click();
  await expect(card).toContainText('Kurssi');
});

test('market context explains volatility indicators and semiconductor sector', async ({ page }) => {
  const marketContext = {
    assets: {
      HELSINKI: { price: 5000, day_change_pct: -0.4 },
      EUROPE: { price: 6100, day_change_pct: -0.6 },
      SP_FUT: { price: 7000, day_change_pct: -0.3 },
      NQ_FUT: { price: 26000, day_change_pct: -0.7 },
      SOX: { price: 13000, day_change_pct: -1.8 },
      VIX: { price: 25.4, day_change_pct: 8.2 },
      VSTOXX: { price: 22.1, day_change_pct: 5.1 },
      VXN: { price: 29.7, day_change_pct: 7.4 }
    }
  };

  await openApp(page, {
    time: '2026-10-12T11:00:00+03:00',
    state: appState([
      stock({ id: 'amd', symbol: 'AMD', currentPrice: 200, dayChangePct: -4.5, quoteTimestamp: mon1059, currency: 'USD', fxRate: 0.86 })
    ]),
    network: { marketContext }
  });

  await page.locator('[data-view="riskView"]').click();
  const context = page.locator('#marketContext');

  await expect(context).toContainText('VIX');
  await expect(context).toContainText('25.4');
  await expect(context).toContainText('USA:n odotettu heilunta');
  await expect(context).toContainText('SOX');
  await expect(context).toContainText('Puolijohdesektori');

  await context.locator('summary').click();
  await expect(context).toContainText('ei automaattisesti laskua');
  await expect(context).toContainText('Nasdaq-100:n odotettu');
});


test('instrument migration does not guess an ambiguous IQM listing from company name', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({
        id: 'iqm-us-or-fi',
        symbol: 'IQM',
        name: 'IQM Quantum Computers',
        currentPrice: 12,
        buyPrice: 10,
        currency: 'EUR',
        quoteTimestamp: friClose
      })
    ])
  });

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  const h = saved.holdings[0];

  expect(h.symbol).toBe('IQM');
  expect(h.instrument.listingTicker).toBe('IQM');
  expect(h.instrument.dataKey).toBe('IQM');
  expect(h.instrument.identification).toBe('legacy-unverified');
});

test('CSV import previews ambiguous IQM listing and never guesses it silently', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([]),
    network: {
      instrumentResolver: {
        'IQM Quantum Computers': [
          {
            symbol: 'IQM', longname: 'IQM Quantum Computers',
            exchange: 'NMS', exchange_display: 'NASDAQ', full_exchange_name: 'NasdaqGS',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'USD'
          },
          {
            symbol: 'IQMX.HE', longname: 'IQM Quantum Computers',
            exchange: 'HEL', exchange_display: 'Helsinki', full_exchange_name: 'Helsinki',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'EUR'
          }
        ]
      }
    }
  });

  await page.locator('[data-view="settingsView"]').click();

  const csv = [
    'symbol,name,quantity,buy_price,currency,account',
    'IQM,IQM Quantum Computers,5,10,EUR,AOT'
  ].join('\n');

  await page.locator('#importCsv').setInputFiles({
    name: 'portfolio.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv)
  });

  const dialog = page.locator('#importReviewDlg');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('TARKISTA');
  await expect(dialog).toContainText('IQM · NasdaqGS · USD');
  await expect(dialog).toContainText('IQMX.HE · Helsinki · EUR');

  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(before.holdings).toHaveLength(0);

  await dialog.getByRole('button', { name: 'Jätä tunnistamatta' }).click();
  await expect(page.locator('#confirmImportReview')).toBeEnabled();

  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(1);
  expect(saved.holdings[0].symbol).toBe('IQM');
  expect(saved.holdings[0].providerSymbol).toBe('');
  expect(saved.holdings[0].instrument.identification).toBe('unverified');
});

test('CSV import auto-resolves a clear MSFT listing but still requires preview approval', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([]),
    network: {
      instrumentResolver: {
        'Microsoft Corporation': [
          {
            symbol: 'MSFT', longname: 'Microsoft Corporation',
            exchange: 'NMS', exchange_display: 'NASDAQ', full_exchange_name: 'NasdaqGS',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'USD'
          },
          {
            symbol: 'MSF.DE', longname: 'Microsoft Corporation',
            exchange: 'GER', exchange_display: 'XETRA', full_exchange_name: 'XETRA',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'EUR'
          }
        ]
      }
    }
  });

  await page.locator('[data-view="settingsView"]').click();

  const csv = [
    'symbol,name,quantity,buy_price,currency,account',
    'MSFT,Microsoft Corporation,2,400,USD,AOT'
  ].join('\n');

  await page.locator('#importCsv').setInputFiles({
    name: 'portfolio.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv)
  });

  const dialog = page.locator('#importReviewDlg');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('AUTOMAATTINEN');
  await expect(dialog).toContainText('MSFT · NasdaqGS · USD');
  await expect(page.locator('#confirmImportReview')).toBeEnabled();

  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(before.holdings).toHaveLength(0);

  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(1);
  expect(saved.holdings[0].symbol).toBe('MSFT');
  expect(saved.holdings[0].providerSymbol).toBe('MSFT');
  expect(saved.holdings[0].instrument.identification).toBe('resolved');
  expect(saved.holdings[0].instrument.exchange).toBe('NasdaqGS');
});

test('CSV import keeps explicit MIC and exchange identity without remote guessing', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([])
  });

  await page.locator('[data-view="settingsView"]').click();

  const csv = [
    'symbol,name,quantity,buy_price,currency,account,isin,mic,exchange,listing_ticker,provider_symbol',
    'MSFT,Microsoft Corporation,2,400,USD,AOT,,XNAS,NASDAQ,MSFT,MSFT'
  ].join('\n');

  await page.locator('#importCsv').setInputFiles({
    name: 'portfolio.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv)
  });

  const dialog = page.locator('#importReviewDlg');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('LÄHTEESTÄ');

  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  const msft = saved.holdings[0];
  expect(msft.instrument.mic).toBe('XNAS');
  expect(msft.instrument.exchange).toBe('NASDAQ');
  expect(msft.instrument.providerSymbol).toBe('MSFT');
  expect(msft.instrument.identification).toBe('explicit-source');
});


test('pasted Finnish spreadsheet table imports through the same preview and preserves existing holdings', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({ id: 'fortum-existing', symbol: 'FORTUM', name: 'Fortum', quantity: 86, buyPrice: 13, currentPrice: 14, currency: 'EUR', account: 'OST', quoteTimestamp: friClose })
    ]),
    network: {
      instrumentResolver: {
        'Microsoft Corporation': [
          {
            symbol: 'MSFT', longname: 'Microsoft Corporation',
            exchange: 'NMS', exchange_display: 'NASDAQ', full_exchange_name: 'NasdaqGS',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'USD'
          }
        ]
      }
    }
  });

  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();
  await page.locator('#importText').fill([
    'Ticker\tNimi\tKpl\tKeskihinta\tValuutta\tTili',
    'MSFT\tMicrosoft Corporation\t2\t400\tUSD\tAOT'
  ].join('\n'));
  await page.locator('#importTextBtn').click();

  const dialog = page.locator('#importReviewDlg');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('AUTOMAATTINEN');
  await expect(dialog).toContainText('MSFT · NasdaqGS · USD');

  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(2);
  expect(saved.holdings.some(h => h.id === 'fortum-existing')).toBeTruthy();
  const msft = saved.holdings.find(h => h.symbol === 'MSFT');
  expect(msft.quantity).toBe(2);
  expect(msft.importMeta.source).toBe('pasted-table');
});

test('repeating the same explicit import updates the holding instead of duplicating it', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([])
  });

  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();

  const first = [
    'Ticker\tNimi\tKpl\tKeskihinta\tValuutta\tTili\tMIC\tPörssi',
    'MSFT\tMicrosoft Corporation\t2\t400\tUSD\tAOT\tXNAS\tNASDAQ'
  ].join('\n');
  await page.locator('#importText').fill(first);
  await page.locator('#importTextBtn').click();
  await expect(page.locator('#importReviewDlg')).toContainText('LÄHTEESTÄ');
  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const firstSaved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(firstSaved.holdings).toHaveLength(1);
  const firstId = firstSaved.holdings[0].id;

  const second = [
    'Ticker\tNimi\tKpl\tKeskihinta\tValuutta\tTili\tMIC\tPörssi',
    'MSFT\tMicrosoft Corporation\t3\t410\tUSD\tAOT\tXNAS\tNASDAQ'
  ].join('\n');
  await page.locator('#importText').fill(second);
  await page.locator('#importTextBtn').click();
  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(1);
  expect(saved.holdings[0].id).toBe(firstId);
  expect(saved.holdings[0].quantity).toBe(3);
  expect(saved.holdings[0].buyPrice).toBe(410);
});

test('table import refuses a missing quantity column without changing portfolio data', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({ id: 'keep-me', symbol: 'FORTUM', name: 'Fortum', quantity: 10, quoteTimestamp: friClose })
    ])
  });

  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();
  await page.locator('#importText').fill([
    'Ticker\tNimi\tKeskihinta\tValuutta',
    'MSFT\tMicrosoft Corporation\t400\tUSD'
  ].join('\n'));

  let message = '';
  page.once('dialog', async d => { message = d.message(); await d.accept(); });
  await page.locator('#importTextBtn').click();
  await expect.poll(() => message).toContain('puuttuu määrä');
  await expect(page.locator('#importReviewDlg')).not.toBeVisible();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(1);
  expect(saved.holdings[0].id).toBe('keep-me');
});

test('missing currency is not silently defaulted to EUR and resolver may supply it', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([]),
    network: {
      instrumentResolver: {
        'Microsoft Corporation': [
          {
            symbol: 'MSFT', longname: 'Microsoft Corporation',
            exchange: 'NMS', exchange_display: 'NASDAQ', full_exchange_name: 'NasdaqGS',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'USD'
          },
          {
            symbol: 'MSF.DE', longname: 'Microsoft Corporation',
            exchange: 'GER', exchange_display: 'XETRA', full_exchange_name: 'XETRA',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'EUR'
          }
        ]
      }
    }
  });

  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();
  await page.locator('#importText').fill([
    'Ticker\tCompany\tShares\tAvg Price\tAccount',
    'MSFT\tMicrosoft Corporation\t2\t400\tAOT'
  ].join('\n'));
  await page.locator('#importTextBtn').click();

  const dialog = page.locator('#importReviewDlg');
  await expect(dialog).toContainText('AUTOMAATTINEN');
  await expect(dialog).toContainText('MSFT · NasdaqGS · USD');

  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(1);
  expect(saved.holdings[0].currency).toBe('USD');
});

test('semicolon table supports Finnish headers and decimal comma', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([])
  });

  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();
  await page.locator('#importText').fill([
    'Ticker;Nimi;Kpl;Keskihinta;Valuutta;Tili;MIC;Pörssi',
    'NDA-FI;Nordea Bank;91;12,34;EUR;OST;XHEL;Helsinki'
  ].join('\n'));
  await page.locator('#importTextBtn').click();

  const dialog = page.locator('#importReviewDlg');
  await expect(dialog).toContainText('LÄHTEESTÄ');
  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(1);
  expect(saved.holdings[0].symbol).toBe('NDA-FI');
  expect(saved.holdings[0].quantity).toBe(91);
  expect(saved.holdings[0].buyPrice).toBeCloseTo(12.34, 6);
  expect(saved.holdings[0].instrument.mic).toBe('XHEL');
});

test('comma CSV keeps quoted company names intact', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([]),
    network: {
      instrumentResolver: {
        'Microsoft, Corporation': [
          {
            symbol: 'MSFT', longname: 'Microsoft Corporation',
            exchange: 'NMS', exchange_display: 'NASDAQ', full_exchange_name: 'NasdaqGS',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'USD'
          }
        ]
      }
    }
  });

  await page.locator('[data-view="settingsView"]').click();
  const csv = [
    'Ticker,Company,Shares,Avg Price,Currency,Account',
    'MSFT,"Microsoft, Corporation",2,400.5,USD,AOT'
  ].join('\n');
  await page.locator('#importCsv').setInputFiles({
    name: 'portfolio.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv)
  });

  await expect(page.locator('#importReviewDlg')).toContainText('AUTOMAATTINEN');
  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(1);
  expect(saved.holdings[0].name).toBe('Microsoft, Corporation');
  expect(saved.holdings[0].buyPrice).toBeCloseTo(400.5, 6);
});


test('screenshot import uses local OCR text and keeps existing holdings intact', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({ id: 'fortum-existing', symbol: 'FORTUM', name: 'Fortum', quantity: 86, currentPrice: 14, quoteTimestamp: friClose })
    ]),
    network: {
      instrumentResolver: {
        'Microsoft Corporation': [
          {
            symbol: 'MSFT', longname: 'Microsoft Corporation',
            exchange: 'NMS', exchange_display: 'NASDAQ', full_exchange_name: 'NasdaqGS',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'USD'
          },
          {
            symbol: 'MSF.DE', longname: 'Microsoft Corporation',
            exchange: 'GER', exchange_display: 'XETRA', full_exchange_name: 'XETRA',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'EUR'
          }
        ]
      }
    }
  });

  await page.evaluate(() => {
    window.__OSAKEVAHTI_TEST_OCR__ = async () => ({
      text: 'Microsoft Corporation\\nTicker MSFT\\n2 kpl\\nGAV 400 USD',
      lines: [
        { text: 'Microsoft Corporation', confidence: 98 },
        { text: 'Ticker MSFT', confidence: 98 },
        { text: '2 kpl', confidence: 98 },
        { text: 'GAV 400 USD', confidence: 98 }
      ]
    });
  });

  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();
  await page.locator('#importImage').setInputFiles({
    name: 'portfolio.png',
    mimeType: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71])
  });

  const dialog = page.locator('#importReviewDlg');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('AUTOMAATTINEN');
  await expect(dialog).toContainText('MSFT · NasdaqGS · USD');

  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(2);
  expect(saved.holdings.some(h => h.id === 'fortum-existing')).toBeTruthy();
  const msft = saved.holdings.find(h => h.symbol === 'MSFT');
  expect(msft.quantity).toBe(2);
  expect(msft.buyPrice).toBe(400);
  expect(msft.importMeta.source).toBe('screenshot:portfolio.png');
});

test('screenshot IQM without explicit ticker stays in review instead of being guessed', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([]),
    network: {
      instrumentResolver: {
        'IQM Quantum Computers': [
          {
            symbol: 'IQM', longname: 'IQM Quantum Computers',
            exchange: 'NMS', exchange_display: 'NASDAQ', full_exchange_name: 'NasdaqGS',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'USD'
          },
          {
            symbol: 'IQMX.HE', longname: 'IQM Quantum Computers',
            exchange: 'HEL', exchange_display: 'Helsinki', full_exchange_name: 'Helsinki',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'EUR'
          }
        ]
      }
    }
  });

  await page.evaluate(() => {
    window.__OSAKEVAHTI_TEST_OCR__ = async () => ({
      text: 'IQM Quantum Computers\\n55 kpl\\nGAV 9,84 EUR',
      lines: [
        { text: 'IQM Quantum Computers', confidence: 97 },
        { text: '55 kpl', confidence: 96 },
        { text: 'GAV 9,84 EUR', confidence: 95 }
      ]
    });
  });

  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();
  await page.locator('#importImage').setInputFiles({
    name: 'iqm.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([255, 216, 255])
  });

  const dialog = page.locator('#importReviewDlg');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('TARKISTA');
  await expect(dialog).toContainText('IQM · NasdaqGS · USD');
  await expect(dialog).toContainText('IQMX.HE · Helsinki · EUR');

  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(before.holdings).toHaveLength(0);

  await dialog.getByRole('button', { name: /IQMX\.HE/ }).click();
  page.once('dialog', d => d.accept());
  await page.locator('#confirmImportReview').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(1);
  expect(saved.holdings[0].symbol).toBe('IQMX.HE');
  expect(saved.holdings[0].instrument.identification).toBe('user-confirmed');
});

test('low confidence screenshot quantity does not change portfolio', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([
      stock({ id: 'keep-me', symbol: 'FORTUM', name: 'Fortum', quantity: 10, quoteTimestamp: friClose })
    ])
  });

  await page.evaluate(() => {
    window.__OSAKEVAHTI_TEST_OCR__ = async () => ({
      text: 'Microsoft Corporation\\n2 kpl\\nGAV 400 USD',
      lines: [
        { text: 'Microsoft Corporation', confidence: 98 },
        { text: '2 kpl', confidence: 32 },
        { text: 'GAV 400 USD', confidence: 96 }
      ]
    });
  });

  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();
  await page.locator('#importImage').setInputFiles({
    name: 'blurry.png',
    mimeType: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71])
  });

  await expect(page.locator('#importReviewDlg')).not.toBeVisible();
  await expect(page.locator('#imageImportStatus')).toContainText('yhtään omistusriviä ei tunnistettu');

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.holdings).toHaveLength(1);
  expect(saved.holdings[0].id).toBe('keep-me');
});

test('user can correct OCR text locally and re-run the same resolver pipeline', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([]),
    network: {
      instrumentResolver: {
        'Microsoft Corporation': [
          {
            symbol: 'MSFT', longname: 'Microsoft Corporation',
            exchange: 'NMS', exchange_display: 'NASDAQ', full_exchange_name: 'NasdaqGS',
            quote_type: 'EQUITY', instrument_type: 'EQUITY', currency: 'USD'
          }
        ]
      }
    }
  });

  await page.evaluate(() => {
    window.__OSAKEVAHTI_TEST_OCR__ = async () => ({
      text: 'Microsoft Corporation\\nTicker MSFT\\n2 kpI\\nGAV 400 USD',
      lines: [
        { text: 'Microsoft Corporation', confidence: 98 },
        { text: 'Ticker MSFT', confidence: 98 },
        { text: '2 kpI', confidence: 96 },
        { text: 'GAV 400 USD', confidence: 96 }
      ]
    });
  });

  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();
  await page.locator('#importImage').setInputFiles({
    name: 'ocr-typo.png',
    mimeType: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71])
  });

  await expect(page.locator('#imageImportStatus')).toContainText('yhtään omistusriviä ei tunnistettu');
  await page.locator('#ocrTextDetails summary').click();
  await page.locator('#imageOcrText').fill('Microsoft Corporation\\nTicker MSFT\\n2 kpl\\nGAV 400 USD');
  await page.locator('#reparseOcrBtn').click();

  const dialog = page.locator('#importReviewDlg');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('AUTOMAATTINEN');
});

test('image OCR helper module loads without contacting OCR CDN until recognition is requested', async ({ page }) => {
  await openApp(page, {
    time: '2026-10-10T08:00:00+03:00',
    state: appState([])
  });

  const result = await page.evaluate(async () => {
    const mod = await import('./image-reader.js');
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t10\t20\t80\t18\t96\tMicrosoft',
      '5\t1\t1\t1\t1\t2\t100\t20\t100\t18\t95\tCorporation'
    ].join('\n');
    return mod.tsvToLines(tsv, '');
  });

  expect(result).toHaveLength(1);
  expect(result[0].text).toBe('Microsoft Corporation');
  expect(result[0].confidence).toBeGreaterThan(95);
});
