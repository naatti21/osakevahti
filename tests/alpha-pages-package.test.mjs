import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const root=resolve('dist-alpha');
const paths=[
  'index.html','image-reader.js','alpha-import-engine.mjs',
  'engine/acceptance.mjs','engine/numbers.mjs','engine/csv.mjs','engine/holdings.mjs',
  'engine/public-nav-backup.mjs',
  'sw.js','manifest.webmanifest',
  'icon-192.png','icon-512.png'
];

test('Alpha build contains pinned research Engine and only explicitly allowed static assets',async()=>{
  const actual=(await readdir(root)).sort();
  assert.deepEqual(actual,[...paths.filter(name=>!name.includes('/')),'engine','_headers','robots.txt'].sort());
  assert.deepEqual((await readdir(join(root,'engine'))).sort(),
    paths.filter(name=>name.startsWith('engine/')).map(name=>name.slice('engine/'.length)).sort());
  for(const name of paths){
    const expected=await readFile(name),built=await readFile(join(root,name));
    assert.deepEqual(built,expected,'Source asset differs: '+name);
  }
});

test('Alpha PWA identity is distinct from production and visible on screen',async()=>{
  const manifest=JSON.parse(await readFile(join(root,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.name,'Osakevahti Alpha');
  assert.equal(manifest.short_name,'OV Alpha');
  assert.equal(manifest.id,'./?channel=alpha');
  assert.notEqual(manifest.id,'./');
  assert.equal(manifest.scope,'./');
  const html=await readFile(join(root,'index.html'),'utf8');
  assert.match(html,/<title>Osakevahti Alpha<\/title>/);
  assert.match(html,/<h1>Osakevahti Alpha<\/h1>/);
  assert.match(html,/ALPHA · v2.17.9/);
  assert.match(html,/Osakevahti Alpha · v2\.17\.8/);
  assert.match(html,/rel="manifest" href="\.\/manifest.webmanifest"/);
});

test('Alpha deployment headers discourage indexing and do not copy user data',async()=>{
  const headers=await readFile(join(root,'_headers'),'utf8');
  const robots=await readFile(join(root,'robots.txt'),'utf8');
  assert.match(headers,/X-Robots-Tag: noindex, nofollow, noarchive/);
  assert.match(headers,/\/sw\.js[\s\S]*Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(robots,/Disallow: \//);
  const sw=await readFile(join(root,'sw.js'),'utf8');
  assert.match(sw,/startsWith\("osakevahti-shell-"\)/);
  assert.match(sw,/if \(res\.ok\)/);
  assert.match(sw,/const CACHE = "osakevahti-shell-v2\.17\.8-alpha-public-nav1"/);
  assert.ok(!(await readdir(root)).some(f=>/\.(json|zip|env|bak)$/i.test(f)));
});


test('Alpha3 uses live public financial feeds, not nonexistent local static JSON',async()=>{
  const html=await readFile(join(root,'index.html'),'utf8');
  assert.match(html,/const PUBLIC_FEED_BASE="https:\/\/naatti21\.github\.io\/osakevahti\/"/);
  for(const file of ['market-data.json','insights.json','news-data.json',
                     'market-context.json','portfolio-status.json','risk-data.json']){
    assert.ok(html.includes('"'+file+'"'),'Public data file is not in allowlist: '+file);
    assert.ok(!html.includes('fetch(\`./'+file),'Still fetching missing local JSON '+file);
  }
  assert.match(html,/function publicFeedUrl\(file\)/);
  assert.match(html,/ALPHA · v2.17.9/);
  const manifest=JSON.parse(await readFile(join(root,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.id,'./?channel=alpha');
});