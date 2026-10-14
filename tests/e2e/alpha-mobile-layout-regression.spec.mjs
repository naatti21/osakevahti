import {test,expect} from '@playwright/test';

// Mobile regression: viewport width, interactive nav, no sideways scroll.
// Synthetic fixtures only. Never touches live holdings.
test.use({isMobile:true,hasTouch:true,viewport:{width:360,height:740}});
test('diagnose mobile overflow in every view and keep nav visible at initial position',async({page})=>{
 await page.goto('/index.html');
 const views=['portfolioView','riskView','newsView','settingsView'];
 for(const width of [320,360,375,390,412]){
   await page.setViewportSize({width,height:740});
   for(const view of views){
     await page.locator('.nav[data-view="'+view+'"]').click();
     if(view==='newsView'){
       await page.locator('.insightTab[data-panel="dividendPanel"]').click();
       await page.locator('#dividendPanel .universeManager summary').click();
       await page.locator('.insightTab[data-panel="rocketPanel"]').click();
     }
     const info=await page.evaluate(()=>{
       const vw=document.documentElement.clientWidth;
       const visible=[...document.querySelectorAll('body *')].filter(el=>{
         const st=getComputedStyle(el),r=el.getBoundingClientRect();
         return st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0 &&
           !el.closest('dialog:not([open])')&&r.right>vw+1&&r.left<vw+150;
       }).map(el=>({tag:el.tagName,id:el.id,cls:typeof el.className==='string'?el.className.slice(0,65):'',text:el.textContent?.trim()?.slice(0,45),right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)}))
         .sort((a,b)=>b.right-a.right).slice(0,8);
       const nav=document.querySelector('nav').getBoundingClientRect();
       const vv=window.visualViewport;
       return {vw,screenWidth:window.innerWidth,sw:document.documentElement.scrollWidth,
         navTop:Math.round(nav.top),navBottom:Math.round(nav.bottom),vvHeight:Math.round(vv?.height||0),
         vvOffset:Math.round(vv?.offsetTop||0),scrollY:window.scrollY,offenders:visible};
     });
     console.log('MOBILE_LAYOUT_DIAG',JSON.stringify({width,view,...info}));
     expect(info.sw,'Overflow at '+width+'px '+view+': '+JSON.stringify(info.offenders)).toBeLessThanOrEqual(info.vw+1);
     expect(info.navBottom,'Nav not visible at '+width+'px '+view).toBeLessThanOrEqual(info.vvHeight+info.vvOffset+2);
   }
 }
});

