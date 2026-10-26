import {test,expect} from "@playwright/test";

const PORTFOLIO_KEY="osakevahti.single.v1";
const FUND_ISIN="IE00B03HD191";
const day=new Date(Date.now()-86400000).toISOString().slice(0,10);
const compactDay=day.replaceAll("-","");
const feed="https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json";
const portfolio={
  baseCurrency:"EUR",apiKey:"",news:[],quoteUpdatedAt:null,
  riskBudgetPct:1.25,showDetails:false,
  holdings:[{
    id:"alpha-fund-nav-fixture",assetType:"fund",symbol:"SYNTH_FUND",
    name:"Unseen Synthetic Index A EUR",currency:"EUR",account:"Test Fund Account",
    accountType:"FUND",broker:"Example",quantity:11,buyPrice:8.2,
    currentPrice:10.2,manualPrice:null,navDate:"",fundQuoteKey:"SYNTH_FUND",
    instrument:{isin:FUND_ISIN,shareClass:"A",currency:"EUR"}
  }]
};
async function seed(page,{currency="EUR",fundDate="",missingIsin=false}={}){
  let publicCalls=0;
  await page.addInitScript(value=>localStorage.setItem("osakevahti.single.v1",
    JSON.stringify(value)),{
    ...portfolio,holdings:portfolio.holdings.map(x=>({
      ...x,navDate:fundDate,instrument:{
        ...x.instrument,isin:missingIsin?"":FUND_ISIN
      }
    }))
  });
  await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.hostname==="127.0.0.1"||url.hostname==="localhost")
      return route.continue();
    if(url.href.startsWith(feed)){
      publicCalls++;
      return route.fulfill({
        contentType:"application/octet-stream",
        body:JSON.stringify([{ISIN:FUND_ISIN,
          closePrice:"10.40",closePriceDate:compactDay,currency,
          fundCode:"UNKNOWN",class:{fi:"A"},companyNameFi:"Unseen Synthetic Index A EUR"}])
      });
    }
    if(url.hostname==="naatti21.github.io"&&url.pathname.endsWith("/market-data.json"))
      return route.fulfill({contentType:"application/json",
        body:JSON.stringify({generated_at:new Date().toISOString(),
          quotes:{},fund_quotes:{SYNTH_FUND:{
            price:10.2,nav_date:"",currency:"EUR",timestamp:Date.now(),
            provider:"Primary simulated feed"}}})});
    if(url.hostname==="osakevahti-market-ed59.teemu-natunen84.workers.dev")
      return route.fulfill({contentType:"application/json",
        body:JSON.stringify({generated_at:new Date().toISOString(),assets:{},health:{failed:0}})});
    return route.fulfill({status:404,body:"not needed for NAV fallback test"});
  });
  await page.goto("/index.html");
  await page.waitForFunction(()=>lastAutoRefresh>0&&!refreshMarketInFlight);
  return ()=>publicCalls;
}

test("ISIN public NAV backup updates only fund quote, preserves ownership and source day",async({page})=>{
  const count=await seed(page);
  const result=await page.evaluate(()=>{
    const h=state.holdings[0];
    return {quantity:h.quantity,buyPrice:h.buyPrice,account:h.account,
      navDate:h.navDate,price:h.currentPrice,source:h.quoteProvider,
      health:h.quoteHealth?.status,isin:h.instrument?.isin,
      fundSource:h.fundQuoteKey,issue:priceIssue(h),
      cache:localStorage.getItem("osakevahti.alpha.public-nav-cache.v1")!==null}
  });
  expect(result).toMatchObject({quantity:11,buyPrice:8.2,
    account:"Test Fund Account",navDate:day,price:10.4,health:"fallback",
    isin:FUND_ISIN,fundSource:"SYNTH_FUND",
    issue:{label:"VARA-NAV",level:"info"},cache:true});
  expect(result.source).toContain("Rahastoraportti");
  expect(count()).toBe(1);
  await expect(page.locator("#holdings")).toContainText("VARA-NAV");
});

test("mismatched public NAV currency never overwrites source price or NAV date",async({page})=>{
  await seed(page,{currency:"USD"});
  const h=await page.evaluate(()=>state.holdings[0]);
  expect(h.currentPrice).toBe(10.2);
  expect(h.navDate).toBe("");
  expect(h.quoteHealth.status).toBe("unverified-nav-day");
});

test("no verified ISIN makes no third party backup request",async({page})=>{
  const count=await seed(page,{missingIsin:true});
  expect(count()).toBe(0);
  const h=await page.evaluate(()=>state.holdings[0]);
  expect(h.currentPrice).toBe(10.2);
  expect(h.quoteProvider).toBe("Primary simulated feed");
});

test("editing fund allows manually confirming an ISIN without changing quantity",async({page})=>{
  await seed(page,{missingIsin:true});
  await page.evaluate(()=>openDlg("alpha-fund-nav-fixture"));
  await expect(page.locator("#fundIsinEditor")).toBeVisible();
  await page.locator("#fundIsin").fill(FUND_ISIN);
  const oldQuantity=await page.locator("#qty").inputValue();
  expect(oldQuantity).toBe("11");
  await expect(page.locator("#fundIsin")).toHaveValue(FUND_ISIN);
});
