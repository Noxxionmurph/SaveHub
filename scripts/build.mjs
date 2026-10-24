// Zero-dependency build: strips TypeScript types with Node's built-in stripper and
// rewrites ".ts" import specifiers to ".js", producing a static site in dist/.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const outDir = join(root, 'dist');

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
  const target = join(outDir, relative(srcDir, file)).replace(/\.ts$/, '.js');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, js);
  count++;
}

await cp(join(root, 'index.html'), join(outDir, 'index.html'));
await cp(join(root, 'styles.css'), join(outDir, 'styles.css'));
await cp(join(root, 'assets'), join(outDir, 'assets'), { recursive: true });
console.log(`Built ${count} modules into dist/`);
