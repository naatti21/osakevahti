/**
 * Build-only watermark for the isolated Issue #77 Android QA preview.
 * NEVER modify the source Alpha files; mutate dist-alpha/ only.
 */
import {readFile, writeFile, copyFile} from 'node:fs/promises';
const generation=process.env.QA_GENERATION||'v1';
if(!['v1','v2','v3','v4','v5'].includes(generation))throw Error('Only explicit v1-v5 QA generations are accepted');
const dir='dist-alpha/';
async function replaceRequired(path,oldText,newText){
  const old=await readFile(dir+path,'utf8');
  if(!old.includes(oldText)||old.includes(newText))throw Error('QA packaging guard failed for '+path);
  const updated=old.replace(oldText,newText);
  await writeFile(dir+path,updated,'utf8');
}
await replaceRequired('index.html',
  '<title>Osakevahti Alpha</title>',
  '<title>Osakevahti QA – TESTI '+generation+'</title>');
await replaceRequired('index.html',
  '<h1>Osakevahti Alpha</h1>',
  '<h1>Osakevahti QA – TESTI '+generation+'</h1>');
const manifest=JSON.parse(await readFile(dir+'manifest.webmanifest','utf8'));
if(manifest.name!=='Osakevahti Alpha'||manifest.id!=='./?channel=alpha'||manifest.scope!=='./')throw Error('Unexpected manifest: refusing QA mutation');
manifest.name='Osakevahti QA – TESTI';
manifest.short_name='OV QA';
manifest.id='./?channel=issue77-qa';
await writeFile(dir+'manifest.webmanifest',JSON.stringify(manifest,null,2)+'\n','utf8');
const cache='osakevahti-shell-v2.17.9-alpha-fund-identity1';
await replaceRequired('sw.js',cache,'osakevahti-shell-v2.17.9-issue77-qa-'+generation);
const html=await readFile(dir+'index.html','utf8');
const sw=await readFile(dir+'sw.js','utf8');
if(!html.includes('Osakevahti QA – TESTI '+generation)||!sw.includes('issue77-qa-'+generation)||sw.includes('cache.put('))throw Error('QA package verification failed');
await copyFile('scripts/qa/issue77-nav-test.html',dir+'nav-test.html');
const probe=await readFile(dir+'nav-test.html','utf8');
if(!probe.includes('kokeellinen NAV-haku')||!probe.includes('createFundBackup'))throw Error('QA NAV probe missing');
console.log('QA preview package verified:',generation,'(manifest identity isolated; source files unchanged)');
