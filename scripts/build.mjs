// Zero-dependency build: strips TypeScript types with Node's built-in stripper and
// rewrites ".ts" import specifiers to ".js", producing a static site in dist/.
//
// The artwork is not part of this repository (see src/ui/art.ts). By default the built site loads it from the
// artwork site. With --local-art it loads it from ./assets/ (a checkout of the artwork repository) and copies that
// folder into dist/: use it for local development, and for the Claude-hosted copy of the site.
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

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

let count = 0;
for await (const file of walk(srcDir)) {
  if (!file.endsWith('.ts')) continue;
  const source = await readFile(file, 'utf8');
  let js = stripTypeScriptTypes(source, { mode: 'strip' });
  js = js.replace(/(from\s+['"])(\.{1,2}\/[^'"]+)\.ts(['"])/g, '$1$2.js$3');
  js = js.replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+)\.ts(['"]\s*\))/g, '$1$2.js$3');
  if (localArt && relative(srcDir, file) === join('ui', 'art.ts')) {
    if (!ART_LINE.test(js)) throw new Error('src/ui/art.ts has no ART_BASE line for the build to rewrite');
    js = js.replace(ART_LINE, `export const ART_BASE = '${LOCAL_ART_BASE}';`);
  }
  const target = join(outDir, relative(srcDir, file)).replace(/\.ts$/, '.js');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, js);
  count++;
}

await cp(join(root, 'index.html'), join(outDir, 'index.html'));
await cp(join(root, 'styles.css'), join(outDir, 'styles.css'));
if (localArt) await cp(join(root, 'assets'), join(outDir, 'assets'), { recursive: true, filter: (src) => !/[\\/]\.git([\\/]|$)/.test(src) });
const art = (await readFile(join(outDir, 'ui', 'art.js'), 'utf8')).match(ART_LINE)?.[0].match(/'([^']*)'/)?.[1];
console.log(`Built ${count} modules into dist/ (artwork: ${art})`);
