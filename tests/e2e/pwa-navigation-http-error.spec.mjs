import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// RC-P2-01 independent QA regression. App SHA baseline:
// df89120fa9620a8f7ee8eac2e36a448e8a20c1a5
// REAL Chromium service worker; ephemeral local HTTP server; synthetic state.
// A failed HTTP navigation must NEVER replace a good offline app shell.
test.use({ serviceWorkers: 'allow' });

const KEY = 'osakevahti.single.v1';
const CACHE = 'osakevahti-shell-v2.16-alpha5-fx';
const assetTypes = {
  'sw.js': 'text/javascript; charset=utf-8',
  'index.html': 'text/html; charset=utf-8',
  'image-reader.js': 'text/javascript; charset=utf-8',
  'manifest.webmanifest': 'application/manifest+json',
  'icon-192.png': 'image/png',
  'icon-512.png': 'image/png'
};
const fakeHolding = {
  id: 'QA-SW-P2-PRESERVE', symbol: 'MSFT', name: 'Synthetic Holdings',
  quantity: 3.875, buyPrice: 61.125, currency: 'USD',
  account: 'Nordea', accountType: 'AOT', broker: 'Nordea',
  accountDetailsConfirmed: true, assetType: 'stock',
  riskClass: 'medium', trailingPct: 12
};

async function serve(){
  let mode = 'healthy', failureStatus = 503;
  const server = createServer(async(req,res)=>{
    const name = new URL(req.url,'http://127.0.0.1').pathname.replace(/^\/+/,'') || 'index.html';
    const navigate = name === 'index.html';
    if(navigate && mode === 'disconnect') {
      req.socket.destroy();
      return;
    }
    if(navigate && mode === 'http-error') {
      res.writeHead(failureStatus,{'Content-Type':'text/html; charset=utf-8',
        'Cache-Control':'no-store'});
      res.end('<!doctype html><html><body>synthetic temporary outage '+failureStatus+'</body></html>');
      return;
    }
    if(!Object.hasOwn(assetTypes,name)){
      res.writeHead(404,{'Cache-Control':'no-store'});
      res.end('Missing test-only non-shell resource');
      return;
    }
    try{
      const body = await readFile(name);
      res.writeHead(200,{'Content-Type':assetTypes[name],'Cache-Control':'no-store'});
      res.end(body);
    }catch{
      res.writeHead(404);
      res.end('Shell asset absent');
    }
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  return {
    url:'http://127.0.0.1:'+server.address().port,
    error:(status)=>{failureStatus=status;mode='http-error';},
    disconnect:()=>{mode='disconnect';},
    close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))
  };
}

async function snapshot(page){
  return page.evaluate(key=>{
    const state=JSON.parse(localStorage.getItem(key));
    const h=state.holdings?.[0]||{};
    return {count:state.holdings?.length,id:h.id,quantity:h.quantity,
      buyPrice:h.buyPrice,account:h.account,accountType:h.accountType,
      broker:h.broker,confirmed:h.accountDetailsConfirmed,
      currency:state.baseCurrency};
  },KEY);
}

for(const status of [503,404]){
  test('RC-P2-01 HTTP '+status+' must not poison offline PWA shell or mutate holdings',async({page})=>{
    test.setTimeout(90_000);
    const server=await serve();
    try{
      await page.goto(server.url+'/index.html');
      await expect(page.locator('#dailyMoves')).toBeVisible();
      await page.waitForFunction(async name=>{
        const cache=await caches.open(name);
        const original=await cache.match('./index.html');
        return navigator.serviceWorker.controller && original?.status===200;
      },CACHE,{timeout:30000});
      await page.evaluate(({key,holding})=>{
        const current=JSON.parse(localStorage.getItem(key)||'{}');
        current.holdings=[holding];
        current.baseCurrency='EUR';
        localStorage.setItem(key,JSON.stringify(current));
      },{key:KEY,holding:fakeHolding});
      await page.reload();
      await expect(page.locator('#dailyMoves')).toBeVisible();
      const before=await snapshot(page);
      expect(before).toEqual({count:1,id:fakeHolding.id,quantity:3.875,
        buyPrice:61.125,account:'Nordea',accountType:'AOT',
        broker:'Nordea',confirmed:true,currency:'EUR'});

      server.error(status);
      const bad=await page.goto(server.url+'/index.html',{waitUntil:'domcontentloaded'});
      expect(bad?.status()).toBe(status);
      server.disconnect();
      const offline=await page.goto(server.url+'/index.html',{
        waitUntil:'domcontentloaded',timeout:20000
      });
      expect(offline?.status(),'Offline must fall back to LAST GOOD 200 shell').toBe(200);
      await expect(page.locator('#dailyMoves')).toBeVisible();
      expect(await snapshot(page)).toEqual(before);
      const saved=await page.evaluate(async name=>{
        const c=await caches.open(name);
        const r=await c.match('./index.html');
        return {status:r?.status,body:r?await r.text():null};
      },CACHE);
      expect(saved.status).toBe(200);
      expect(saved.body).toContain('id="dailyMoves"');
      expect(saved.body).not.toContain('synthetic temporary outage');
    }finally{
      await server.close();
    }
  });
}
