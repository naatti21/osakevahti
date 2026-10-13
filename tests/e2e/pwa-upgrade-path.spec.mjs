import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// Playbook 1.9.2: real Alpha 1 → Alpha 2 PWA update on a shared origin.
// Exact old and new cache names are the shipped Alpha v1 and intended Alpha 2.
// Real Chromium SW + CacheStorage. Never publishes or edits application files.
test.use({ serviceWorkers: 'allow' });

const KEY = 'osakevahti.single.v1';
const CURRENT_CACHE = 'osakevahti-shell-v2.16-alpha3-feeds';
const LEGACY_CACHE = 'osakevahti-shell-v2.16-alpha2';
const FAILED_CACHE = 'osakevahti-shell-qa-broken-v2';
const OTHER_CACHE = 'visual-academy-qa-shell-v1';

const sampleHolding = {
  id: 'SYNTHETIC-KEEP-20261013', symbol: 'MSFT',
  name: 'Synthetic position (not a real portfolio)',
  quantity: 7.25, buyPrice: 123.45, currency: 'USD',
  account: 'Nordea', accountType: 'AOT', broker: 'Nordea',
  accountDetailsConfirmed: true, assetType: 'stock',
  trailingPct: 12, riskClass: 'medium'
};

async function controlledServer() {
  const sw = await readFile('sw.js', 'utf8');
  const html = await readFile('index.html', 'utf8');
  const initial = 'const CACHE = "' + CURRENT_CACHE + '";';
  const safe = '.filter(k => k.startsWith("osakevahti-shell-") && k !== CACHE)';
  expect(sw).toContain(initial);
  expect(sw).toContain(safe);

  // Alpha v1 shipped the same SW logic except for its actual old cache name.
  const legacy = sw.replace(initial, 'const CACHE = "' + LEGACY_CACHE + '";');
  const broken = sw.replace(initial, 'const CACHE = "' + FAILED_CACHE + '";')
    .replace('cache.addAll(SHELL)', 'cache.addAll([...SHELL, "./qa-does-not-exist-upgrade.txt"])');
  let version = 'old';
  const mimetypes = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png',
    '.json': 'application/json'
  };
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    const send = (status, body, type='text/plain; charset=utf-8') => {
      res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'});
      res.end(body);
    };
    if (pathname === '/sw.js') {
      send(200, version === 'old' ? legacy : version === 'new' ? sw : broken,
        'text/javascript; charset=utf-8');
      return;
    }
    if (pathname === '/' || pathname === '/index.html') {
      const marker = '<meta name="qa-installed-build" content="' +
        (version === 'old' ? 'v1' : version === 'new' ? 'v2' : 'failed-v2') + '">';
      // Test-only HTML marker, NOT an application-code modification.
      const servedHtml=version==='old'
        ? html.replace('ALPHA 3 · DATASYÖTTEET','ALPHA 2 · PÄIVITYSTESTI')
          .replace('Osakevahti Alpha 3 · v2.16.2','Osakevahti Alpha 2 · v2.16.2')
        : html;
      send(200, servedHtml.replace('<head>', '<head>' + marker), mimetypes['.html']);
      return;
    }
    if (pathname === '/qa-does-not-exist-upgrade.txt') {
      send(404, 'Deliberate upgrade installation failure'); return;
    }
    try {
      const filename = pathname.slice(1);
      if (!/^(image-reader\.js|manifest\.webmanifest|icon-(192|512)\.png)$/.test(filename)) {
        send(404, 'Not a shell resource'); return;
      }
      const contents = await readFile(filename);
      const suffix = filename.slice(filename.lastIndexOf('.'));
      send(200, contents, mimetypes[suffix] || 'application/octet-stream');
    } catch {
      send(404, 'Shell file missing');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: 'http://127.0.0.1:' + server.address().port,
    release: name => { version = name; },
    close: () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
  };
}

async function installed(page, origin) {
  await page.goto(origin + '/index.html');
  await expect(page.locator('#dailyMoves')).toBeVisible();
  await page.waitForFunction(async cacheName => {
    const keys = await caches.keys();
    return !!navigator.serviceWorker?.controller && keys.includes(cacheName);
  }, LEGACY_CACHE, {timeout: 30_000});
  expect(await page.locator('meta[name="qa-installed-build"]').getAttribute('content')).toBe('v1');
}

async function seedAndCapture(page) {
  await page.evaluate(({key, holding}) => {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    saved.holdings = [holding];
    saved.baseCurrency = 'EUR';
    localStorage.setItem(key, JSON.stringify(saved));
  }, { key: KEY, holding: sampleHolding });
  await page.reload();
  const recorded = await page.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(key));
    return {
      baseCurrency: saved.baseCurrency,
      holding: Object.fromEntries(['id','symbol','quantity','buyPrice','currency',
        'account','accountType','broker','accountDetailsConfirmed']
        .map(field => [field, saved.holdings[0][field]]))
    };
  }, KEY);
  expect(recorded.holding).toMatchObject({
    id: sampleHolding.id, quantity: 7.25, buyPrice: 123.45,
    account: 'Nordea', accountDetailsConfirmed: true
  });
  return recorded;
}

