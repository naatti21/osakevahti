// Deterministic static-only Cloudflare Pages Alpha build.
// Only the explicitly allowlisted PWA files are published; never copy .github, tests,
// docs, local credentials or an unreviewed portfolio backup.
import { copyFile, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist-alpha');
const deployBranch = 'deploy/osakevahti-alpha-20261013';
const files = [
  'index.html',
  'image-reader.js',
  'alpha-import-engine.mjs',
  'engine/acceptance.mjs',
  'engine/numbers.mjs',
  'engine/csv.mjs',
  'engine/holdings.mjs',
  'engine/public-nav-backup.mjs',
  'sw.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png'
];

// Cloudflare Git-integrated preview branches must not publish an incomplete
// or unintended build. Only the explicitly selected Alpha deployment branch
// may deploy when CF_PAGES_BRANCH is available in the build environment.
if (process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== deployBranch) {
  throw new Error('Alpha Cloudflare Pages build refused unexpected branch ' + process.env.CF_PAGES_BRANCH);
}

const manifest = JSON.parse(await readFile(join(root, 'manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Osakevahti Alpha' ||
    manifest.short_name !== 'OV Alpha' ||
    manifest.id !== './?channel=alpha' ||
    manifest.start_url !== './' ||
    manifest.scope !== './') {
  throw new Error('Refusing non-Alpha PWA manifest or unexpected application scope');
}
const html = await readFile(join(root, 'index.html'), 'utf8');
if (!html.includes('<title>Osakevahti Alpha</title>') ||
    !html.includes('<h1>Osakevahti Alpha</h1>') ||
    !html.includes('navigator.serviceWorker.register("./sw.js",{scope:"./"})')) {
  throw new Error('Refusing to package an unbranded or unexpectedly scoped application');
}
const sw = await readFile(join(root, 'sw.js'), 'utf8');
if (!sw.includes('k.startsWith("osakevahti-shell-")') ||
    !sw.includes('if (res.ok)') ||
    !sw.includes('const CACHE = "osakevahti-shell-v2.17.9-alpha-public-nav1";')) {
  throw new Error('Missing locked service-worker safety guards');
}

await rm(output, {recursive:true,force:true});
await mkdir(output, {recursive:true});
for(const name of files){await mkdir(dirname(join(output,name)),{recursive:true});await copyFile(join(root,name),join(output,name));}

// Search exclusion, not access control: an Alpha link is still public.
// These rules apply to Cloudflare Pages static responses only.
await writeFile(join(output,'_headers'),
  '/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n' +
  '/sw.js\n  Cache-Control: no-cache, no-store, must-revalidate\n' +
  '/manifest.webmanifest\n  Cache-Control: no-cache, no-store, must-revalidate\n' +
  '/index.html\n  Cache-Control: no-cache, no-store, must-revalidate\n', 'utf8');
await writeFile(join(output,'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
const actual=(await readdir(output)).sort();
const expected=[...files.filter(name=>!name.includes('/')),'engine','_headers','robots.txt'].sort();
if (JSON.stringify(actual)!==JSON.stringify(expected)) {
  throw new Error('Unexpected file in Cloudflare Alpha output: '+actual.join(', '));
}
const engineFiles=(await readdir(join(output,'engine'))).sort();
const expectedEngineFiles=files.filter(name=>name.startsWith('engine/')).map(name=>name.slice('engine/'.length)).sort();
if(JSON.stringify(engineFiles)!==JSON.stringify(expectedEngineFiles))throw new Error('Alpha Engine assets not exact allowlist');
console.log('Alpha static assets verified: '+actual.join(', ')+' / engine: '+engineFiles.join(', '));
console.log('Output: dist-alpha/ (Cloudflare Pages build output directory)');
console.log('This build does NOT deploy or authorize any production release.');
