import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('index.html','utf8');
test('newly saved fund onboards from all creation paths; no parser or Engine replacement',()=>{
 assert.match(s,/function onNewFundsSaved\(newIds\)/);
 assert.match(s,/if\(i<0&&h\.assetType==="fund"\)onNewFundsSaved\(\[h\.id\]\)/);
 assert.match(s,/onNewFundsSaved\(state\.holdings\.filter\(h=>h\.assetType==="fund"&&!beforeIds\.has\(String\(h\.id\)\)\)\.map\(h=>h\.id\)\)/);
 assert.match(s,/if\(additions\.length\)onNewFundsSaved\(additions\.map\(h=>h\.id\)\)/);
 assert.match(s,/await scanLegacyFundNav\(\)/);
});
test('new NAV proposal never changes holdings or grants source consent',()=>{
 const start=s.indexOf('function onNewFundsSaved(newIds){');
 const end=s.indexOf('function renderNavConsentList(){',start);
 assert.ok(start>0&&end>start);
 const code=s.slice(start,end);
 assert.ok(!/navConsentForHolding\(|navOptIn\s*=|navBinding\s*=|state\.holdings\s*=/.test(code));
 assert.match(code,/navConsentProposals\.delete/);
 assert.match(code,/\.find\(x=>x\.dataset\.view==="settingsView"\)/);
});