test('synthetic portfolio with long labels and large numbers stays within mobile width',async({page})=>{
 await page.addInitScript(()=>{
   const key='osakevahti.single.v1';
   if(localStorage.getItem(key))return;
   localStorage.setItem(key,JSON.stringify({
     baseCurrency:'EUR',riskBudgetPct:1.25,showDetails:true,news:[],apiKey:'',
     holdings:[
       {id:'MOBILE-QA-01',symbol:'VERY-LONG-TEST-TICKER',name:'Synthetic exceptionally long listed security for wrapping test',
        quantity:12345678.456,buyPrice:123456.789,currency:'EUR',assetType:'stock',
        currentPrice:123458.123,quoteTimestamp:Date.now(),quoteSource:'WORKER',quoteProvider:'Yahoo Finance',
        trailingPct:12,riskClass:'medium',accountType:'AOT',accountDetailsConfirmed:true,broker:'Nordea'},
       {id:'MOBILE-QA-02',symbol:'MSFT',name:'Microsoft synthetic mock quote',quantity:250000,buyPrice:987.64,
        currency:'USD',assetType:'stock',currentPrice:1234.56,quoteTimestamp:Date.now(),quoteSource:'WORKER',
        quoteProvider:'Yahoo Finance',trailingPct:12,riskClass:'high',accountType:'AOT',
        accountDetailsConfirmed:true,broker:'Nordnet'}
     ]
   }));
 });
 await page.goto('/index.html');
 for(const width of [320,360,390]){
   await page.setViewportSize({width,height:740});
   for(const view of ['portfolioView','riskView','newsView','settingsView']){
     await page.locator('.nav[data-view="'+view+'"]').click();
     const result=await page.evaluate(()=>{
       const sw=document.documentElement.scrollWidth, vw=document.documentElement.clientWidth;
       const bad=[...document.querySelectorAll('body *')].filter(el=>{
         const r=el.getBoundingClientRect(),c=getComputedStyle(el);
         return c.display!=='none'&&r.width>0&&r.right>vw+2&&r.left<vw+100;
       }).slice(0,12).map(x=>({tag:x.tagName,className:String(x.className).slice(0,60),
         text:x.textContent?.slice(0,35),right:Math.round(x.getBoundingClientRect().right)}));
       return {sw,vw,bad};
     });
     console.log('MOBILE_SYNTHETIC',JSON.stringify({width,view,...result}));
     expect(result.sw,JSON.stringify({width,view,bad:result.bad})).toBeLessThanOrEqual(result.vw+1);
   }
 }
});
test('nav stays visible after real mobile viewport height changes',async({page})=>{
  await page.goto('/index.html');
  for(const height of [740,620,550,740]){
    await page.setViewportSize({width:360,height});
    const result=await page.evaluate(()=>{
      const nav=document.querySelector('nav').getBoundingClientRect();
      return {navBottom:nav.bottom,windowHeight:window.innerHeight,navVisible:nav.top>=0};
    });
    expect(result.navBottom,'Fixed bottom nav should fit real viewport height '+height)
      .toBeLessThanOrEqual(result.windowHeight+1);
    expect(result.navVisible).toBe(true);
  }
});
test('explanation links restore original wrapping, remain tappable and have no dotted underlines',async({page})=>{
  await page.route('**/insights.json*',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({generated_at:'2026-10-14T10:00:00Z',
      dividends:[{ticker:'LONG.HE',name:'Synthetic dividend name',score:51,
        yield_pct:6.1,dividend_years:3,return_12m:1,max_drawdown:-18,
        reason:'TTM-osinko 6,1 %, osinkoa 3/5'}],
      rockets:[{ticker:'LONG',name:'Synthetic radar name',score:51,m1:4,m3:7,m6:9,
        volume_ratio:1.6,label:'SEURAA',reason:'volatiliteetti',risk:'keskitaso'}]})}));
  await page.goto('/index.html');
  await page.locator('.nav[data-view="newsView"]').click();
  for(const [tab,list] of [['dividendPanel','dividendList'],['rocketPanel','rocketList']]){
    await page.locator('.insightTab[data-panel="'+tab+'"]').click();
    await page.setViewportSize({width:320,height:740});
    const help=page.locator('#'+list+' .metricHelp').first();
    await expect(help).toBeVisible();
    const data=await help.evaluate(el=>{
      const style=getComputedStyle(el),rect=el.getBoundingClientRect();
      return {display:style.display,decoration:style.textDecorationLine,
        bottom:style.borderBottomStyle,right:rect.right,vw:document.documentElement.clientWidth,
        pageWidth:document.documentElement.scrollWidth};
    });
    expect(data.display,'Do not recreate the inline-flex regression').not.toBe('inline-flex');
    expect(data.bottom).toBe('none');
    expect(data.decoration).toBe('none');
    expect(data.pageWidth).toBeLessThanOrEqual(data.vw+1);
    expect(data.right).toBeLessThanOrEqual(data.vw+1);
    await help.click();
    await expect(page.locator('#metricHelpDlg')).toBeVisible();
    await page.locator('#closeMetricHelp').click();
  }
});

test('large nonbreaking-space formatted portfolio value does not widen real layout or nav',async({page})=>{
  await page.goto('/index.html');
  for(const width of [320,360,375,390,412]){
    await page.setViewportSize({width,height:740});
    const data=await page.evaluate(()=>{
      const amount=document.querySelector('#portfolioValue');
      amount.textContent='1\u202f523\u202f000\u202f500\u202f350,00\u00a0€';
      const hero=amount.getBoundingClientRect(),nav=document.querySelector('nav').getBoundingClientRect();
      return {vw:document.documentElement.clientWidth,
        sw:document.documentElement.scrollWidth,
        amountRight:hero.right,navLeft:nav.left,navRight:nav.right,navWidth:nav.width};
    });
    expect(data.sw,'Unbreakable currency sum must not expand document at '+width).toBeLessThanOrEqual(data.vw+1);
    expect(data.amountRight).toBeLessThanOrEqual(data.vw+1);
    expect(data.navLeft).toBeGreaterThanOrEqual(-1);
    expect(data.navRight).toBeLessThanOrEqual(data.vw+1);
    expect(data.navWidth).toBeLessThanOrEqual(data.vw+1);
  }
});
