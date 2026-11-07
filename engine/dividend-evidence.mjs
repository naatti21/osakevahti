// Source adapters must supply verified issuer evidence; this module never fetches data.
export const DIVIDEND_METHOD = 'dividend-evidence-0.2.0';
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const money = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const link = x => { try { return new URL(x).protocol === 'https:'; } catch { return false; } };
export function dividendEvidence({identity, events, completedYears, comparableBasis, now = new Date().toISOString().slice(0,10)}) {
  const missing = reason => ({status:'unavailable',reason,methodVersion:DIVIDEND_METHOD,quality:'Tietoa liian vähän'});
  if (!identity?.verified || !identity.isin || !identity.listing || !identity.shareClass || !identity.currency || !comparableBasis || !day(now)) return missing('identity-or-share-basis-missing');
  if (!Array.isArray(events) || !events.length) return missing('events-missing-not-zero');
  const seen = new Set(), years = new Map(); let trailingPaid = 0, approvedFuture = 0;
  const cutoff = new Date(now); cutoff.setUTCDate(cutoff.getUTCDate()-365);
  for (const e of events) {
    if (!e.id || seen.has(e.id) || ['isin','listing','shareClass','currency'].some(k=>e[k]!==identity[k]) ||
        !money(e.amountPerShare) || e.basis!==comparableBasis || !Number.isInteger(e.fiscalYear) || e.fiscalYear<1900 || e.fiscalYear>Number(now.slice(0,4)) ||
        !['ordinary','interim','extra','capital-return'].includes(e.eventType) || !['proposed','approved','paid','unknown'].includes(e.status) ||
        !link(e.sourceUrl) || !day(e.verifiedAt) || e.verifiedAt>now || !day(e.exDate) || !day(e.recordDate) || !day(e.paymentDate) ||
        e.exDate>e.recordDate || e.recordDate>e.paymentDate || (e.status==='paid'&&e.paymentDate>now)) return missing('contradictory-event');
    seen.add(e.id);
    // Capital returns are not dividends. Future approved installments are not paid income.
    if (e.eventType==='capital-return') continue;
    if (e.status==='paid' && new Date(e.paymentDate)>cutoff) trailingPaid+=e.amountPerShare;
    if (e.status==='approved' && e.paymentDate>now) approvedFuture+=e.amountPerShare;
    if (['ordinary','interim'].includes(e.eventType) && ['paid','approved'].includes(e.status)) {
      years.set(e.fiscalYear,(years.get(e.fiscalYear)||0)+e.amountPerShare);
    }
  }
  // Completeness must be explicitly evidenced per fiscal year, including verified zero decisions.
  const complete = Array.isArray(completedYears) ? completedYears.filter(y=>Number.isInteger(y.year)&&y.year<Number(now.slice(0,4))&&y.basis===comparableBasis&&link(y.sourceUrl)&&day(y.verifiedAt)&&y.verifiedAt<=now&&y.complete===true) : [];
  const lastFive = Array.from({length:5},(_,i)=>Number(now.slice(0,4))-1-i);
  const coverage = lastFive.filter(y=>complete.some(c=>c.year===y));
  return {status:'ok',methodVersion:DIVIDEND_METHOD,currency:identity.currency,trailingPaid,approvedFuture,
    fiscalOrdinary:[...years].map(([year,amount])=>({year,amount,complete:coverage.includes(year)})),
    completeYears:coverage.length,continuity:coverage.length===5?lastFive.filter(y=>(years.get(y)||0)>0).length:null,
    quality:'Tietoa liian vähän',reason:'solvency-and-comparable-growth-not-verified'};
}
