import {test,expect} from '@playwright/test';
test.use({trace:'on'});
const KEY='osakevahti.single.v1';
const cand=(symbol,name,currency='EUR')=>({symbol,longname:name,currency,quote_type:'EQUITY',exchange:'HEL',full_exchange_name:'Helsinki'});
async function boot(page,resolver,holdings=[]){
 await page.addInitScript(({key,holdings})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({holdings,baseCurrency:'EUR',apiKey:'',news:[]}))},{key:KEY,holdings});
 await page.route('https://**/*',async route=>{
  const u=new URL(route.request().url());
  const candidates=u.pathname==='/resolve'?await resolver(u.searchParams.get('q')):[];
  return route.fulfill({json:{assets:{},items:[],candidates}});
 });
 await page.goto('/index.html');
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
test('audit: approval stays locked until every resolver finishes; cancel ignores stale results',async({page})=>{
 let release;const blocked=new Promise(r=>release=r);
 await boot(page,async q=>q==='Boreal Materials'?(await blocked,[]):[cand('AR','Aurora Robotics')]);
 await page.evaluate(()=>{
  window.auditDone=startImportReview([
   holdingFromImportRow({name:'Aurora Robotics',symbol:'AR',quantity:'7',currency:'EUR'},'synthetic'),
   holdingFromImportRow({name:'Boreal Materials',quantity:'19',currency:'EUR'},'synthetic')
  ]);
 });
 await expect(page.locator('.importReviewRow')).toHaveCount(1);
 await expect(page.locator('#confirmImportReview')).toBeDisabled();
 await page.evaluate(()=>commitPendingImport());
 expect(await saved(page)).toEqual([]);
 await page.locator('#cancelImportReview').click();
 release();
 expect(await page.evaluate(()=>window.auditDone.then(()=>true,()=>false))).toBe(true);
 await expect(page.locator('#importReviewDlg')).not.toBeVisible();
});
test('audit: alternate currency stays visible but cannot relabel source purchase cost',async({page})=>{
 await boot(page,()=>[cand('AR','Aurora Robotics','USD'),cand('AR.HE','Aurora Robotics')]);
 await page.evaluate(()=>startImportReview([holdingFromOcrCandidate(screenshotCandidatesFromOcr({text:'Aurora Robotics\n7 kpl\nGAV 12 EUR',lines:[]})[0],'synthetic')]));
 const usd=page.locator('[data-candidate]').filter({hasText:'USD'});
 await expect(usd).toBeVisible();await expect(usd).toBeDisabled();
 await page.screenshot({path:'/tmp/osakevahti-audit-review.png',fullPage:true});
 await expect(page.locator('#confirmImportReview')).toBeDisabled();
 expect(await saved(page)).toEqual([]);
});
test('audit: quantity uncertainty cannot be bypassed by leaving identity unknown',async({page})=>{
 await boot(page,()=>[]);
 await page.evaluate(()=>startImportReview([holdingFromImportRow({name:'Aurora Robotics',quantity:'7',currency:''},'synthetic')]));
 await page.locator('[data-unverified]').click();
 await expect(page.locator('#confirmImportReview')).toBeDisabled();
 await page.evaluate(()=>commitPendingImport());expect(await saved(page)).toEqual([]);
});
test('audit: all eight relevant listings are available for explicit review',async({page})=>{
 await boot(page,()=>Array.from({length:8},(_,i)=>cand('AR'+i,'Aurora Robotics')));
 await page.evaluate(()=>startImportReview([holdingFromImportRow({name:'Aurora Robotics',quantity:'7',currency:'EUR'},'synthetic')]));
 await expect(page.locator('[data-candidate]')).toHaveCount(8);
});

test('audit: low-confidence amount requires explicit confirmation; reject keeps storage unchanged',async({page})=>{
 await boot(page,()=>[cand('AR','Aurora Robotics')]);
 await page.evaluate(()=>startImportReview([holdingFromOcrCandidate(screenshotCandidatesFromOcr({text:'Aurora Robotics\nTicker AR\n7 kpl\nGAV 12 EUR',lines:[{text:'Aurora Robotics',confidence:97},{text:'Ticker AR',confidence:97},{text:'7 kpl',confidence:12},{text:'GAV 12 EUR',confidence:97}]})[0],'synthetic')]));
 await expect(page.locator('#confirmImportReview')).toBeDisabled();
 page.once('dialog',d=>d.dismiss());await page.locator('[data-candidate]').click();
 await expect(page.locator('#confirmImportReview')).toBeDisabled();expect(await saved(page)).toEqual([]);
 page.once('dialog',d=>d.accept());await page.locator('[data-candidate]').click();
 await expect(page.locator('#confirmImportReview')).toBeEnabled();
 page.once('dialog',d=>d.accept());await page.locator('#confirmImportReview').click();
 expect((await saved(page))[0].quantity).toBe(7);
});

test('audit: unrelated same-key import cannot overwrite old browser storage, including reload',async({page})=>{
 await boot(page,()=>[cand('AR','Unrelated Resource')],[{id:'keep',symbol:'AR',name:'Aurora Robotics',quantity:7,buyPrice:12,currency:'EUR',instrument:{listingTicker:'AR',companyName:'Aurora Robotics',exchange:'Helsinki',currency:'EUR',identification:'resolved'}}]);
 const before=await saved(page);
 await page.evaluate(()=>startImportReview([holdingFromImportRow({name:'Unrelated Resource',symbol:'AR',quantity:'99',currency:'EUR'},'synthetic')]));
 await expect(page.locator('#confirmImportReview')).toBeDisabled();
 await expect(page.locator('#importReviewDlg')).toContainText('TARKISTA INSTRUMENTTI');
 await page.evaluate(()=>commitPendingImport());expect(await saved(page)).toEqual(before);
 await page.reload();expect(await saved(page)).toEqual(before);
});
test('audit: changing a confirmed suggestion compares original evidence, not previous suggestion',async({page})=>{
 await boot(page,()=>[cand('AR.HE','Aurora Robotics'),{...cand('AR.DE','Aurora Robotics'),exchange:'GER',full_exchange_name:'Xetra'}]);
 await page.evaluate(()=>startImportReview([holdingFromImportRow({name:'Aurora Robotics',quantity:'7',currency:'EUR'},'synthetic')]));
 page.once('dialog',d=>d.accept());await page.locator('[data-candidate]').filter({hasText:'AR.HE'}).click();
 const alternative=page.locator('[data-candidate]').filter({hasText:'AR.DE'});
 await expect(alternative).toBeEnabled();page.once('dialog',d=>d.accept());await alternative.click();
 await expect(page.locator('#confirmImportReview')).toBeEnabled();
 expect(await saved(page)).toEqual([]);
});
