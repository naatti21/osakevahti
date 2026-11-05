import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
// Execute the real worker handler with a retired cache namespace. Any open()
// would recreate that namespace, just as CacheStorage does in the browser.
for(const offline of [false,true])test(`retired fetch cannot recreate deleted cache (${offline?'offline':'online'})`,async()=>{
 const handlers={},opened=[],writes=[];let result,finished;
 const context={self:{location:{origin:'https://example.test',href:'https://example.test/sw.js'},addEventListener:(name,fn)=>handlers[name]=fn},
  caches:{open:async name=>{opened.push(name);return {match:async()=>undefined,put:async()=>writes.push(true)}},match:async()=>undefined},
  fetch:async()=>{if(offline)throw Error('offline');return new Response('healthy')},URL,Response};
 vm.runInNewContext(source,context);
 handlers.fetch({request:{method:'GET',url:'https://example.test/index.html',mode:'navigate'},respondWith:p=>result=p,waitUntil:p=>finished=p});
 const response=await result;await finished;
 assert.equal(response.status,offline?0:200);assert.deepEqual(opened,[]);assert.deepEqual(writes,[]);
});
