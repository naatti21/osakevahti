import {test,expect} from '@playwright/test';

// Deterministic browser tests for the failure/retry paths, not proof that
// any third-party CDN is reachable on a user's device.
test('OCR module falls back to third script CDN when first two are unavailable',async({page})=>{
  const requested=[];
  await page.route('**/tesseract.min.js',async route=>{
    const url=route.request().url();requested.push(url);
    if(url.includes('cdnjs.cloudflare.com')){
      await route.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:'window.Tesseract={createWorker:async()=>({})};'});
    }else await route.abort('failed');
  });
  await page.goto('/index.html');
  const result=await page.evaluate(async()=>{
    const mod=await import('./image-reader.js');
    const api=await mod.getTesseract();
    return typeof api.createWorker;
  });
  expect(result).toBe('function');
  expect(requested).toHaveLength(3);
  expect(requested[2]).toContain('cdnjs.cloudflare.com');
});

test('OCR engine retries worker initialization once with alternate worker CDN',async({page})=>{
  await page.goto('/index.html');
  const result=await page.evaluate(async()=>{
    const attempts=[];
    window.Tesseract={createWorker:async(languages,oem,options)=>{
      attempts.push({languages,oem,workerPath:options.workerPath||''});
      if(attempts.length===1)throw new Error('importScripts network failed');
      return {recognize:async()=>({data:{text:'Aster Devices Corporation\n12 kpl',tsv:''}}),terminate:async()=>{}};
    }};
    const mod=await import('./image-reader.js');
    const ocr=await mod.extractImageText(new Blob(['synthetic'],{type:'image/png'}));
    return {attempts,ocr};
  });
  expect(result.attempts).toHaveLength(2);
  expect(result.attempts[0].workerPath).toBe('');
  expect(result.attempts[1].workerPath).toContain('unpkg.com');
  expect(result.ocr.text).toContain('Aster Devices Corporation');
});

test('OCR loader can retry after all three mirrors fail and network recovers',async({page})=>{
  let working=false;
  await page.route('**/tesseract.min.js',async route=>{
    if(working)await route.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:'window.Tesseract={createWorker:async()=>({})};'});
    else await route.abort('failed');
  });
  await page.goto('/index.html');
  const first=await page.evaluate(async()=>{
    try{const mod=await import('./image-reader.js');await mod.getTesseract();return 'unexpected success';}
    catch(e){return String(e.message||e)}
  });
  expect(first).toContain('OCR-kirjastoa ei voitu ladata');
  working=true;
  const second=await page.evaluate(async()=>{
    const mod=await import('./image-reader.js');return typeof(await mod.getTesseract()).createWorker;
  });
  expect(second).toBe('function');
});
