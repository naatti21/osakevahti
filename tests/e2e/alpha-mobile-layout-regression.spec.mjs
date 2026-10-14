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
