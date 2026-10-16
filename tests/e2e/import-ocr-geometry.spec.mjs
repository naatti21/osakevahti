import {test,expect} from '@playwright/test';
import {createWorker} from 'tesseract.js';

test('@ocr-stress audit: real Tesseract TSV geometry survives the production reader and row parser',async({page},testInfo)=>{
 test.setTimeout(90000);
 await page.setContent('<main style="background:white;color:black;width:850px;padding:32px;font:36px Arial"><p>Aurora Robotics &nbsp; 7 kpl</p><p>Boreal Materials &nbsp; 19 kpl</p></main>');
 const png=await page.locator('main').screenshot();
 await testInfo.attach('synthetic-two-holdings.png',{body:png,contentType:'image/png'});
 const worker=await createWorker('eng',1);
 let data;
 try {({data}=await worker.recognize(png,{}, {text:true,tsv:true}));}
 finally {await worker.terminate();}
 await testInfo.attach('real-ocr.tsv',{body:Buffer.from(data.tsv),contentType:'text/tab-separated-values'});
 await page.route('https://**/*',r=>r.fulfill({json:{assets:{},items:[]}}));
 await page.goto('/index.html');
 const parsed=await page.evaluate(async data=>{
  const {tsvToLines}=await import('./image-reader.js');
  const lines=tsvToLines(data.tsv,data.text);
  return screenshotCandidatesFromOcr({text:data.text,lines});
 },data);
 await testInfo.attach('parsed-source-geometry.json',{body:Buffer.from(JSON.stringify(parsed,null,2)),contentType:'application/json'});
 expect(parsed.map(r=>[r.name,r.quantity])).toEqual([['Aurora Robotics',7],['Boreal Materials',19]]);
 expect(parsed.every(r=>r.validationErrors.length===0)).toBe(true);
 expect(parsed.every(r=>r.sourceRows.every(x=>x.right>x.left&&x.bottom>x.top))).toBe(true);
});
