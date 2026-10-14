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
 return {vw,sw:document.documentElement.scrollWidth,bodyW:document.body.scrollWidth,
   mainRight:main.right,navLeft:nav.left,navRight:nav.right,navBottom:nav.bottom,
   innerHeight:innerHeight,offenders:elems};
};

test('screenshot-shaped dashboard never leaves mobile width and nav starts visible',async({page})=>{
 await page.goto('/index.html');
 for(const width of [320,360,375,393,412]){
   await page.setViewportSize({width,height:720});
   await page.evaluate(fill);
   const state=await page.evaluate(snapshot);
   console.log('USER_SCREENSHOT_GEOMETRY',JSON.stringify({width,...state}));
   expect(state.sw,JSON.stringify(state)).toBeLessThanOrEqual(state.vw+1);
   expect(state.navLeft).toBeGreaterThanOrEqual(-1);
   expect(state.navRight).toBeLessThanOrEqual(state.vw+1);
   expect(state.navBottom).toBeLessThanOrEqual(state.innerHeight+2);
   await page.evaluate(()=>scrollTo(500,0));
   expect(await page.evaluate(()=>scrollX),'Page can still be dragged horizontally').toBe(0);
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
