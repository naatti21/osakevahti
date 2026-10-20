import {test,expect} from '@playwright/test';

const KEY='osakevahti.single.v1';
const sample=plan=>({
  baseCurrency:'EUR', apiKey:'', news:[], riskBudgetPct:1.25,showDetails:false,
  holdings:[{id:'sample-holding',symbol:'FAKE.HE',name:'Fictional Company',
    assetType:'stock',currency:'EUR',quantity:10,buyPrice:10,
    currentPrice:20,manualPrice:20,targetWeight:10,
    account:'Fictional AOT',accountType:'AOT',broker:'Other',
    accountDetailsConfirmed:true}],
  ...(plan===undefined?{}:{ostPlan:plan})
});
async function seed(page,plan){
  await page.addInitScript(state=>{
    localStorage.setItem('osakevahti.single.v1',JSON.stringify(state));
  },sample(plan));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return route.continue();
    return route.fulfill({status:404,body:'Synthetic test: no external quotes'});
  });
  await page.goto('/index.html');
}
test('legacy OST plan is archived in settings, not presented as active buy advice',async({page})=>{
  const legacy=[
    {symbol:'OLD1',name:'Fictional Previous Candidate',amount:1000,status:'Seuraava ydinpositio'},
    {symbol:'OLD2',name:'Fictional Review Candidate',amount:400,status:'Tarkkailu'}
  ];
  await seed(page,legacy);
  await page.locator('#targetMapBox summary').click();
  await expect(page.locator('#targetMapBox')).toContainText('vanhoja tavoitearvoja');
  await expect(page.locator('#targetMapBox')).not.toContainText('Fictional Previous Candidate');
  await expect(page.locator('#targetMap')).toContainText('vanha tavoite');
  await expect(page.locator('#targetMap')).toContainText('ero');
  await expect(page.locator('#targetMap')).not.toContainText('ei lisäystä');
  await page.locator('.nav[data-view="settingsView"]').click();
  const archive=page.locator('#ostPlanArchive');
  await expect(archive).not.toHaveAttribute('open','');
  await archive.locator('summary').click();
  await expect(archive).toContainText('Fictional Previous Candidate');
  await expect(archive).toContainText('vanha merkintä');
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).ostPlan,KEY);
  expect(before).toEqual(legacy);
  await page.reload();
  await page.locator('.nav[data-view="settingsView"]').click();
  await page.locator('#ostPlanArchive summary').click();
  await expect(page.locator('#ostPlan')).toContainText('Fictional Previous Candidate');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).ostPlan,KEY)).toEqual(legacy);
});
test('new Alpha profile without an OST plan is not given a fictitious historical plan',async({page})=>{
  await seed(page,undefined);
  await page.locator('.nav[data-view="settingsView"]').click();
  await page.locator('#ostPlanArchive summary').click();
  await expect(page.locator('#ostPlan')).toContainText('Ei tallennettua OST-luonnosta');
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  expect(stored.ostPlan).toEqual([]);
  expect(stored.holdings).toHaveLength(1);
  expect(stored.holdings[0].quantity).toBe(10);
});
