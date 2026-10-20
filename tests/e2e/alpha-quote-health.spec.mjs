import {test,expect} from '@playwright/test';

const KEY='osakevahti.single.v1';
const fund={id:'fake-fund',symbol:'SYNTH_FUND',name:'Fictional Index Fund',
  assetType:'fund',quantity:5,buyPrice:8.4,currency:'EUR',
  currentPrice:9.5,navDate:'',account:'Test',accountType:'FUND'};
const stock={id:'fake-share',symbol:'SYNTH',name:'Fictional Equity',
  assetType:'stock',quantity:2,buyPrice:20,currency:'EUR',
  currentPrice:23,quoteTimestamp:Date.now()-10*86400000,account:'Test',accountType:'AOT'};

async function setup(page,options={}){
  const initialFund={...fund,...(options.previousFundDate?
    {navDate:options.previousFundDate,currentPrice:9.75,
     quoteTimestamp:Date.parse(options.previousFundDate+"T12:00:00Z")}: {})};
  const initial={baseCurrency:'EUR',apiKey:'',holdings:options.stock?[stock]:[initialFund],
    news:[],quoteUpdatedAt:null,riskBudgetPct:1.25,showDetails:false};
  await page.addInitScript((seed)=>{
    if(!localStorage.getItem('osakevahti.single.v1'))
      localStorage.setItem('osakevahti.single.v1',JSON.stringify(seed));
  },initial);
  const navDate=options.navDate??'';
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
    if(url.hostname==='naatti21.github.io'&&url.pathname.endsWith('/market-data.json')){
      if(options.failFeed)return route.fulfill({status:503,body:'down'});
      const quote=options.stock?{quotes:{SYNTH:{price:25,currency:'EUR',
        timestamp:Date.now(),provider:'Yahoo synthetic'}},fund_quotes:{}}:
        {quotes:{},fund_quotes:{SYNTH_FUND:{price:10.2,currency:'EUR',
          nav_date:navDate,timestamp:Date.now(),provider:'Fictional provider'}}};
      return route.fulfill({contentType:'application/json',body:JSON.stringify({
        generated_at:new Date().toISOString(),...quote
      })});
    }
    if(url.hostname==='osakevahti-market-ed59.teemu-natunen84.workers.dev')
      return route.fulfill(options.workerDown?{status:503,body:'down'}:{
        contentType:'application/json',
        body:JSON.stringify({generated_at:new Date().toISOString(),assets:{},health:{failed:0}})
      });
    return route.fulfill({status:404,body:'not supplied in fictional test'});
  });
  await page.goto('/index.html');
  await page.evaluate(()=>refreshMarket(false));
}
test('fund NAV missing valuation date is visibly unverified despite fresh generated_at',async({page})=>{
  await setup(page);
  const result=await page.evaluate(()=>{
    const h=state.holdings[0];
    return {price:h.currentPrice,timestamp:h.quoteTimestamp,navDate:h.navDate,
      status:h.quoteHealth?.status,issue:priceIssue(h)};
  });
  expect(result.price).toBe(10.2);
  expect(result.timestamp).toBe(0);
  expect(result.status).toBe('unverified-nav-day');
  expect(result.issue.label).toBe('NAV-PÄIVÄ PUUTTUU');
  await expect(page.locator('#priceHealthNotice')).toContainText('Fictional Index Fund');
  await expect(page.locator('#holdings')).toContainText('NAV-PÄIVÄ PUUTTUU');
});
test('verified complete fund NAV date is kept separate from fetched timestamp',async({page})=>{
  const day=new Date().toISOString().slice(0,10);
  await setup(page,{navDate:day});
  const result=await page.evaluate(()=>{
    const h=state.holdings[0];return {
      verified:verifiedNavDate(h.navDate),observed:h.quoteTimestamp,
      checked:h.quoteHealth.checkedAt,status:h.quoteHealth.status,issue:priceIssue(h)
    };
  });
  expect(result.verified).toBe(day);
  expect(new Date(result.observed).toISOString().slice(0,10)).toBe(day);
  expect(result.checked).toBeGreaterThan(0);
  expect(result.status).toBe('ok');
  expect(result.issue).toBeNull();
});
test('failed stock source and failed fallback retain last good quote and show a warning',async({page})=>{
  await setup(page,{stock:true,failFeed:true,workerDown:true});
  const result=await page.evaluate(()=>{
    const h=state.holdings[0];return{price:h.currentPrice,status:h.quoteHealth?.status,
      label:priceIssue(h)?.label,reason:priceIssue(h)?.reason};
  });
  expect(result.price).toBe(23);
  expect(result.status).toBe('failed');
  expect(result.label).toBe('VANHA HINTA');
  await expect(page.locator('#priceHealthNotice')).toContainText('Fictional Equity');
  await expect(page.locator('#holdings')).toContainText('VANHA HINTA');
});
test('fallback stock data is distinctly labeled without claiming an independent provider',async({page})=>{
  await setup(page,{stock:true,workerDown:true});
  const result=await page.evaluate(()=>{
    const h=state.holdings[0];return{price:h.currentPrice,status:h.quoteHealth.status,
      label:priceIssue(h)?.label,reason:priceIssue(h)?.reason};
  });
  expect(result.price).toBe(25);
  expect(result.status).toBe('fallback');
  expect(result.label).toBe('VARASYÖTE');
  expect(result.reason).toContain('samaa alkuperäistä');
  await expect(page.locator('#holdings')).toContainText('VARASYÖTE');
});
test('bad, future and yearless fund dates are not accepted as observed NAV days',async({page})=>{
  await page.goto('/index.html');
  const result=await page.evaluate(()=>{
    const tomorrow=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
    return {partial:verifiedNavDate('16.10.'),
      leap:verifiedNavDate('2025-02-29'),future:verifiedNavDate(tomorrow),
      valid:verifiedNavDate('2024-02-29')};
  });
  expect(result).toEqual({partial:'',leap:'',future:'',valid:'2024-02-29'});
});

test('stale fallback trade time is warned about rather than hidden behind fallback success',async({page})=>{
  await setup(page,{stock:true,workerDown:true});
  const label=await page.evaluate(()=>{
    const h=state.holdings[0];
    h.quoteTimestamp=Date.now()-8*86400000;
    render();
    return priceIssue(h)?.label;
  });
  expect(label).toBe('VANHA KURSSI');
  await expect(page.locator('#priceHealthNotice')).toContainText('Fictional Equity');
});

test('unknown new fund NAV date never overwrites a previously verified NAV amount',async({page})=>{
  const previousDate=new Date(Date.now()-2*86400000).toISOString().slice(0,10);
  await setup(page,{previousFundDate:previousDate,navDate:''});
  const result=await page.evaluate(()=>{
    const h=state.holdings[0];
    return {price:h.currentPrice,navDate:h.navDate,health:h.quoteHealth?.status,
      reason:h.quoteHealth?.reason,issue:priceIssue(h)?.label};
  });
  expect(result.price).toBe(9.75);
  expect(result.navDate).toBe(previousDate);
  expect(result.health).toBe('failed');
  expect(result.reason).toContain('arvostuspäivä puuttuu');
  expect(result.issue).toBe('VANHA HINTA');
  await expect(page.locator('#priceHealthNotice')).toContainText('Fictional Index Fund');
});
