import {test,expect} from '@playwright/test';

// Browser QA for NON-DESTRUCTIVE legacy account migration. No real holdings,
// account numbers or API keys. Storage seeding happens ONCE, never on reload.
const KEY='osakevahti.single.v1';
const WORKER='https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**';
function holding(id,symbol,account,overrides={}){
  return {id,symbol,name:symbol,quantity:5,buyPrice:10,currentPrice:11,
    currency:'EUR',account,assetType:'stock',trailingPct:12,riskClass:'medium',
    ...overrides};
}
async function openApp(page,holdings=[]){
  await page.addInitScript(({key,holdings})=>{
    if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({
      holdings,baseCurrency:'EUR',apiKey:'',news:[],riskBudgetPct:1.25,
      quoteUpdatedAt:null,showDetails:false
    }));
  },{key:KEY,holdings});
  await page.route(WORKER,async route=>{
    const url=new URL(route.request().url());
    const data=url.pathname==='/resolve'
      ?{schema_version:'instrument-resolver-v1',provider:'Synthetic',query:url.searchParams.get('q')||'',candidates:[{
        symbol:'MSFT',longname:'Microsoft Corporation',currency:'USD',quote_type:'EQUITY',exchange:'NMS',mic:'XNAS',isin:'US5949181045'
      }]}
      :{schema_version:'worker-v1.2',assets:{},errors:{},health:{ok:0,failed:0}};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  for(const p of ['market-data.json','portfolio-status.json','risk-data.json','market-context.json','portfolio-news.json','news-data.json','dividend-rocket-insights.json','insights.json']){
    await page.route('**/'+p+'*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"assets":{},"items":[]}'}));
  }
  await page.route('https://api.frankfurter.app/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"rates":{"EUR":1}}'}));
  await page.goto('/index.html');
  await expect(page.locator('#dailyMoves')).toBeVisible();
}
async function holdingsInStorage(page){
  return page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
}
async function confirmAccount(page,type,broker){
  await page.locator('#reviewAccountType').selectOption(type);
  await page.locator('#reviewBroker').selectOption(broker);
  await page.locator('#confirmAccountReview').click();
}

test('legacy bank names, prior OST/AOT coercions and fund labels all require review',async({page})=>{
  const legacy=[
    holding('n','NOK','Nordea'),
    holding('t','TST','Nordnet'),
    holding('o','OLD','OST'),
    holding('a','AAA','AOT'),
    holding('f','FUND','Rahastot',{assetType:'fund',quantity:49.7})
  ];
  await openApp(page,legacy);
  await expect(page.locator('#holdings .item')).toHaveCount(5);
  await expect(page.locator('#accountReviewBanner')).toBeVisible();
  await expect(page.locator('#accountReviewBanner')).toContainText('5 omistuksen');
  const migrated=await holdingsInStorage(page);
  expect(migrated.map(h=>h.account)).toEqual(legacy.map(h=>h.account));
  expect(migrated.map(h=>h.quantity)).toEqual(legacy.map(h=>h.quantity));
  expect(migrated.every(h=>h.accountDetailsConfirmed===false)).toBe(true);
  expect(migrated[0].broker).toBe('Nordea');
  expect(migrated[0].accountType).toBe('');
  expect(migrated[1].broker).toBe('Nordnet');
  expect(migrated[1].accountType).toBe('');
  expect(migrated[2].accountType).toBe('OST'); // SUGGESTION ONLY.
  expect(migrated[3].accountType).toBe('AOT');
  expect(migrated[4].accountType).toBe('FUND');
  expect(migrated[4].broker).toBe('');
  await expect(page.locator('#accountSummary')).toContainText('OST · vahvistettu');
  await expect(page.locator('#accountSummary')).toContainText('AOT · vahvistettu');
  await expect(page.locator('#holdings')).toContainText('Tili tarkistamatta');
  await page.reload();
  expect((await holdingsInStorage(page)).map(h=>h.account)).toEqual(legacy.map(h=>h.account));
});

