import {test,expect} from '@playwright/test';
const KEY='osakevahti.single.v1';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
async function openImport(page,ocr){
  await page.addInitScript(value=>{
    window.__OSAKEVAHTI_TEST_OCR__=async()=>value;
  },ocr);
  await page.route('**/*',r=>{
    const u=new URL(r.request().url());
    return ['localhost','127.0.0.1'].includes(u.hostname)?r.continue():
      r.fulfill({status:200,contentType:'application/json',body:'{}'});
  });
  await page.setViewportSize({width:360,height:800});
  await page.goto('/index.html');
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('#portfolioImportBox > summary').click();
  await page.locator('#importImage').setInputFiles({name:'ui-chrome.png',mimeType:'image/png',buffer:png});
}
function observed(lines){
  return {text:lines.join('\n'),lines:lines.map((text,index)=>({text,left:12,top:index*27,confidence:91}))};
}
test('OCR refuses a bank screenshot full of UI headings instead of filling review modal',async({page})=>{
  await openImport(page,observed([
    'Aot Osake- ja rahastosalkku W','Omistukset Lisätietoja Tapahtumat',
    'Käytettävissä 26','IQM Quantum Computers','55 kpl','GAV 9,50 EUR',
    'He Handelsbanken Usa Indeksi','NDA FI SENSO i FORTUM',
    'E oo IEE','Yleisnäkymä Seurantalistat Etsi Fiidi Markkina'
  ]));
  await expect(page.locator('#importReviewDlg')).not.toBeVisible();
  await expect(page.locator('#imageImportStatus')).toContainText('puuttuu luotettava omistusmäärä');
  await expect(page.locator('#imageImportStatus')).toContainText('salkkua muutettu');
  await expect(page.locator('#imageOcrText')).toContainText('IQM Quantum Computers');
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
});
test('Pure navigation and menu labels are never made into holding cards',async({page})=>{
  await openImport(page,observed([
    'Aot Osake- ja rahastosalkku W','Omistukset Lisätietoja Tapahtumat',
    'Käytettävissä 26','Yleisnäkymä Seurantalistat Etsi Fiidi Markkina'
  ]));
  await expect(page.locator('#importReviewDlg')).not.toBeVisible();
  await expect(page.locator('#imageImportStatus')).toContainText('yhtään omistusriviä');
  expect(await page.locator('#importReviewList .importReviewRow').count()).toBe(0);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
});
test('A clean complete OCR holding still reaches review without unrelated UI headings',async({page})=>{
  await openImport(page,observed([
    'Aot Osake- ja rahastosalkku W','Omistukset Lisätietoja Tapahtumat',
    'IQM Quantum Computers','Ticker IQMX.HE','55 kpl','GAV 9,50 EUR',
    'Yleisnäkymä Seurantalistat Etsi Fiidi Markkina'
  ]));
  await expect(page.locator('#importReviewDlg')).toBeVisible();
  await expect(page.locator('#importReviewList .importReviewRow')).toHaveCount(1);
  await expect(page.locator('#importReviewList')).toContainText('IQM Quantum Computers');
  await expect(page.locator('#importReviewList')).not.toContainText('Seurantalistat');
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
  await page.locator('#cancelImportReview').click();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
});
