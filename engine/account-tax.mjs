// Pure local calculations. 2026 rules supplied in product brief; official recheck blocks release.
export const TAX_VERSION='fi-2026-brief-0.2.0';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const nonnegative=x=>finite(x)&&x>=0;
function requireValue(ok){if(!ok)throw new RangeError('Invalid or incomplete tax inputs');}
export function capitalTax(income,otherTaxableIncome=0){
  requireValue(nonnegative(income)&&nonnegative(otherTaxableIncome));
  const lower=Math.min(income,Math.max(0,30000-otherTaxableIncome));return lower*.30+(income-lower)*.34;
}
export function aotDividendTax(gross,otherTaxableIncome=0){requireValue(nonnegative(gross));return capitalTax(gross*.85,otherTaxableIncome);}
export function ostWithdrawal({value,depositBasis,withdrawal,rate}){
  requireValue(nonnegative(value)&&nonnegative(depositBasis)&&nonnegative(withdrawal)&&withdrawal<=value&&[.30,.34].includes(rate));
  const taxable=value>0?withdrawal*Math.max(0,value-depositBasis)/value:0;
  return {taxable,tax:taxable*rate,net:withdrawal-taxable*rate,remainingDepositBasis:Math.max(0,depositBasis-(withdrawal-taxable)),remainingValue:value-withdrawal};
}
export function aotSaleTax({proceeds,cost,years,rate}){
  requireValue(nonnegative(proceeds)&&nonnegative(cost)&&nonnegative(years)&&[.30,.34].includes(rate));
  const allowance=proceeds*(years>=10?.4:.2),deduction=Math.max(cost,allowance);
  return {tax:Math.max(0,proceeds-deduction)*rate,deduction,loss:Math.max(0,cost-proceeds)};
}
export function compareScenario({principal,years,dividendYield,priceGrowth,reinvest,rate}){
  requireValue(finite(principal)&&principal>0&&principal<=100000&&[3,5,10,15,20].includes(years)&&
    finite(dividendYield)&&dividendYield>=0&&dividendYield<=.3&&finite(priceGrowth)&&priceGrowth>-.9&&priceGrowth<=1&&typeof reinvest==='boolean'&&[.30,.34].includes(rate));
  // New isolated hypothetical account, not the actual user's whole OST. No fees/trades assumed.
  let price=1,ostUnits=principal,ostBasis=principal,ostCash=0,aotCash=0,aotDividendTaxes=0,ostTaxes=0;
  const lots=[{units:principal,cost:principal,year:0}];
  for(let year=1;year<=years;year++){
    price*=1+priceGrowth;
    const aotGross=lots.reduce((s,l)=>s+l.units,0)*price*dividendYield,at=aotGross*.85*rate;
    aotDividendTaxes+=at;
    if(reinvest)lots.push({units:(aotGross-at)/price,cost:aotGross-at,year});else aotCash+=aotGross-at;
    const ostGross=ostUnits*price*dividendYield;
    if(reinvest)ostUnits+=ostGross/price;
    else {const w=ostWithdrawal({value:ostUnits*price+ostGross,depositBasis:ostBasis,withdrawal:ostGross,rate});ostCash+=w.net;ostTaxes+=w.tax;ostBasis=w.remainingDepositBasis;}
  }
  const aotSale=lots.reduce((s,l)=>s+aotSaleTax({proceeds:l.units*price,cost:l.cost,years:years-l.year,rate}).tax,0);
  const aot=lots.reduce((s,l)=>s+l.units*price,0)-aotSale+aotCash;
  const closing=ostWithdrawal({value:ostUnits*price,depositBasis:ostBasis,withdrawal:ostUnits*price,rate});
  return {methodVersion:TAX_VERSION,kind:'illustration-not-personal-tax',aot,ost:closing.net+ostCash,
    aotDividendTaxes,aotSaleTax:aotSale,ostTax:ostTaxes+closing.tax,
    recommendation:'Tieto ei riitä',assumptions:{principal,years,dividendYield,priceGrowth,reinvest,rate,fees:0},
    limitations:['Isolated new account; actual OST withdrawal uses the entire account','No annual loss relief assumed','Constant marginal-rate scenario, not annual tax filing','No foreign withholding or instrument eligibility verified']};
}


// Portfolio-only illustration. Does not modify holdings, transmit account data,
// infer tax residency, or pretend to know OST cash/deposit headroom.
export function localAccountPlacement({holdings,listing,investmentEur,baseCurrency='EUR'}={}){
 const code=String(listing??'').trim().toUpperCase();
 const fail=reason=>({status:'unavailable',reason});
 if(!/^[A-Z0-9][A-Z0-9-]{0,16}\.HE$/.test(code))return fail('Anna täsmällinen Helsingin listaus, esim. KESKO-B.HE.');
 if(baseCurrency!=='EUR')return fail('Tilivertailu tukee EUR-perusvaluuttaa.');
 if(!Array.isArray(holdings)||!finite(investmentEur)||investmentEur<=0||investmentEur>100000)
  return fail('Tarkista sijoitussumma ja salkun tiedot.');
 const accounts={OST:{count:0,value:0,sameListingValue:0,missing:0,approximate:0},
   AOT:{count:0,value:0,sameListingValue:0,missing:0,approximate:0}};
 let unconfirmed=0;
 for(const h of holdings){
  if(!h||typeof h!=='object'){unconfirmed++;continue;}
  const qty=Number(h.quantity);
  if(!Number.isFinite(qty)||qty<0){unconfirmed++;continue;}
  if(qty===0)continue;
  if(h.accountDetailsConfirmed!==true){unconfirmed++;continue;}
  const a=accounts[h.accountType];if(!a)continue;
  a.count++;
  if(h.assetType==='fund'&&h.accountType==='OST'){a.missing++;continue;}
  const good=v=>v!==null&&v!==undefined&&v!==''&&finite(Number(v))&&Number(v)>0;
  const current=good(h.currentPrice),manual=good(h.manualPrice);
  const price=current?Number(h.currentPrice):manual?Number(h.manualPrice):null;
  const fx=h.currency==='EUR'?1:good(h.fxRate)&&h.fxRateStatus!=='unavailable'&&
    Number(h.fxRateUpdatedAt)>0?Number(h.fxRate):null;
  if(price===null||fx===null||!finite(qty*price*fx)){a.missing++;continue;}
  const value=qty*price*fx;a.value+=value;
  const ids=[h.instrument?.listingTicker,h.instrument?.providerSymbol,h.providerSymbol,h.symbol]
    .filter(s=>typeof s==='string').map(s=>s.trim().toUpperCase());
  if(ids.includes(code))a.sameListingValue+=value;
  const age=Date.now()-Number(h.quoteTimestamp);
  if(!current||!finite(age)||Number(h.quoteTimestamp)<=0||age< -300000||age>7*86400000)a.approximate++;
 }
 for(const a of Object.values(accounts)){
  a.complete=a.missing===0;
  a.newListingWeightPct=a.complete?(a.sameListingValue+investmentEur)/(a.value+investmentEur)*100:null;
  a.highSingleListingShare=a.newListingWeightPct!==null&&a.newListingWeightPct>20;
 }
 return {status:unconfirmed||Object.values(accounts).some(a=>a.missing)?'partial':'indicative',
   accounts,listing:code,unconfirmed,investmentEur,recommendation:'Tieto ei riitä',
   warning:'Osuus koskee vain vahvistettuja, sovellukseen tallennettuja omistuksia. Käteinen, puuttuvat sijoitukset, OST:n talletusvara ja yhtiön verotuksellinen kotipaikka eivät ole tiedossa.'};
}
