import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { parse } from 'acorn';

// Extract original AST nodes verbatim. No parser, ranking or merging is reimplemented.
// UI bootstrap is intentionally excluded for fast logic tests. Browser tests load the full app.
export function newAdapter(source) {
  const html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1]).find(s => s.includes('function resolveImportedHolding'));
  if (!script) throw new Error('Production inline import engine not found');
  const ast = parse(script, {ecmaVersion: 'latest'});
  const constants = new Set(['MARKET_WORKER_URL','INSTRUMENT_SCHEMA_VERSION','LEGACY_DATA_KEYS',
    'IMPORT_HEADER_ALIASES','IMPORT_ALIAS_LOOKUP']);
  const nodes = ast.body.filter(n => n.type === 'FunctionDeclaration' ||
    (n.type === 'VariableDeclaration' && n.declarations.every(d => constants.has(d.id.name))));
  let candidates = [], network = 'ok';
  const context = vm.createContext({console, crypto: crypto.webcrypto, URL, AbortController,
    setTimeout, clearTimeout, Date, structuredClone, KEY:"osakevahti.single.v1",
    fetch: async () => {
      if (network === 'failure') throw new Error('Synthetic network failure');
      return {ok: network !== 'http', status: network === 'http' ? 503 : 200,
        json: async () => ({provider:'QA recorded contract', candidates: structuredClone(candidates)})};
    }});
  vm.runInContext('let state={holdings:[]}; let pendingImport=null;\n'+nodes.map(n => script.slice(n.start,n.end)).join('\n'), context);
  const names = ['parseImportTable','holdingFromImportRow','screenshotCandidatesFromOcr',
    'holdingFromOcrCandidate','resolveImportedHolding','scoreInstrumentCandidate',
    'holdingIdentityKey','holdingFallbackKey','mergeImportedHoldings','importActionForRow',
    'batchImportConflicts','strongIdentityConflict','findExistingHoldingMatch','commitPendingImport','validImportIsin','instrumentIdentityConflict'];
  const api = Object.fromEntries(names.map(name => [name, vm.runInContext('typeof '+name+' === "function" ? '+name+' : undefined', context)]));
  return {...api,
    snapshot() {return JSON.parse(vm.runInContext("JSON.stringify(state.holdings)",context));},
    commit(rows, existing=[]) {
      context.__rows=structuredClone(rows); context.__existing=structuredClone(existing);
      vm.runInContext('state.holdings=__existing; pendingImport={rows:__rows};\n'+
        'globalThis.__saved=null; globalThis.__alert=null;\n'+
        'localStorage={setItem(key,value){globalThis.__saved=JSON.parse(value).holdings}};\n'+
        'render=function(){}; $=function(){return {close(){}}};\n'+
        'alert=function(message){globalThis.__alert=message};\n'+
        'commitPendingImport();',context);
      return JSON.parse(vm.runInContext('JSON.stringify({holdings:state.holdings,saved:__saved,alert:__alert,pending:!!pendingImport})',context));
    },
    setCandidates(value, mode='ok') {candidates=value; network=mode;},
    setExisting(value) {context.__existing=structuredClone(value);vm.runInContext('state.holdings=__existing',context);},
    sourceSha256: crypto.createHash('sha256').update(html).digest('hex'),
    extractedSha256: crypto.createHash('sha256').update(nodes.map(n=>script.slice(n.start,n.end)).join('\n')).digest('hex')};
}