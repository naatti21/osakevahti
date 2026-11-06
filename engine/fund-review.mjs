// Review only: no position/account/cost data crosses the network boundary.
import {validIsin,validateNavQuote} from './fund-nav-contract.mjs';
import {ZERO_COST_SOURCES,freeSourceStatus} from './free-source-policy.mjs';
import {previewGatewayQuotes} from './gateway-preview.mjs';
const text=x=>String(x??'').trim();
const norm=x=>text(x).normalize('NFKC').toLocaleLowerCase('fi').replace(/\s+/g,' ');
export function normalizeFundCandidate(raw,query){
 if(!raw||!['fund','FUND'].includes(raw.type||raw.assetType)||!validIsin(raw.isin))return null;
 const c={name:text(raw.name).slice(0,160),isin:text(raw.isin).toUpperCase(),currency:text(raw.currency).toUpperCase(),shareClass:text(raw.shareClass).slice(0,80),provider:text(raw.provider||raw.sourceId).slice(0,80),evidence:text(raw.identityEvidence||raw.identityStatus||'Hakutulos, ei riippumaton varmennus').slice(0,240)};
 if(!c.name||!c.provider||!/^[A-Z]{3}$/.test(c.currency))return null;
 if(validIsin(query)?c.isin!==text(query).toUpperCase():!norm(query).split(' ').every(t=>norm(c.name).includes(t)))return null;
 return c;
}
export async function searchFundCandidates(query,{gatewayUrl,fetchImpl=fetch,signal}={}){
 const q=text(query);if(q.length<2||q.length>80)throw Error('Anna 2–80 merkin nimi tai ISIN.');
 if(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(q)&&!validIsin(q))throw Error('ISIN-tarkiste on virheellinen.');
 const url=new URL('/v1/search',gatewayUrl);if(url.protocol!=='https:')throw Error('HTTPS gateway required');url.searchParams.set('q',q);
 const response=await fetchImpl(url.href,{signal,credentials:'omit',redirect:'error',cache:'no-store',headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('Haku ei käytettävissä (HTTP '+response.status+'). Jatka tarvittaessa käsin.');
 const data=await response.json();if(!Array.isArray(data.candidates))throw Error('Hakupalvelu ei palauttanut rahastoehdokkaita.');
 const rows=data.candidates.slice(0,24).map(c=>normalizeFundCandidate(c,q)).filter(Boolean);
 // Conflicting metadata for the same ISIN is not an arbitrary first match.
 const ambiguous=new Set(rows.filter((c,i)=>rows.some((d,j)=>i!==j&&c.isin===d.isin&&JSON.stringify(c)!==JSON.stringify(d))).map(c=>c.isin));
 return rows.filter((c,i)=>!ambiguous.has(c.isin)&&rows.findIndex(d=>JSON.stringify(d)===JSON.stringify(c))===i);
}
export function bindingEligibility(identity,observation,{sources=ZERO_COST_SOURCES}={}){
 const deny=reason=>({allowed:false,reason});
 const source=sources.find(s=>s.id===identity?.provider);
 if(!source||source.role!=='fund-nav'||!source.assets?.includes('fund')||!freeSourceStatus(source).usable)return deny('Automaattisen rahastolähteen kyvykkyyttä ja käyttöoikeutta ei ole hyväksytty. Käytä KÄSIN NAV -reittiä.');
 if(!validIsin(identity.isin)||!identity.shareClass||!identity.currency)return deny('ISIN, osuuslaji tai valuutta puuttuu.');
 const p=observation?.providerIdentity;
 if(!p||p.isin!==identity.isin||p.currency!==identity.currency||norm(p.shareClass)!==norm(identity.shareClass)||observation.currency!==identity.currency||observation.provider!==identity.provider||observation.requiresManualReview!==false||p.identityStatus!=='issuer-or-qualified-provider-isin')return deny('Lähdehavainto ei varmista samaa ISINiä, osuuslajia, valuuttaa ja provideria.');
 const checked=validateNavQuote({isin:p.isin,currency:observation.currency,shareClass:p.shareClass,provider:observation.provider,sourceKind:observation.sourceKind,price:observation.price,navDate:observation.navDate},identity);
 if(checked.status!=='candidate')return deny(checked.reason);
 return {allowed:true,reason:'Lähteen kyvykkyys ja havaintojen identiteetti vastaavat valintaa.'};
}
export async function previewFundSource(identity,options={}){
 const preliminary=bindingEligibility(identity,null);
 // No unqualified source is contacted for price approval. Rights cannot come
 // from a response flag, the entered URL, or the user's checkbox.
 if(!preliminary.allowed&&!ZERO_COST_SOURCES.some(s=>s.id===identity?.provider&&s.role==='fund-nav'&&freeSourceStatus(s).usable))return {candidates:[],issues:[{reason:preliminary.reason}]};
 return previewGatewayQuotes([{assetType:'fund',name:identity.name,currency:identity.currency,instrument:{isin:identity.isin,shareClass:identity.shareClass,assetType:'fund',currency:identity.currency}}],options);
}
export function attachReviewedIdentity(holding,{isin='',identityConfirmed=false,sourceConfirmed=false,candidate=null}={},now=Date.now()){
 const id=text(isin).toUpperCase();
 if(!id)return holding;
 if(!validIsin(id))throw Error('ISIN on virheellinen. Korjaa tunnus tai jatka ilman ISINiä.');
 if(!identityConfirmed||!sourceConfirmed)throw Error('Vahvista erikseen instrumentti ja KÄSIN-hintalähde.');
 if(candidate&&(candidate.isin!==id||norm(candidate.name)!==norm(holding.name)||candidate.currency!==holding.currency||norm(candidate.shareClass)!==norm(holding.instrument.shareClass)))throw Error('Valitut tunnistetiedot muuttuivat. Hae ja tarkista ehdokas uudelleen.');
 return {...holding,instrument:{...holding.instrument,isin:id,identification:'user-confirmed',source:candidate?.provider||'manual-identity-review'},
  identityEvidence:candidate?{...candidate,reviewedAt:now,independentlyVerified:false}:{reviewedAt:now,independentlyVerified:false},
  sourceBinding:{mode:'manual',providerId:'manual',isin:id,shareClass:holding.instrument.shareClass,currency:holding.currency,acceptedAt:now,automatic:false}};
}
export function validateFundReviewBackup(h){
 if(!h.sourceBinding)return;
 if(h.sourceBinding.mode!=='manual'){if(h.quoteSource==='MANUAL_NAV')throw Error('Käsin syötetty NAV ei hyväksy automaattista sidontaa.');return;}
 const b=h.sourceBinding;
 if(h.instrument?.identification!=='user-confirmed'||h.identityEvidence?.independentlyVerified!==false||b.providerId!=='manual'||h.instrument?.currency!==h.currency||b.automatic!==false||!validIsin(b.isin)||b.isin!==h.instrument?.isin||b.currency!==h.currency||norm(b.shareClass)!==norm(h.instrument?.shareClass)||h.quoteSource!=='MANUAL_NAV')throw Error('Rahaston lähdesidonta ja identiteetti ovat ristiriidassa.');
}
