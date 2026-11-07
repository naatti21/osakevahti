import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/worker.js';
test('instrument endpoint accepts a new listing, confines requests, distinguishes partial failure',async()=>{
 const original=globalThis.fetch;const calls=[];const now=Date.now();
 globalThis.fetch=async url=>{
  calls.push(String(url));
  if(String(url).includes('/search?'))return new Response('blocked',{status:429});
  return Response.json({chart:{result:[{meta:{symbol:'NEWX.HE',currency:'EUR',instrumentType:'EQUITY',regularMarketPrice:17,regularMarketTime:Math.floor(now/1000)}}]}});
 };
 try{
  const response=await worker.fetch(new Request('https://worker.test/instrument?symbol=NEWX.HE'),{}, {waitUntil(){}});
  const data=await response.json();assert.equal(response.status,200);assert.equal(data.quote.status,'ok');
  assert.equal(data.quote.value.price,17);assert.equal(data.news.status,'error');
  assert.equal(data.dividends.status,'unavailable');assert.equal(calls.length,2);
  assert.ok(calls.every(url=>['query1.finance.yahoo.com','query2.finance.yahoo.com'].includes(new URL(url).hostname)));
  const bad=await worker.fetch(new Request('https://worker.test/instrument?symbol=https://other.test'),{},{waitUntil(){}});
  assert.equal(bad.status,400);assert.equal(calls.length,2);
 }finally{globalThis.fetch=original;}
});
test('old upstream status responses do not acquire fabricated dates or identities',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({assets:{OTHER:{price:100}}});
 try{
  const response=await worker.fetch(new Request('https://worker.test/instrument?symbol=NEWX.HE'),{},{waitUntil(){}});
  const data=await response.json();assert.equal(data.quote.status,'unavailable');assert.equal(data.news.status,'unavailable');
 }finally{globalThis.fetch=original;}
});
test('unknown route does not silently return the fixed legacy ticker list',async()=>{
 const response=await worker.fetch(new Request('https://worker.test/wrong-route'),{},{waitUntil(){}});
 assert.equal(response.status,404);
});
