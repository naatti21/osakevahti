import {test,expect} from '@playwright/test';

// Independent, deliberately adversarial UX regression. NO real user holdings.
// Always start fresh viewport BEFORE navigation. Never patch viewport metadata.
for(const px of [320,360,393]){
  test('dashboard does not widen beyond visible '+px+'px when real-length fields arrive',async({browser})=>{
    const context=await browser.newContext({viewport:{width:px,height:740},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage();
    await page.goto('/index.html');
    const r=await page.evaluate(()=>{
      // Use synthetic texts with the same structure as the real rendered UI.
      document.querySelector('#portfolioProfit').textContent='3 500,00 € · +37.14 %';
      document.querySelector('#quoteAge').textContent='7/7 osaketta · NAV 6/6 · viimeisin päivitetty';
      document.querySelector('#dailyMoves').innerHTML=
        '<div class="dailyMovesHead"><div><div class="dailyMovesTitle">Pikanäkymä</div><div class="quickHint">Markkina auki · kurssi ja päivän liike</div></div><div class="dailyMovesMeta">7 osaketta</div></div>'+
        '<div class="moveList">'+
        Array.from({length:7},(_,i)=>'<div class="moveRow"><div class="moveSymbol">SYMBOL'+(i+1)+'</div>'+
          '<div class="movePrice">1 586,82 €</div><div class="movePct">'+(i%2?'+1.15 %':'−3.09 %')+'</div>'+
          '<div class="moveAge">'+(i%2?'kauppa 15 min':'edellinen päätös')+'</div></div>').join('')+'</div>';
      document.querySelector('#portfolioPulse').innerHTML=
        '<div class="pulseTop"><div class="pulseTitle">Oma paketti</div><div class="pulseHint">nopea tilannekuva</div></div>'+
        '<div class="pulseGrid">'+['Suurin omistus','Top 3 paino','Osakkeet / rahastot','Tavoitepoikkeamia'].map((k,i)=>
          '<div class="pulseCell"><span>'+k+'</span><strong>'+['Synthetic Long Index Fund 25.5 %','47 %','52 / 48 %','2/7'][i]+'</strong></div>').join('')+'</div>';
      const vv=window.visualViewport;
      const boundary=(vv?.offsetLeft||0)+(vv?.width||innerWidth);
      const names=['#portfolioView','.hero','.row','#quoteAge','#dailyMoves','.moveRow','.moveAge','#portfolioPulse','nav'];
      const elements=names.map(selector=>{
        const node=document.querySelector(selector),box=node?.getBoundingClientRect();
        return {selector,right:Math.round(box?.right||0),left:Math.round(box?.left||0),
          scrollWidth:node?.scrollWidth||0,clientWidth:node?.clientWidth||0};
      });
      const nav=document.querySelector('nav').getBoundingClientRect();
      return {innerWidth,screenWidth:screen.width,viewportWidth:vv?.width,viewportHeight:vv?.height,
        visualOffsetLeft:vv?.offsetLeft,scale:vv?.scale,
        docWidth:document.documentElement.scrollWidth,docClientWidth:document.documentElement.clientWidth,
        navRight:nav.right,navBottom:nav.bottom,boundary,elements};
    });
    console.log('REAL_CONTENT_OVERFLOW',JSON.stringify({px,...r}));
    expect(r.docWidth,'Page must fit *visual* viewport at '+px+'px: '+JSON.stringify(r)).toBeLessThanOrEqual(r.boundary+1);
    expect(r.navRight,'Bottom nav must fit visual viewport at '+px+'px: '+JSON.stringify(r)).toBeLessThanOrEqual(r.boundary+1);
    await context.close();
  });
}
