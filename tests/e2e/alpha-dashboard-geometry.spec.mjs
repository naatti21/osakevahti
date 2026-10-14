import {test,expect} from '@playwright/test';

// Screenshot-inspired but entirely synthetic. No personal positions or numbers.
// Measures rendered geometry and horizontal scroll, not only CSS existence.
test.use({isMobile:true,hasTouch:true,viewport:{width:360,height:720}});
const fill=()=> {
  document.querySelector('#portfolioValue').textContent='13 371,17 €';
  document.querySelector('#portfolioProfit').textContent='3 621,46 € · +37.14 %';
  document.querySelector('#quoteAge').textContent='7/7 osaketta · NAV 6/6 · edellinen päätös';
  document.querySelector('#accountSummary').innerHTML=Array.from({length:4},(_,i)=>
    '<div class="summaryChip"><span>'+['Tänään osakkeet','OST · vahvistettu','AOT · vahvistettu','Rahasto-osuus'][i]+'</span><strong>'+['−44,75 €','5 673,61 €','7 191,12 €','48 %'][i]+'</strong></div>').join('');
  const symbols=['TICK-A','TICK-B','TICK-C','TICK-D','TICK-E','TICK-F','TICK-G'];
  const amounts=['586,82 $','6,78 €','3,82 €','17,08 €','8,91 €','23,47 €','16,98 €'];
  document.querySelector('#dailyMoves').innerHTML='<div class="dailyMovesHead"><div><div class="dailyMovesTitle">Pikanäkymä</div><div class="quickHint">Markkina auki · kurssi ja päivän liike</div></div><div class="dailyMovesMeta">7 osaketta</div></div><div class="moveList">'+symbols.map((symbol,i)=>
    '<div class="moveRow"><div class="moveSymbol">'+symbol+'</div><div class="movePrice">'+amounts[i]+'</div><div class="movePct">'+(i%2?'+1.15 %':'−3.09 %')+'</div><div class="moveAge">kauppa 15 minuuttia sitten</div></div>').join('')+'</div>';
  document.querySelector('#portfolioPulse').innerHTML='<div class="pulseTop"><div class="pulseTitle">Oma paketti</div><div class="pulseHint">nopea tilannekuva</div></div><div class="pulseGrid">'+
    ['Suurin omistus','Top 3 paino','Osakkeet / rahastot','Tavoitepoikkeamia'].map((x,i)=>
    '<div class="pulseCell"><span>'+x+'</span><strong>'+['Synthetic index fund holding 25,5 %','47 %','52 / 48 %','2/7'][i]+'</strong></div>').join('')+'</div>';
};
const snapshot=()=> {
 const vw=document.documentElement.clientWidth;
 const nav=document.querySelector('nav').getBoundingClientRect();
 const main=document.querySelector('main').getBoundingClientRect();
 const elems=[...document.querySelectorAll('body *')].filter(e=>{
   const r=e.getBoundingClientRect(),st=getComputedStyle(e);
   return st.visibility!=='hidden'&&st.display!=='none'&&r.width>0&&r.height>0&&
     r.right>vw+2&&r.left<vw+100;
 }).slice(0,12).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className.slice(0,50):'',
   right:Math.round(e.getBoundingClientRect().right)}));
 const vv=window.visualViewport;
 const scrollOffenders=[...document.querySelectorAll('body *')].filter(el=>
    el.clientWidth>0&&el.scrollWidth>el.clientWidth+2).map(el=>({
    tag:el.tagName,id:el.id||'',cls:typeof el.className==='string'?el.className.slice(0,50):'',
    client:el.clientWidth,scroll:el.scrollWidth})).sort((a,b)=>(b.scroll-b.client)-(a.scroll-a.client)).slice(0,14);
 return {vw,windowWidth:innerWidth,physical:{w:screen.width,h:screen.height},
   vv:{w:vv?.width,h:vv?.height,scale:vv?.scale,left:vv?.offsetLeft,top:vv?.offsetTop},
   dpr:devicePixelRatio,scrollOffenders,
   sw:document.documentElement.scrollWidth,bodyW:document.body.scrollWidth,
   mainRight:main.right,navLeft:nav.left,navRight:nav.right,navBottom:nav.bottom,
   innerHeight:innerHeight,offenders:elems};
};

