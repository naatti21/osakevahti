import { test, expect } from '@playwright/test';

// Genuine browser OCR: app downloads its own Tesseract script, worker/core and
// fin+eng models. Only market-data resolver is stubbed. This is a network
// diagnostic, never replace failed downloads with injected OCR fixtures.
const KEY = 'osakevahti.single.v1';
const WORKER = 'https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**';
const CDN_HOSTS = /(?:jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|projectnaptha\.com)/i;

test('@ocr-stress @ocr-online real CDN image → browser OCR → import → reload', async ({ page, context }, testInfo) => {
  test.setTimeout(240_000);
  const observations = {
    method: 'real browser CDN / worker / language resources; synthetic market resolver',
    ocrMockInjected: false,
    externalResponses: [],
    externalFailures: [],
    preview: null,
    ocrText: null,
    beforeReload: null,
    afterReload: null
  };
  page.on('response', response => {
    if (CDN_HOSTS.test(response.url())) {
      observations.externalResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('requestfailed', request => {
    if (CDN_HOSTS.test(request.url())) {
      observations.externalFailures.push({
        url: request.url(), reason: request.failure()?.errorText || 'unknown'
      });
    }
  });

  // Do not reseed after reload: that would mask accidental data loss.
  await page.addInitScript(({ key }) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({
        baseCurrency: 'EUR', apiKey: '', holdings: [], news: [],
        quoteUpdatedAt: null, riskBudgetPct: 1.25, showDetails: false
      }));
    }
  }, { key: KEY });

  // Resolver responses are not OCR data. No route intercepts CDN requests.
  await page.route(WORKER, async route => {
    const url = new URL(route.request().url());
    const data = url.pathname === '/resolve'
      ? {
          schema_version: 'instrument-resolver-v1',
          generated_at: '2026-10-12T08:00:00Z',
          provider: 'Synthetic market resolver, not OCR',
          query: url.searchParams.get('q') || '',
          candidates: [{
            symbol: 'ASTR', longname: 'Aster Devices Corporation',
            currency: 'USD', quote_type: 'EQUITY', exchange: 'NMS',
            full_exchange_name: 'NasdaqGS', mic: 'XNAS',
            isin: 'US5949181045'
          }]
        }
      : { schema_version: 'worker-v1.2', generated_at: '2026-10-12T08:00:00Z',
          assets: {}, errors: {}, health: { ok: 0, failed: 0 } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });

  const syntheticPage = await context.newPage();
  await syntheticPage.setViewportSize({ width: 900, height: 820 });
  const document = [
    '<!doctype html><html><body>',
    '<section id="source" style="font-family:Arial,Helvetica,sans-serif;',
    'width:760px; padding:28px; background:white; color:#101010">',
    '<h1 style="font-size:30px; margin:0 0 22px">Portfolio</h1>',
    '<h2 style="font-size:32px; margin:0 0 14px">Aster Devices Corporation</h2>',
    '<div style="font-size:27px;line-height:1.5">Ticker ASTR</div>',
    '<div style="font-size:27px;line-height:1.5">12 kpl</div>',
    '<div style="font-size:27px;line-height:1.5">GAV 35 USD</div>',
    '<div style="font-size:27px;line-height:1.5">ISIN US5949181045</div>',
    '<div style="font-size:27px;line-height:1.5">MIC XNAS</div>',
    '</section></body></html>'
  ].join('');
  await syntheticPage.setContent(document);
  const screenshot = await syntheticPage.locator('#source').screenshot();
  await testInfo.attach('anonymous-source.png', { body: screenshot, contentType: 'image/png' });
  await syntheticPage.close();

  try {
    await page.goto('/index.html');
    await expect(page.locator('#dailyMoves')).toBeVisible();
    await page.locator('[data-view="settingsView"]').click();
    await page.locator('summary').filter({ hasText: 'Salkun tuonti' }).click();

    observations.ocrMockInjected = await page.evaluate(
      () => typeof window.__OSAKEVAHTI_TEST_OCR__ === 'function'
    );
    expect(observations.ocrMockInjected, 'No OCR test interception allowed').toBe(false);

    await page.locator('#importImage').setInputFiles({
      name: 'qa-online-source.png', mimeType: 'image/png', buffer: screenshot
    });

    // First use can download WASM and both Finnish/English language models.
    // Timeouts and network errors must remain visible FAILED diagnostics.
    await page.waitForFunction(() => {
      const dlg = document.querySelector('#importReviewDlg');
      const status = document.querySelector('#imageImportStatus');
      return !!dlg?.open || status?.classList.contains('statusBad');
    }, undefined, { timeout: 170_000 });

    observations.preview = await page.locator('#imageImportStatus').innerText();
    observations.ocrText = await page.locator('#imageOcrText').inputValue();
    await testInfo.attach('browser-ocr-output.txt', {
      body: Buffer.from(observations.ocrText, 'utf8'), contentType: 'text/plain'
    });
    expect(observations.preview, 'OCR cannot silently reject the image').not.toMatch(/epäonnistui|ei löytynyt/i);
    await expect(page.locator('#importReviewDlg'), 'OCR import review must open').toBeVisible();
    await expect(page.locator('#importReviewDlg')).toContainText('Aster Devices');
    await expect(page.locator('#confirmImportReview')).toBeEnabled();

    await page.locator('#confirmImportReview').click();
    observations.beforeReload = await page.evaluate(key => {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      return data.holdings || [];
    }, KEY);
    expect(observations.beforeReload).toHaveLength(1);
    expect(observations.beforeReload[0].quantity).toBe(12);
    expect(observations.beforeReload[0].importMeta.sourceIdentifiers.isin).toBe('US5949181045');
    expect(observations.beforeReload[0].importMeta.sourceIdentifiers.mic).toBe('XNAS');

    await page.reload();
    await expect(page.locator('#dailyMoves')).toBeVisible();
    observations.afterReload = await page.evaluate(key => {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      return data.holdings || [];
    }, KEY);
    expect(observations.afterReload).toEqual(observations.beforeReload);
    expect(observations.externalResponses.length,
      'No external CDN response observed for real OCR').toBeGreaterThan(0);
  } finally {
    await testInfo.attach('online-ocr-network-and-storage.json', {
      body: Buffer.from(JSON.stringify(observations, null, 2), 'utf8'),
      contentType: 'application/json'
    });
  }
});