test('user corrects misclassified old OST, confirms broker, and persists without modifying position',async({page})=>{
  const original=holding('old','FORTUM','OST',{quantity:86,buyPrice:13,assetType:'stock'});
  await openApp(page,[original]);
  await page.locator('#openAccountReviewBtn').click();
  await expect(page.locator('#accountReviewDlg')).toBeVisible();
  await expect(page.locator('#accountReviewOld')).toContainText('OST');
  await expect(page.locator('#reviewAccountType')).toHaveValue('OST'); // Unverified suggestion.
  await expect(page.locator('#reviewBroker')).toHaveValue('');
  await confirmAccount(page,'AOT','Nordea'); // User corrects old mistaken label.
  await expect(page.locator('#accountReviewDlg')).not.toBeVisible();
  await expect(page.locator('#accountReviewBanner')).toBeHidden();
  const stored=(await holdingsInStorage(page))[0];
  expect(stored.account).toBe('OST'); // Stable legacy import identity.
  expect(stored.legacyAccount).toBe('OST');
  expect(stored.accountType).toBe('AOT');
  expect(stored.broker).toBe('Nordea');
  expect(stored.accountDetailsConfirmed).toBe(true);
  expect(stored.quantity).toBe(86);
  expect(stored.buyPrice).toBe(13);
  await expect(page.locator('#holdings')).toContainText('Nordea · AOT');
  await page.reload();
  await expect(page.locator('#accountReviewBanner')).toBeHidden();
  expect((await holdingsInStorage(page))[0].accountType).toBe('AOT');
});

test('review queue can be postponed without losing a holding or its source account label',async({page})=>{
  const input=[holding('n','A','Nordea'),holding('t','B','Nordnet')];
  await openApp(page,input);
  await page.locator('#openAccountReviewBtn').click();
  await expect(page.locator('#accountReviewDlg')).toContainText('Nordea');
  await page.locator('#laterAccountReview').click();
  await expect(page.locator('#accountReviewDlg')).not.toBeVisible();
  await expect(page.locator('#accountReviewBanner')).toContainText('2 omistuksen');
  expect((await holdingsInStorage(page)).map(x=>x.account)).toEqual(['Nordea','Nordnet']);
  await page.locator('#openAccountReviewBtn').click();
  await confirmAccount(page,'AOT','Nordea');
  await expect(page.locator('#accountReviewDlg')).toContainText('Nordnet');
  await confirmAccount(page,'OST','Nordnet');
  expect((await holdingsInStorage(page)).map(x=>x.accountDetailsConfirmed)).toEqual([true,true]);
  await expect(page.locator('#accountReviewBanner')).toBeHidden();
});

test('manual add stores independent broker, account type and optional name',async({page})=>{
  await openApp(page,[]);
  await expect(page.locator('#accountReviewBanner')).toBeHidden();
  await page.locator('#addBtn').click();
  await page.locator('#symbol').fill('MSFT');
  await page.locator('#name').fill('Microsoft Corporation');
  await page.locator('#qty').fill('2');
  await page.locator('#buy').fill('400');
  await page.locator('#accountType').selectOption('OST');
  await page.locator('#brokerSelect').selectOption('Nordea');
  await page.locator('#accountLabel').fill('Pitkäaikainen');
  await page.locator('#form button[type="submit"]').click();
  const saved=await holdingsInStorage(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].account).toContain('Nordea / OST');
  expect(saved[0].broker).toBe('Nordea');
  expect(saved[0].accountType).toBe('OST');
  expect(saved[0].accountLabel).toBe('Pitkäaikainen');
  expect(saved[0].accountDetailsConfirmed).toBe(true);
  await expect(page.locator('#accountReviewBanner')).toBeHidden();
  await page.reload();
  expect((await holdingsInStorage(page))[0].accountType).toBe('OST');
});

test('manual add supports unknown provider with a name and other account type',async({page})=>{
  await openApp(page,[]);
  await page.locator('#addBtn').click();
  await page.locator('#symbol').fill('FORTUM');
  await page.locator('#qty').fill('3');
  await page.locator('#buy').fill('20');
  await page.locator('#accountType').selectOption('OTHER');
  await page.locator('#brokerSelect').selectOption('OTHER');
  await expect(page.locator('#brokerOtherBox')).toBeVisible();
  await page.locator('#brokerOther').fill('Oma paikallispankki');
  await page.locator('#form button[type="submit"]').click();
  const h=(await holdingsInStorage(page))[0];
  expect(h.accountType).toBe('OTHER');
  expect(h.broker).toBe('Oma paikallispankki');
  expect(h.accountDetailsConfirmed).toBe(true);
});