async function capture(page) {
  return page.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(key));
    return {
      baseCurrency: saved.baseCurrency,
      holding: Object.fromEntries(['id','symbol','quantity','buyPrice','currency',
        'account','accountType','broker','accountDetailsConfirmed']
        .map(field => [field, saved.holdings[0][field]]))
    };
  }, KEY);
}

test('PWA update: old installed shell becomes new offline shell without changing saved holdings or sibling app cache', async ({page,context}) => {
  test.setTimeout(90_000);
  const server = await controlledServer();
  try {
    await installed(page, server.url);
    const before = await seedAndCapture(page);
    await page.evaluate(async name => {
      const cache = await caches.open(name);
      await cache.put('/visual-academy/launch', new Response('OTHER_APP_OFFLINE_SAFE'));
    }, OTHER_CACHE);

    server.release('new');
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });
    // A successful new install must activate, take control and prune OLD OWN cache.
    await page.waitForFunction(async ({newName, oldName}) => {
      const keys = await caches.keys();
      const reg = await navigator.serviceWorker.getRegistration();
      return keys.includes(newName) && !keys.includes(oldName)
        && reg?.active?.state === 'activated'
        // The old worker may still control this tab after a new worker
        // activates. Reloading too early can recreate the old cache.
        && navigator.serviceWorker.controller === reg.active;
    }, {newName:CURRENT_CACHE, oldName:LEGACY_CACHE}, {timeout:30_000});

    await page.reload();
    await expect(page.locator('#dailyMoves')).toBeVisible();
    expect(await page.locator('meta[name="qa-installed-build"]').getAttribute('content')).toBe('v2');
    expect(await capture(page)).toEqual(before);

    const cacheResult = await page.evaluate(async name => {
      const keys = await caches.keys();
      const resp = await caches.match('/visual-academy/launch');
      const shell = await caches.open('osakevahti-shell-v2.16-alpha3-feeds');
      const html = await shell.match('/index.html');
      return {keys, other:resp ? await resp.text() : null, shell:html ? await html.text() : null};
    }, OTHER_CACHE);
    expect(cacheResult.keys).toContain(OTHER_CACHE);
    expect(cacheResult.keys).not.toContain(LEGACY_CACHE);
    expect(cacheResult.other).toBe('OTHER_APP_OFFLINE_SAFE');
    expect(cacheResult.shell).toContain('name="qa-installed-build" content="v2"');
    expect(cacheResult.shell).toContain('ALPHA 3 · DATASYÖTTEET');

    // Real Chromium offline navigation against updated SW. No reseeding.
    await context.setOffline(true);
    await page.goto(server.url + '/index.html', {waitUntil:'domcontentloaded',timeout:20_000});
    await expect(page.locator('#dailyMoves')).toBeVisible();
    expect(await page.locator('meta[name="qa-installed-build"]').getAttribute('content')).toBe('v2');
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(await capture(page)).toEqual(before);
  } finally {
    await context.setOffline(false);
    await server.close();
  }
});

test('PWA update: failed install does not erase previously cached app or saved holdings', async ({page,context}) => {
  test.setTimeout(90_000);
  const server = await controlledServer();
  try {
    await installed(page,server.url);
    const before = await seedAndCapture(page);
    server.release('broken');
    // Only the NEW install gets a deliberately missing shell asset.
    // Its install must become redundant; the previous worker stays active.
    const outcome = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const done = new Promise((resolve,reject) => {
        const timeout=setTimeout(()=>reject(new Error('Update state did not settle')),25_000);
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) {clearTimeout(timeout);reject(new Error('No installing SW'));return;}
          const onState = () => {
            if (installing.state === 'redundant' || installing.state === 'activated') {
              clearTimeout(timeout);
              resolve(installing.state);
            }
          };
          installing.addEventListener('statechange',onState);
          onState();
        }, {once:true});
      });
      await reg.update();
      return done;
    });
    expect(outcome).toBe('redundant');
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).toContain(LEGACY_CACHE);
    expect(keys).not.toContain(CURRENT_CACHE);
    await context.setOffline(true);
    await page.goto(server.url+'/index.html',{waitUntil:'domcontentloaded',timeout:20_000});
    await expect(page.locator('#dailyMoves')).toBeVisible();
    expect(await page.locator('meta[name="qa-installed-build"]').getAttribute('content')).toBe('v1');
    expect(await capture(page)).toEqual(before);
  } finally {
    await context.setOffline(false);
    await server.close();
  }
});
