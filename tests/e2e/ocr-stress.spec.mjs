import { test, expect } from '@playwright/test';

const KEY = 'osakevahti.single.v1';
const WORKER = 'https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**';

function appState() {
  return {
    baseCurrency: 'EUR',
    apiKey: '',
    holdings: [],
    news: [],
    quoteUpdatedAt: null,
    riskBudgetPct: 1.25,
    showDetails: false
  };
}

async function seed(page) {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: KEY, value: appState() });
}

async function mockNetwork(page, instrumentResolver = {}) {
  await page.route(WORKER, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/resolve') {
      const q = url.searchParams.get('q') || '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 'instrument-resolver-v1',
          generated_at: new Date().toISOString(),
          provider: 'Yahoo Finance search + chart metadata',
          query: q,
          candidates: instrumentResolver[q] || []
        })
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schema_version: 'worker-v1.2',
        generated_at: new Date().toISOString(),
        cache_ttl_seconds: 60,
        assets: {},
        errors: {},
        health: { ok: 0, failed: 0 }
      })
    });
  });

  for (const path of [
    'market-data.json',
    'portfolio-status.json',
    'risk-data.json',
    'market-context.json',
    'portfolio-news.json',
    'dividend-rocket-insights.json',
    'insights.json',
    'news-data.json'
  ]) {
    await page.route(`**/${path}*`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(path.includes('news') ? { items: [] } : { assets: {}, metrics: {} })
    }));
  }

  await page.route('https://api.frankfurter.app/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ rates: { EUR: 1, USD: 0.86, SEK: 0.091 } })
  }));
}

async function openApp(page, resolver = {}) {
  await seed(page);
  await mockNetwork(page, resolver);
  await page.goto('/index.html');
  await expect(page.locator('#dailyMoves')).toBeVisible();
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();
}

async function syntheticPortfolioImage(context, testInfo, {
  title = 'Portfolio',
  rows = [],
  dark = false,
  fontSize = 28,
  width = 720
}) {
  const p = await context.newPage();
  await p.setViewportSize({ width, height: 1000 });
  const bg = dark ? '#101317' : '#ffffff';
  const fg = dark ? '#f2f4f7' : '#111111';
  const muted = dark ? '#c0c5cc' : '#555555';
  const border = dark ? '#343a42' : '#d7dce2';
  const rowHtml = rows.map(row => `
    <section class="holding">
      <div class="name">${row.name}</div>
      ${row.ticker ? `<div class="ticker">Ticker ${row.ticker}</div>` : ''}
      <div class="meta">${row.quantity} kpl</div>
      ${row.gav ? `<div class="meta">GAV ${row.gav} ${row.currency || ''}</div>` : ''}
    </section>
  `).join('');
  await p.setContent(`<!doctype html><html><body>
    <main class="screen">
      <div class="top">${title}</div>
      ${rowHtml}
    </main>
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:${bg};color:${fg};font-family:Arial,Helvetica,sans-serif}
      .screen{width:${width}px;padding:36px}
      .top{font-size:${Math.max(22,fontSize-4)}px;font-weight:700;margin-bottom:28px;color:${muted}}
      .holding{padding:26px 22px;border:1px solid ${border};border-radius:14px;margin:0 0 18px}
      .name{font-size:${fontSize}px;font-weight:700;line-height:1.2;margin-bottom:9px}
      .ticker{font-size:${Math.max(18,fontSize-6)}px;color:${muted};margin-bottom:9px}
      .meta{font-size:${Math.max(20,fontSize-4)}px;line-height:1.35}
    </style>
  </body></html>`);
  const png = await p.locator('.screen').screenshot();
  await testInfo.attach('synthetic-portfolio.png', { body: png, contentType: 'image/png' });
  await p.close();
  return png;
}

