import {test,expect} from '@playwright/test';

// Playbook v1.9.2 — fixed application SHA:
// 15e95ed9d6958f3e90f62e42e5e6558a8f8535df
// Browser context OVERRIDES repository's serviceWorkers:'block' deliberately.
test.use({serviceWorkers:'allow'});
const KEY='osakevahti.single.v1';
const SHELL_CACHE='osakevahti-shell-v2.17.9-alpha-public-nav1';
const FIRST={id:'OFFLINE-SYNTHETIC-01',symbol:'MSFT',name:'Synthetic Microsoft',
  quantity:7.25,buyPrice:123.45,currency:'USD',account:'Nordea',
  accountType:'AOT',broker:'Nordea',accountDetailsConfirmed:true,
  assetType:'stock',riskClass:'medium',trailingPct:12};

async function install(page){
  await page.goto('/index.html');
  await expect(page.locator('#dailyMoves')).toBeVisible();
  await page.waitForFunction(async()=>{
    if(!navigator.serviceWorker?.controller)return false;
    const keys=await caches.keys();
    return keys.includes('osakevahti-shell-v2.17.9-alpha-public-nav1');
  },undefined,{timeout:25_000});
  const snapshots=await page.evaluate(async()=>{
    const cache=await caches.open('osakevahti-shell-v2.17.9-alpha-public-nav1');
    return {controlled:!!navigator.serviceWorker.controller,
      index:!!(await cache.match('./index.html')),
      reader:!!(await cache.match('./image-reader.js')),
      manifest:!!(await cache.match('./manifest.webmanifest'))};
  });
  expect(snapshots).toEqual({controlled:true,index:true,reader:true,manifest:true});
}

test('PWA offline: real service worker opens previously visited app and preserves synthetic holdings',async({page,context})=>{
  test.setTimeout(65_000);
  await page.addInitScript(({key,holding})=>{
    if(localStorage.getItem(key)===null)
      localStorage.setItem(key,JSON.stringify({holdings:[holding],
        baseCurrency:'EUR',news:[],apiKey:'',riskBudgetPct:1.25,showDetails:false}));
  },{key:KEY,holding:FIRST});
  await install(page);
  const before=await page.evaluate(key=>{
    const state=JSON.parse(localStorage.getItem(key));
    return {positions:state.holdings.map(h=>({id:h.id,account:h.account,
      quantity:h.quantity,buyPrice:h.buyPrice})),baseCurrency:state.baseCurrency};
  },KEY);
  expect(before.positions).toEqual([{id:FIRST.id,account:FIRST.account,
    quantity:FIRST.quantity,buyPrice:FIRST.buyPrice}]);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:20_000});
  await expect(page.locator('#dailyMoves')).toBeVisible();
  expect(await page.evaluate(()=>navigator.onLine)).toBe(false);
  const after=await page.evaluate(key=>{
    const state=JSON.parse(localStorage.getItem(key));
    return {positions:state.holdings.map(h=>({id:h.id,account:h.account,
      quantity:h.quantity,buyPrice:h.buyPrice})),baseCurrency:state.baseCurrency};
  },KEY);
  expect(after).toEqual(before);
});

test('PWA dynamic financial JSON is never served from shell cache when offline',async({page,context})=>{
  test.setTimeout(60_000);
  await install(page);
  const url='/tests/fixtures/pwa-network-only.json';
  const response=await page.evaluate(async path=>{
    const r=await fetch(path);return {status:r.status,body:await r.json()};
  },url);
  expect(response.status).toBe(200);
  expect(response.body.kind).toBe('synthetic-volatile-financial-data');
  const hasCachedData=await page.evaluate(async path=>!!await caches.match(path),url);
  expect(hasCachedData).toBe(false);
  // Playwright context.setOffline can leave a service worker's own network
  // target connected. Explicitly simulate a failed upstream for this resource
  // while service workers stay enabled; verify the block was actually used.
  let blockedRequests=0;
  await context.route('**/tests/fixtures/pwa-network-only.json',async route=>{
    blockedRequests++;
    await route.abort('internetdisconnected');
  });
  await context.setOffline(true);
  const observed=await page.evaluate(async path=>{
    try{const r=await fetch(path,{cache:'no-store'});return {kind:'response',status:r.status,text:await r.text()};}
    catch(e){return {kind:'offline-network-failure',message:String(e?.message||e)};}
  },url);
  expect(blockedRequests,'Service-worker upstream network request must reach the injected outage').toBeGreaterThan(0);
  // Offline service-worker failure can reject fetch OR yield an error
  // Response. Neither may serve a successful stale financial-JSON payload.
  if(observed.kind==='response'){
    expect(observed.status,JSON.stringify(observed)).toBeGreaterThanOrEqual(400);
    expect(observed.text).not.toContain('synthetic-volatile-financial-data');
  }else{
    expect(observed.kind).toBe('offline-network-failure');
  }
  expect(await page.evaluate(async path=>!!await caches.match(path),url)).toBe(false);
});

test('PWA service worker upgrade deletes only its own stale cache, not other same-origin apps',async({page})=>{
  test.setTimeout(60_000);
  // Seed CacheStorage on the origin BEFORE Osakevahti registers its worker.
  // GitHub Pages sibling applications share origin-wide CacheStorage.
  await page.goto('/manifest.webmanifest');
  const seed=await page.evaluate(async()=>{
    const other=await caches.open('visual-academy-shell-v1');
    await other.put('/visual-academy/index.html',new Response('USER_OWNED_OTHER_APP_CACHE'));
    const old=await caches.open('osakevahti-shell-v2.15-test-stale');
    await old.put('/index.html',new Response('STALE_OSAKEVAHTI_SHELL'));
    return caches.keys();
  });
  expect(seed).toContain('visual-academy-shell-v1');
  expect(seed).toContain('osakevahti-shell-v2.15-test-stale');
  await install(page);
  const results=await page.evaluate(async()=>{
    const keys=await caches.keys();
    const response=await caches.match('/visual-academy/index.html');
    return {keys,otherText:response?await response.text():null};
  });
  expect(results.keys).toContain(SHELL_CACHE);
  expect(results.keys).not.toContain('osakevahti-shell-v2.15-test-stale');
  expect(results.keys).toContain('visual-academy-shell-v1');
  expect(results.otherText).toBe('USER_OWNED_OTHER_APP_CACHE');
});
