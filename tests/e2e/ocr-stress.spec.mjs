import { test, expect } from '@playwright/test';
import { createWorker } from 'tesseract.js';

const KEY = 'osakevahti.single.v1';
const WORKER = 'https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**';

let ocrWorker;

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

function normalizeQuery(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findResolverCandidates(query, resolver) {
  const q = normalizeQuery(query);
  for (const [needle, candidates] of Object.entries(resolver)) {
    if (q.includes(normalizeQuery(needle))) return candidates;
  }
  return [];
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
          provider: 'Synthetic resolver fixture',
          query: q,
          candidates: findResolverCandidates(q, instrumentResolver)
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

async function realOcr(png, testInfo) {
  const result = await ocrWorker.recognize(png);
  const text = String(result?.data?.text || '').trim();
  const confidence = Number.isFinite(result?.data?.confidence) ? result.data.confidence : null;
  await testInfo.attach('ocr-output.txt', { body: Buffer.from(text, 'utf8'), contentType: 'text/plain' });
  return {
    text,
    lines: text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, i) => ({ text: line, confidence, top: i * 20, left: 0 }))
  };
}

async function injectRealOcrResult(page, ocr) {
  await page.evaluate(value => {
    window.__OSAKEVAHTI_TEST_OCR__ = async () => value;
  }, ocr);
}

test.describe('@ocr-stress synthetic screenshots through real Tesseract OCR', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    ocrWorker = await createWorker('eng', 1);
  });

  test.afterAll(async () => {
    if (ocrWorker) await ocrWorker.terminate();
  });

  test('clear MSFT screenshot becomes a strong automatic listing candidate', async ({ page, context }, testInfo) => {
    await openApp(page, {
      'microsoft': [
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
    const ocr = await realOcr(png, testInfo);
    await injectRealOcrResult(page, ocr);

    await page.locator('#importImage').setInputFiles({
      name: 'synthetic-msft.png',
      mimeType: 'image/png',
      buffer: png
    });

    const dialog = page.locator('#importReviewDlg');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText('AUTOMAATTINEN');
    await expect(dialog).toContainText('MSFT · NasdaqGS · USD');
  });

  test('IQM screenshot without ticker stays ambiguous and requires a listing choice', async ({ page, context }, testInfo) => {
    await openApp(page, {
      'iqm quantum': [
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
    const ocr = await realOcr(png, testInfo);
    await injectRealOcrResult(page, ocr);

    await page.locator('#importImage').setInputFiles({
      name: 'synthetic-iqm.png',
      mimeType: 'image/png',
      buffer: png
    });

    const dialog = page.locator('#importReviewDlg');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText('TARKISTA');
    await expect(dialog).toContainText('IQM · NasdaqGS · USD');
    await expect(dialog).toContainText('IQMX.HE · Helsinki · EUR');
    await expect(page.locator('#confirmImportReview')).toBeDisabled();
  });

  test('dark screenshot with smaller type still yields a conservative holding candidate', async ({ page, context }, testInfo) => {
    await openApp(page, {
      'advanced micro': [
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
    const ocr = await realOcr(png, testInfo);
    await injectRealOcrResult(page, ocr);

    await page.locator('#importImage').setInputFiles({
      name: 'synthetic-amd-dark.png',
      mimeType: 'image/png',
      buffer: png
    });

    const dialog = page.locator('#importReviewDlg');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText('AMD');
    await expect(page.locator('#imageImportStatus')).toContainText('omistusehdokasta');
  });
});