test.describe('@ocr-stress real OCR pipeline', () => {
  test.setTimeout(120_000);

  test('clear MSFT screenshot becomes a strong automatic listing candidate', async ({ page, context }, testInfo) => {
    await openApp(page, {
      'Microsoft Corporation': [
        {
          symbol: 'MSFT',
          longname: 'Microsoft Corporation',
          exchange: 'NMS',
          exchange_display: 'NASDAQ',
          full_exchange_name: 'NasdaqGS',
          quote_type: 'EQUITY',
          instrument_type: 'EQUITY',
          currency: 'USD'
        },
        {
          symbol: 'MSF.DE',
          longname: 'Microsoft Corporation',
          exchange: 'GER',
          exchange_display: 'XETRA',
          full_exchange_name: 'XETRA',
          quote_type: 'EQUITY',
          instrument_type: 'EQUITY',
          currency: 'EUR'
        }
      ]
    });

    const png = await syntheticPortfolioImage(context, testInfo, {
      rows: [{ name: 'Microsoft Corporation', ticker: 'MSFT', quantity: 2, gav: '400.00', currency: 'USD' }]
    });

    await page.locator('#importImage').setInputFiles({
      name: 'synthetic-msft.png',
      mimeType: 'image/png',
      buffer: png
    });

    const dialog = page.locator('#importReviewDlg');
    await expect(dialog).toBeVisible({ timeout: 90_000 });
    await expect(dialog).toContainText('AUTOMAATTINEN', { timeout: 90_000 });
    await expect(dialog).toContainText('MSFT · NasdaqGS · USD');
  });

  test('IQM screenshot without ticker stays ambiguous and requires a listing choice', async ({ page, context }, testInfo) => {
    await openApp(page, {
      'IQM Quantum Computers': [
        {
          symbol: 'IQM',
          longname: 'IQM Quantum Computers',
          exchange: 'NMS',
          exchange_display: 'NASDAQ',
          full_exchange_name: 'NasdaqGS',
          quote_type: 'EQUITY',
          instrument_type: 'EQUITY',
          currency: 'USD'
        },
        {
          symbol: 'IQMX.HE',
          longname: 'IQM Quantum Computers',
          exchange: 'HEL',
          exchange_display: 'Helsinki',
          full_exchange_name: 'Helsinki',
          quote_type: 'EQUITY',
          instrument_type: 'EQUITY',
          currency: 'EUR'
        }
      ]
    });

    const png = await syntheticPortfolioImage(context, testInfo, {
      rows: [{ name: 'IQM Quantum Computers', quantity: 55, gav: '9.84', currency: 'EUR' }]
    });

    await page.locator('#importImage').setInputFiles({
      name: 'synthetic-iqm.png',
      mimeType: 'image/png',
      buffer: png
    });

    const dialog = page.locator('#importReviewDlg');
    await expect(dialog).toBeVisible({ timeout: 90_000 });
    await expect(dialog).toContainText('TARKISTA', { timeout: 90_000 });
    await expect(dialog).toContainText('IQM · NasdaqGS · USD');
    await expect(dialog).toContainText('IQMX.HE · Helsinki · EUR');
    await expect(page.locator('#confirmImportReview')).toBeDisabled();
  });

  test('dark screenshot with smaller type still extracts a conservative holding candidate', async ({ page, context }, testInfo) => {
    await openApp(page, {
      'Advanced Micro Devices': [
        {
          symbol: 'AMD',
          longname: 'Advanced Micro Devices, Inc.',
          exchange: 'NMS',
          exchange_display: 'NASDAQ',
          full_exchange_name: 'NasdaqGS',
          quote_type: 'EQUITY',
          instrument_type: 'EQUITY',
          currency: 'USD'
        }
      ]
    });

    const png = await syntheticPortfolioImage(context, testInfo, {
      dark: true,
      fontSize: 22,
      rows: [{ name: 'Advanced Micro Devices', ticker: 'AMD', quantity: 3, gav: '205.50', currency: 'USD' }]
    });

    await page.locator('#importImage').setInputFiles({
      name: 'synthetic-amd-dark.png',
      mimeType: 'image/png',
      buffer: png
    });

    const dialog = page.locator('#importReviewDlg');
    await expect(dialog).toBeVisible({ timeout: 90_000 });
    await expect(dialog).toContainText('AMD', { timeout: 90_000 });
    await expect(page.locator('#imageImportStatus')).toContainText('omistusehdokasta');
  });
});