test('old JSON backup restores legacy account text and invites review',async({page})=>{
  await openApp(page,[]);
  await page.locator('[data-view="settingsView"]').click();
  const backup=JSON.stringify({
    baseCurrency:'EUR',holdings:[holding('bk','AMD','Nordnet',{quantity:7,buyPrice:35})]
  });
  await page.locator('#importBackup').setInputFiles({
    name:'anonymous-old-backup.json',mimeType:'application/json',buffer:Buffer.from(backup)
  });
  await page.locator('[data-view="portfolioView"]').click();
  await expect(page.locator('#accountReviewBanner')).toContainText('1 omistuksen');
  const h=(await holdingsInStorage(page))[0];
  expect(h.account).toBe('Nordnet');
  expect(h.accountType).toBe('');
  expect(h.broker).toBe('Nordnet');
  expect(h.quantity).toBe(7);
  expect(h.accountDetailsConfirmed).toBe(false);
});

test('two accounts holding same symbol remain independent after migration and review',async({page})=>{
  await openApp(page,[
    holding('first','FORTUM','OST',{quantity:10}),
    holding('second','FORTUM','AOT',{quantity:5})
  ]);
  await expect(page.locator('#holdings .item')).toHaveCount(2);
  await page.locator('#openAccountReviewBtn').click();
  await confirmAccount(page,'OST','Nordnet');
  await confirmAccount(page,'AOT','Nordea');
  await page.reload();
  const positions=await holdingsInStorage(page);
  expect(positions.map(h=>h.id)).toEqual(['first','second']);
  expect(positions.map(h=>h.account)).toEqual(['OST','AOT']);
  expect(positions.map(h=>h.quantity)).toEqual([10,5]);
  expect(positions.map(h=>h.accountType)).toEqual(['OST','AOT']);
});


test('CSV import with bank-only label preserves verified metadata on update',async({page})=>{
  await openApp(page,[]);
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({hasText:'Salkun tuonti'}).click();
  const first=['Ticker,Nimi,Kpl,Keskihinta,Valuutta,Tili,ISIN',
    'MSFT,Microsoft Corporation,2,400,USD,Nordea,US5949181045'].join('\n');
  await page.locator('#importText').fill(first);
  await page.locator('#importTextBtn').click();
  await expect(page.locator('#importReviewDlg')).toBeVisible();
  await expect(page.locator('#confirmImportReview')).toBeEnabled();
  page.once('dialog',d=>d.accept());
  await page.locator('#confirmImportReview').click();
  let saved=await holdingsInStorage(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].account).toBe('Nordea');
  expect(saved[0].accountDetailsConfirmed).toBe(false);
  await page.locator('[data-view="portfolioView"]').click();
  await page.locator('#openAccountReviewBtn').click();
  await confirmAccount(page,'AOT','Nordea');
  saved=await holdingsInStorage(page);
  expect(saved[0].accountDetailsConfirmed).toBe(true);
  expect(saved[0].accountType).toBe('AOT');
  await page.locator('[data-view="settingsView"]').click();
  const update=['Ticker,Nimi,Kpl,Keskihinta,Valuutta,Tili,ISIN',
    'MSFT,Microsoft Corporation,3,410,USD,Nordea,US5949181045'].join('\n');
  await page.locator('#importText').fill(update);
  await page.locator('#importTextBtn').click();
  await expect(page.locator('#importReviewDlg')).toContainText('PÄIVITETÄÄN');
  page.once('dialog',d=>d.accept());
  await page.locator('#confirmImportReview').click();
  saved=await holdingsInStorage(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].quantity).toBe(3);
  expect(saved[0].account).toBe('Nordea');
  expect(saved[0].accountType).toBe('AOT');
  expect(saved[0].broker).toBe('Nordea');
  expect(saved[0].accountDetailsConfirmed).toBe(true);

  const conflicting=['Ticker,Nimi,Kpl,Keskihinta,Valuutta,Tili,ISIN,Tilityyppi,Pankki',
    'MSFT,Microsoft Corporation,4,410,USD,Nordea,US5949181045,OST,Nordea'].join('\n');
  await page.locator('#importText').fill(conflicting);
  await page.locator('#importTextBtn').click();
  await expect(page.locator('#importReviewDlg')).toContainText('TARKISTA TILITYYPPI');
  await expect(page.locator('#confirmImportReview')).toBeDisabled();
  expect((await holdingsInStorage(page))[0].quantity).toBe(3);
  await page.locator('#closeImportReview').click();

  // Even only ONE explicit contradictory field is authoritative enough to
  // demand review, though incomplete metadata does not by itself confirm it.
  const partial=['Ticker,Nimi,Kpl,Keskihinta,Valuutta,Tili,ISIN,Tilityyppi',
    'MSFT,Microsoft Corporation,5,410,USD,Nordea,US5949181045,OST'].join('\n');
  await page.locator('#importText').fill(partial);
  await page.locator('#importTextBtn').click();
  await expect(page.locator('#importReviewDlg')).toContainText('TARKISTA TILITYYPPI');
  await expect(page.locator('#confirmImportReview')).toBeDisabled();
  expect((await holdingsInStorage(page))[0].quantity).toBe(3);
});


