import {listingSymbol} from './instrument-data.mjs';
// An adapter needs an independently reviewed source policy. Merely being accessible is not permission.
export function validateRegistry(snapshot, policy, now=Date.now()) {
  const fail=reason=>({status:'unavailable',reason,listings:[]});
  if (!policy?.reviewed || policy.monthlyCost!==0 || policy.automatedUse!==true || policy.redistribution!==true || !policy.source || !policy.termsUrl) return fail('source-permission-unverified');
  if (snapshot?.schemaVersion!==1 || snapshot.source!==policy.source || !Array.isArray(snapshot.listings)) return fail('invalid-registry');
  const seen=new Set(), listings=[];
  for(const row of snapshot.listings) {
    const t=Date.parse(row.listUpdatedAt);
    if(!listingSymbol(row.symbol)||row.symbol!==listingSymbol(row.symbol)||!['XNAS','XNYS','XHEL','XSTO'].includes(row.mic)||
      !['US','FI','SE'].includes(row.country)||!['USD','EUR','SEK'].includes(row.currency)||
      ({XNAS:'US',XNYS:'US',XHEL:'FI',XSTO:'SE'})[row.mic]!==row.country ||
      ({US:'USD',FI:'EUR',SE:'SEK'})[row.country]!==row.currency ||
      row.instrumentType!=='stock'||!row.name||row.source!==policy.source||typeof row.active!=='boolean'||
      !Number.isFinite(t)||t>now||now-t>8*86400000) return fail('invalid-or-stale-listing');
    const key=row.mic+':'+row.symbol;
    if(seen.has(key))return fail('duplicate-listing');seen.add(key);
    if(row.active)listings.push({...row});
  }
  return {status:'ok',listings,source:policy.source,markets:[...new Set(listings.map(x=>x.mic))]};
}
