import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('actual public screening pipeline rejects invalid observations and missing dividends',()=>{
 const result=spawnSync('python3',['tests/screening-pipeline.py'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
