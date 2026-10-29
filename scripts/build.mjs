// Zero-dependency build: strips TypeScript types with Node's built-in stripper and
// rewrites ".ts" import specifiers to ".js", producing a static site in dist/.
//
// The artwork is not part of this repository (see src/ui/art.ts). By default the built site loads it from the
// artwork site. With --local-art it loads it from ./assets/ (a checkout of the artwork repository) and copies that
// folder into dist/: use it for local development, and for the Claude-hosted copy of the site.
//
// The default build also stamps every script and stylesheet address with a version (?v=...) that changes whenever
// anything shipped changes. GitHub Pages lets browsers keep a file for 10 minutes, so without it a phone that opened
// the site a few minutes before a deploy can keep the old stylesheet next to new scripts. With it, the page itself
// is the only thing that can be 10 minutes old, and it always points at a matching set of files.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const outDir = join(root, 'dist');
const localArt = process.argv.includes('--local-art');
const LOCAL_ART_BASE = './assets/';
const ART_LINE = /export const ART_BASE = '[^']*';/;
if (localArt && !existsSync(join(root, 'assets', 'sprites'))) {
  console.error('--local-art needs the artwork repository checked out as ./assets/. Run:\n  git clone https://github.com/Noxxionmurph/SaveHub-assets assets');
  process.exit(1);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// The version: a hash of everything that ships (not used by --local-art, which is for development and the hosted copy).
let version = '';
if (!localArt) {
  const files = [join(root, 'index.html'), join(root, 'styles.css'), join(root, 'fonts', 'fonts.css')];
  for await (const file of walk(srcDir)) if (file.endsWith('.ts')) files.push(file);
  const hash = createHash('sha256');
  for (const file of files.sort()) hash.update(relative(root, file)).update(await readFile(file));
  version = hash.digest('hex').slice(0, 10);
}
const versioned = (path) => (version ? `${path}?v=${version}` : path);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

let count = 0;
for await (const file of walk(srcDir)) {
  if (!file.endsWith('.ts')) continue;
  const source = await readFile(file, 'utf8');
  let js = stripTypeScriptTypes(source, { mode: 'strip' });
  js = js.replace(/(from\s+['"])(\.{1,2}\/[^'"]+)\.ts(['"])/g, '$1$2.js$3');
  js = js.replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+)\.ts(['"]\s*\))/g, '$1$2.js$3');
  if (version) {
    js = js.replace(/(from\s+['"])(\.{1,2}\/[^'"]+\.js)(['"])/g, `$1$2?v=${version}$3`);
    js = js.replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+\.js)(['"]\s*\))/g, `$1$2?v=${version}$3`);
  }
  if (localArt && relative(srcDir, file) === join('ui', 'art.ts')) {
    if (!ART_LINE.test(js)) throw new Error('src/ui/art.ts has no ART_BASE line for the build to rewrite');
    js = js.replace(ART_LINE, `export const ART_BASE = '${LOCAL_ART_BASE}';`);
  }
  const target = join(outDir, relative(srcDir, file)).replace(/\.ts$/, '.js');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, js);
  count++;
}

let page = await readFile(join(root, 'index.html'), 'utf8');
if (version) {
  for (const path of ['./fonts/fonts.css', './styles.css', './ui/main.js']) {
    if (page.split(`"${path}"`).length !== 2) throw new Error(`index.html must mention ${path} exactly once, for the build to version it`);
    page = page.replace(`"${path}"`, `"${versioned(path)}"`);
  }
}
await writeFile(join(outDir, 'index.html'), page);
await cp(join(root, 'styles.css'), join(outDir, 'styles.css'));
await cp(join(root, 'og-image.png'), join(outDir, 'og-image.png')); // link preview; remade by scripts/make-og-image.py
await cp(join(root, 'fonts'), join(outDir, 'fonts'), { recursive: true });
if (localArt) await cp(join(root, 'assets'), join(outDir, 'assets'), { recursive: true, filter: (src) => !/[\\/]\.git([\\/]|$)/.test(src) });
const art = (await readFile(join(outDir, 'ui', 'art.js'), 'utf8')).match(ART_LINE)?.[0].match(/'([^']*)'/)?.[1];
console.log(`Built ${count} modules into dist/ (artwork: ${art}${version ? `, version ${version}` : ''})`);
