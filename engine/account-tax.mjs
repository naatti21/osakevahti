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
