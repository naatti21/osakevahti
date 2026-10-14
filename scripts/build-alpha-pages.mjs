// Deterministic static-only Cloudflare Pages Alpha build.
// Only the 6 allowlisted PWA files are published; never copy .github, tests,
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
    !sw.includes('const CACHE = "osakevahti-shell-v2.17.4-alpha";')) {
  throw new Error('Missing locked service-worker safety guards');
}

await rm(output, {recursive:true,force:true});
await mkdir(output, {recursive:true});
for(const name of files)await copyFile(join(root,name),join(output,name));

// Search exclusion, not access control: an Alpha link is still public.
// These rules apply to Cloudflare Pages static responses only.
await writeFile(join(output,'_headers'),
  '/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n' +
  '/sw.js\n  Cache-Control: no-cache, no-store, must-revalidate\n' +
  '/manifest.webmanifest\n  Cache-Control: no-cache, no-store, must-revalidate\n' +
  '/index.html\n  Cache-Control: no-cache, no-store, must-revalidate\n', 'utf8');
await writeFile(join(output,'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
const actual=(await readdir(output)).sort();
const expected=[...files,'_headers','robots.txt'].sort();
if (JSON.stringify(actual)!==JSON.stringify(expected)) {
  throw new Error('Unexpected file in Cloudflare Alpha output: '+actual.join(', '));
}
console.log('Alpha static assets verified: '+actual.join(', '));
console.log('Output: dist-alpha/ (Cloudflare Pages build output directory)');
console.log('This build does NOT deploy or authorize any production release.');
