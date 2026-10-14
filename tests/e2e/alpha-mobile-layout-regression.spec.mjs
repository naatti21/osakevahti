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
test('nav tracks reduced visual viewport even before user scrolls',async({page})=>{
 await page.goto('/index.html');
 const result=await page.evaluate(()=>{
   const native=window.visualViewport;
   const fake={
     get height(){return window.innerHeight-90},
     get offsetTop(){return 0},
     addEventListener:()=>{},removeEventListener:()=>{}
   };
   Object.defineProperty(window,'visualViewport',{value:fake,configurable:true});
   window.dispatchEvent(new Event('resize'));
   const nav=document.querySelector('nav').getBoundingClientRect();
   Object.defineProperty(window,'visualViewport',{value:native,configurable:true});
   return {navBottom:nav.bottom,visibleBottom:window.innerHeight-90,windowHeight:window.innerHeight};
 });
 expect(result.navBottom,'Bottom bar must not be outside the visible mobile viewport').toBeLessThanOrEqual(result.visibleBottom+2);
});