test('blank legacy account receives user-confirmed identity, never a guessed broker',async({page})=>{
  await openApp(page,[
    holding('blank','FORTUM','',{quantity:9}),
    holding('old','AMD','AOT',{quantity:4})
  ]);
  let rows=await holdingsInStorage(page);
  expect(rows[0].account).toBe('');
  expect(rows[0].accountDetailsConfirmed).toBe(false);
  await page.locator('#openAccountReviewBtn').click();
  await expect(page.locator('#reviewBroker')).toHaveValue('');
  await confirmAccount(page,'OST','Nordea');
  rows=await holdingsInStorage(page);
  expect(rows[0].account).toContain('Nordea / OST');
  expect(rows[0].accountOriginDerived).toBe(true);
  expect(rows[0].legacyAccount).toBe('');
  expect(rows[0].quantity).toBe(9);
  expect(rows[1].account).toBe('AOT');
  await page.locator('#laterAccountReview').click();
  await page.reload();
  rows=await holdingsInStorage(page);
  expect(rows[0].account).toContain('Nordea / OST');
  expect(rows[1].account).toBe('AOT');
});


test('two typed accounts at same bank remain distinct if account column is absent',async({page})=>{
  await openApp(page,[]);
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({hasText:'Salkun tuonti'}).click();
  const csv=['Ticker,Nimi,Kpl,Keskihinta,Valuutta,ISIN,Tilityyppi,Pankki',
    'MSFT,Microsoft Corporation,2,400,USD,US5949181045,AOT,Nordnet',
    'MSFT,Microsoft Corporation,3,400,USD,US5949181045,OST,Nordnet'].join('\n');
  await page.locator('#importText').fill(csv);
  await page.locator('#importTextBtn').click();
  await expect(page.locator('#importReviewDlg')).toContainText('2 riviä');
  await expect(page.locator('#confirmImportReview')).toBeEnabled();
  page.once('dialog',d=>d.accept());
  await page.locator('#confirmImportReview').click();
  const h=await holdingsInStorage(page);
  expect(h).toHaveLength(2);
  expect(h.map(x=>x.quantity).sort()).toEqual([2,3]);
  expect(h.map(x=>x.accountType).sort()).toEqual(['AOT','OST']);
  expect(h.map(x=>x.account)).toEqual(['Nordnet / AOT','Nordnet / OST']);
  expect(h.every(x=>x.broker==='Nordnet'&&x.accountDetailsConfirmed===true)).toBe(true);
});

test('two typed accounts cannot silently share identical bank-only legacy label',async({page})=>{
  await openApp(page,[]);
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('summary').filter({hasText:'Salkun tuonti'}).click();
  const csv=['Ticker,Nimi,Kpl,Keskihinta,Valuutta,Tili,ISIN,Tilityyppi,Pankki',
    'MSFT,Microsoft Corporation,2,400,USD,Nordnet,US5949181045,AOT,Nordnet',
    'MSFT,Microsoft Corporation,3,400,USD,Nordnet,US5949181045,OST,Nordnet'].join('\n');
  await page.locator('#importText').fill(csv);
  await page.locator('#importTextBtn').click();
  await expect(page.locator('#importReviewDlg')).toBeVisible();
  await expect(page.locator('#confirmImportReview')).toBeDisabled();
  expect(await holdingsInStorage(page)).toHaveLength(0);
});
