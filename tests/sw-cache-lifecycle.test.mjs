import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const current=source.match(/const CACHE = "([^"]+)"/)[1];
function harness(){
 const handlers={},stores=new Map(),waits=[];let release;
 const cache=()=>{const entries=new Map();return {async put(k,v){entries.set(typeof k==='string'?k:k.url,v)},async match(k){return entries.get(typeof k==='string'?k:k.url)}}};
 const caches={async open(k){if(!stores.has(k))stores.set(k,cache());return stores.get(k)},async keys(){return [...stores.keys()]},async delete(k){return stores.delete(k)},async match(k){for(const c of stores.values()){const r=await c.match(k);if(r)return r}}};
 const network=new Promise(resolve=>{release=resolve});
 const fetch=()=>network;
 vm.runInNewContext(source,{self:{location:{origin:'https://synthetic.test'},addEventListener:(n,f)=>handlers[n]=f},caches,fetch,URL,Response,console});
 return {stores,caches,release:(r)=>release(r),async start(mode,path){let response;handlers.fetch({request:{method:'GET',mode,url:'https://synthetic.test/'+path},respondWith:p=>response=p,waitUntil:p=>waits.push(p)});await Promise.resolve();return {response,waits}}};
}
for(const [mode,path] of [['navigate','index.html'],['cors','image-reader.js'],['cors','asset.js']])test('in-flight '+path+' cannot recreate a deleted old shell cache',async()=>{
 const h=harness();await h.caches.open(current);const pending=await h.start(mode,path);await h.caches.delete(current);h.release(new Response('synthetic shell'));await pending.response;await Promise.all(pending.waits);await new Promise(r=>setImmediate(r));assert.equal(h.stores.has(current),false,'old response must use its existing cache handle, not reopen deleted cache');assert.ok(pending.waits.length,'cache work is part of event lifetime');
});
test('new shell never reads an unrelated or older cache entry',async()=>{
 const h=harness();await (await h.caches.open('osakevahti-shell-old')).put('https://synthetic.test/asset.js',new Response('old'));
 const pending=await h.start('cors','asset.js');await Promise.resolve();if(h.release)h.release(new Response('new'));const r=await pending.response;assert.equal(await r.text(),'new');
});
test('unavailable cache storage does not discard an online response',async()=>{
 const h=harness();h.caches.open=async()=>{throw new Error('Synthetic quota')};const p=await h.start('cors','asset.js');h.release(new Response('online'));assert.equal(await (await p.response).text(),'online');await Promise.all(p.waits);
});
