import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {setup,importImage,chooseNew,commitFund,stored} from './helpers.mjs';

// Explicit opt-in profile: actual application image-reader.js, actual local
// Tesseract 5.1.0 fin+eng, no OCR text double and no external requests.
test('real fictional PNG local OCR to reviewed unknown fund and persistence',async({page},info)=>{
 test.setTimeout(120000);const assets=process.env.PHASE1_LOCAL_OCR_ASSETS;if(!assets)throw new Error('PHASE1_LOCAL_OCR_ASSETS is required; see tests/phase1/README.md');
 await setup(page);
 await page.route('**/__phase1_ocr__/**',async route=>{
  const rel=new URL(route.request().url()).pathname.split('/__phase1_ocr__/')[1];const path=resolve(assets,rel);if(!path.startsWith(resolve(assets)+sep))return route.abort();
  const body=await readFile(path);return route.fulfill({status:200,body,contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.wasm')?'application/wasm':'application/octet-stream'});
 });
 await page.addScriptTag({url:'/__phase1_ocr__/tesseract.min.js'});
 await page.evaluate(()=>{
  delete window.__OSAKEVAHTI_TEST_OCR__;
  const create=window.Tesseract.createWorker;
  window.Tesseract.createWorker=async(langs,oem,options)=>{const worker=await create(langs,oem,{...options,workerPath:location.origin+'/__phase1_ocr__/worker.min.js',corePath:location.origin+'/__phase1_ocr__/core',langPath:location.origin+'/__phase1_ocr__/lang',gzip:false,cacheMethod:'none'});const recognize=worker.recognize.bind(worker);worker.recognize=async(...args)=>{const result=await recognize(...args);window.__phase1ActualOcr={text:result.data.text,tsv:result.data.tsv};return result;};return worker;};
 });
 const before=await stored(page);const png=await importImage(page,'Cedar Aurora Japan A EUR');await writeFile(info.outputPath('fictional.png'),png);await writeFile(info.outputPath('actual-ocr.json'),JSON.stringify(await page.evaluate(()=>window.__phase1ActualOcr),null,2));expect(await stored(page)).toEqual(before);
 await expect(page.locator('#fundNewName0')).toHaveValue('Cedar Aurora Japan A EUR');await expect(page.locator('#fundQty0')).toHaveValue('0,37');
 // Source is a generated fictional PNG; selection is still an explicit user act.
 await chooseNew(page,'Cedar Aurora Japan A EUR');await commitFund(page);const rows=await stored(page);expect(rows).toHaveLength(2);expect(rows.find(h=>h.name==='Cedar Aurora Japan A EUR')).toMatchObject({quantity:.37,buyPrice:101.25,symbol:''});
 await page.screenshot({path:info.outputPath('actual-ocr-review.png'),fullPage:true});
 const result={pngSha256:createHash('sha256').update(png).digest('hex'),method:'PNG -> application image-reader.js -> local Tesseract fin+eng -> fund review -> local synthetic storage',before:before.length,after:rows.length,identityVerified:false};await info.attach('method-and-result',{body:JSON.stringify(result),contentType:'application/json'});
});
