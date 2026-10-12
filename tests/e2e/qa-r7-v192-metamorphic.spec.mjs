import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// Playbook v1.9.2: synthetic, test-only oracles for application SHA
// 15e95ed9d6958f3e90f62e42e5e6558a8f8535df. No user data.
const KEY='osakevahti.single.v1';
const hold=(id,account,more={})=>({id,symbol:'MSFT',name:'Microsoft Corporation',quantity:5.25,
  buyPrice:13.75,currency:'USD',account,assetType:'stock',trailingPct:12,riskClass:'medium',...more});
async function app(page,holdings=[],apiKey=''){
  await page.addInitScript(({holdings,apiKey})=>{
    if(!localStorage.getItem('osakevahti.single.v1'))localStorage.setItem('osakevahti.single.v1',
      JSON.stringify({holdings,baseCurrency:'EUR',apiKey,news:[],riskBudgetPct:1.25,showDetails:false}));
  },{holdings,apiKey});
  await page.route('https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**',route=>{
    const data=new URL(route.request().url()).pathname==='/resolve'
      ? {schema_version:'instrument-resolver-v1',provider:'Synthetic',candidates:[{
          symbol:'MSFT',longname:'Microsoft Corporation',currency:'USD',
          quote_type:'EQUITY',exchange:'NMS',mic:'XNAS',isin:'US5949181045'}]}
      : {schema_version:'worker-v1.2',assets:{},errors:{},health:{ok:0,failed:0}};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  for(const f of ['market-data.json','portfolio-status.json','risk-data.json',
    'market-context.json','portfolio-news.json','news-data.json','insights.json']){
    await page.route('**/'+f+'*',r=>r.fulfill({status:200,contentType:'application/json',
      body:'{"assets":{},"items":[]}'}));
  }
  await page.route('https://api.frankfurter.app/**',r=>r.fulfill({status:200,
    contentType:'application/json',body:'{"rates":{"EUR":1}}'}));
  await page.goto('/index.html');
  await expect(page.locator('#dailyMoves')).toBeVisible();
}
const state=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
const positions=async page=>(await state(page)).holdings;
async function restore(page,value){
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('#importBackup').setInputFiles({
    name:'synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
}
async function csv(page,type,broker){
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({hasText:'Salkun tuonti'}).click();
  const content=['Ticker;Nimi;Kpl;Keskihinta;Valuutta;Tili;ISIN;Tilityyppi;Pankki',
    ['MSFT','Microsoft Corporation','99','21.5','USD','Nordea','US5949181045',
      type,broker].join(';')].join('\n');
  await page.locator('#importText').fill(content);
  await page.locator('#importTextBtn').click();
  await expect(page.locator('#importReviewDlg')).toBeVisible();
}
for(const [type,broker,name] of [
  ['OST','Nordea','different account type'],
  ['AOT','Nordnet','different broker'],
  ['OST','Nordnet','both fields contradictory']
]){
  test('R7-01 metamorphic: legacy CSV blocks '+name,async({page})=>{
    await app(page,[hold('legacy','Nordea',{
      accountType:'AOT',broker:'Nordea',accountDetailsConfirmed:true})]);
    const before=await positions(page);
    await csv(page,type,broker);
    await expect(page.locator('#importReviewDlg')).toContainText('TARKISTA TILITYYPPI');
    await expect(page.locator('#confirmImportReview')).toBeDisabled();
    await page.reload();
    expect(await positions(page)).toEqual(before);
  });
}
test('R7-01 inverse: identical confirmed account updates existing position only',async({page})=>{
  await app(page,[hold('keep','Nordea',{accountType:'AOT',broker:'Nordea',
    accountDetailsConfirmed:true})]);
  await csv(page,'AOT','Nordea');
  await expect(page.locator('#importReviewDlg')).toContainText('PÄIVITETÄÄN');
  await expect(page.locator('#confirmImportReview')).toBeEnabled();
  page.once('dialog',d=>d.accept());
  await page.locator('#confirmImportReview').click();
  await page.reload();
  const h=await positions(page);
  expect(h).toHaveLength(1);
  expect(h[0].id).toBe('keep');
  expect(h[0].quantity).toBe(99);
  expect(h[0].buyPrice).toBe(21.5);
  expect(h[0].accountDetailsConfirmed).toBe(true);
});
const invalid=[
  ['negative-quantity',{holdings:[hold('bad','Nordea',{quantity:-1})]}],
  ['negative-price',{holdings:[hold('bad','Nordea',{buyPrice:-1})]}],
  ['missing-holdings',{baseCurrency:'EUR'}],
  ['duplicate-ids',{holdings:[hold('same','Nordea'),hold('same','Nordnet')]}],
  ['NaN-quantity',{holdings:[hold('bad','Nordea',{quantity:'NaN'})]}]
];
for(const [label,backup] of invalid){
  test('R7-02 atomic restore rejects '+label,async({page})=>{
    await app(page,[hold('KEEP','Nordnet')]);
    const before=await positions(page);
    const alerts=[];
    page.on('dialog',async d=>{alerts.push(d.message());await d.accept()});
    await restore(page,backup);
    await expect.poll(()=>alerts.length).toBeGreaterThan(0);
    expect(await positions(page)).toEqual(before);
    await page.reload();
    expect(await positions(page)).toEqual(before);
  });
}
test('R7-02 inverse: valid backup repeat, reload, export, no imported API secret',async({page})=>{
  await app(page,[hold('old','OST')],'LOCAL_SYNTHETIC_KEY');
  const backup={baseCurrency:'EUR',holdings:[
    hold('a','Nordea',{quantity:7.125,buyPrice:35.625}),
    hold('b','Nordnet',{quantity:2.75,buyPrice:99.875})
  ],apiKey:'UNTRUSTED_BACKUP_VALUE'};
  await restore(page,backup);
  await expect.poll(async()=>(await positions(page)).length).toBe(2);
  await page.locator('#importBackup').setInputFiles({
    name:'repeat.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.reload();
  const h=await positions(page);
  expect(h.map(x=>x.id)).toEqual(['a','b']);
  expect(h.map(x=>x.quantity)).toEqual([7.125,2.75]);
  expect(h.map(x=>x.buyPrice)).toEqual([35.625,99.875]);
  expect(h.every(x=>x.accountDetailsConfirmed===false)).toBe(true);
  expect((await state(page)).apiKey).toBe('LOCAL_SYNTHETIC_KEY');
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({hasText:'Varmuuskopio'}).click();
  await expect(page.locator('#exportBtn')).toBeVisible();
  const wait=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download=await wait;
  const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  expect(exported.holdings.map(x=>x.id)).toEqual(['a','b']);
  expect(exported).not.toHaveProperty('apiKey');
});
test('R7-03 invalid account type cannot inherit confirmation from legacy',async({page})=>{
  await app(page,[]);
  await restore(page,{baseCurrency:'EUR',holdings:[
    hold('corrupt','OST',{accountType:'INVALID',broker:'Nordea',accountDetailsConfirmed:true})
  ]});
  await expect.poll(async()=>(await positions(page)).length).toBe(1);
  await page.reload();
  const h=(await positions(page))[0];
  expect(h.accountType).toBe('OST');
  expect(h.accountDetailsConfirmed).toBe(false);
  await expect(page.locator('#accountReviewBanner')).toBeVisible();
});
