// Phase 1 preservation guard, not a permanent ban on later reviewed app changes.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const lock=JSON.parse(await readFile(new URL('./baseline-lock.json',import.meta.url),'utf8'));
for(const f of lock.files)assert.equal(createHash('sha256').update(await readFile(new URL(f.path,root))).digest('hex'),f.sha256,'Phase 1 changed locked baseline: '+f.path);
console.log(`PASS: ${lock.files.length} locked baseline files are unchanged (PR76 ${lock.pr76Sha}).`);