test('screenshot-shaped dashboard never leaves mobile width and nav starts visible',async({browser})=>{
 for(const width of [320,360,375,393,412]){
   // New context before navigation: mobile layout viewport does not necessarily
   // recalculate when setViewportSize changes a previously loaded document.
   const context=await browser.newContext({
     baseURL:'http://127.0.0.1:4173',isMobile:true,hasTouch:true,
     viewport:{width,height:720},serviceWorkers:'block'
   });
   const page=await context.newPage();
   await page.goto('/index.html');
   await page.evaluate(fill);
   const beforeSync=await page.evaluate(snapshot);
   await page.evaluate(()=>syncNavigationToVisibleScreen());
   const state=await page.evaluate(snapshot);
   console.log('USER_SCREENSHOT_GEOMETRY',JSON.stringify({width,beforeSync,...state}));
   expect(state.sw,JSON.stringify(state)).toBeLessThanOrEqual(state.vw+1);
   expect(state.navLeft).toBeGreaterThanOrEqual(-1);
   expect(state.navRight).toBeLessThanOrEqual(state.vw+1);
   expect(state.navBottom,'Navigation must fit truly visible viewport')
     .toBeLessThanOrEqual(state.vv.h+state.vv.top+2);
   expect(state.navRight,'Navigation must fit truly visible viewport width')
     .toBeLessThanOrEqual(state.vv.w+state.vv.left+2);
   await page.evaluate(()=>scrollTo(500,0));
   expect(await page.evaluate(()=>scrollX),'Page can still be dragged horizontally').toBe(0);
   await context.close();
 }
});

test('quick list preserves all four pieces of information without right clipping',async({page})=>{
 await page.goto('/index.html');
 await page.setViewportSize({width:360,height:720});
 const m=await page.evaluate(()=>{
   const symbols=['S-A','S-B','S-C','S-D','S-E','S-F','S-G'];
   document.querySelector('#dailyMoves').innerHTML='<div class="moveList">'+
   symbols.map(s=>'<div class="moveRow"><div class="moveSymbol">'+s+
     '</div><div class="movePrice">586,82 $</div><div class="movePct">−3.09 %</div><div class="moveAge">kauppa 15 min</div></div>').join('')+'</div>';
   const vw=document.documentElement.clientWidth;
   return [...document.querySelectorAll('.moveRow')].map(row=>({
     rowRight:row.getBoundingClientRect().right,
     parts:[...row.children].map(el=>({display:getComputedStyle(el).display,
       right:el.getBoundingClientRect().right,text:el.textContent.trim()}))
   })).map(v=>({...v,vw}));
 });
 for(const row of m){
   expect(row.rowRight).toBeLessThanOrEqual(row.vw+1);
   expect(row.parts).toHaveLength(4);
   for(const part of row.parts){
     expect(part.display).not.toBe('none');
     expect(part.right).toBeLessThanOrEqual(row.vw+1);
   }
 }
});

test('optional layout diagnostics require deliberate triple-tap and reveal only geometry',async({page})=>{
  await page.goto('/index.html');
  const dlg=page.locator('#layoutDiagDlg');
  await expect(dlg).not.toBeVisible();
  const version=page.locator('header .eyebrow');
  await version.click();await version.click();
  await expect(dlg).not.toBeVisible();
  await version.click();
  await expect(dlg).toBeVisible();
  const report=JSON.parse(await page.locator('#layoutDiagText').textContent());
  expect(report.version).toBe('v2.17.5');
  expect(report.width.visible).toBeGreaterThan(0);
  expect(report.width.scroll).toBeLessThanOrEqual(report.width.visible+1);
  expect(report).not.toHaveProperty('holdings');
  await page.locator('#closeLayoutDiag').click();
  await expect(dlg).not.toBeVisible();
});
