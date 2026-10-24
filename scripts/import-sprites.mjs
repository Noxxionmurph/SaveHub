// Copies the sprites the app uses out of a checkout of PokéSprite (https://github.com/msikma/pokesprite)
// into assets/sprites/. Run once, then commit the result; the site itself needs no network access to it.
//
//   git clone --depth 1 https://github.com/msikma/pokesprite /tmp/pokesprite
//   node scripts/import-sprites.mjs /tmp/pokesprite
//
// Pokémon box icons for dex #1-151 -> assets/sprites/pokemon/<dex>.png (68x56)
// Item icons used by Gen 1      -> assets/sprites/items/<category>/<name>.png (32x32)
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allItemSpritePaths } from '../src/ui/editors/gen1/itemSprites.ts';

const src = process.argv[2] && resolve(process.argv[2]);
if (!src || !existsSync(join(src, 'data', 'pokemon.json'))) {
  console.error('Usage: node scripts/import-sprites.mjs <path to a PokéSprite checkout>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'sprites');
await rm(out, { recursive: true, force: true });

const missing = [];
const pokemon = JSON.parse(await readFile(join(src, 'data', 'pokemon.json'), 'utf8'));
await mkdir(join(out, 'pokemon'), { recursive: true });
let nMon = 0;
for (let dex = 1; dex <= 151; dex++) {
  const slug = pokemon[String(dex).padStart(3, '0')]?.slug?.eng;
  const from = join(src, 'pokemon-gen7x', 'regular', `${slug}.png`);
  if (slug && existsSync(from)) { await copyFile(from, join(out, 'pokemon', `${dex}.png`)); nMon++; }
  else missing.push(`pokemon #${dex} (${slug})`);
}

let nItem = 0;
for (const p of allItemSpritePaths()) {
  const from = join(src, 'items', `${p}.png`);
  if (!existsSync(from)) { missing.push(`item ${p}`); continue; }
  await mkdir(dirname(join(out, 'items', `${p}.png`)), { recursive: true });
  await copyFile(from, join(out, 'items', `${p}.png`));
  nItem++;
}

await writeFile(join(out, 'CREDITS.md'), `# Sprite credits

The Pokémon box icons and item icons in this folder come from **PokéSprite** by msikma
(https://github.com/msikma/pokesprite), copied unchanged except for renaming the Pokémon files to their
National Dex number.

The images are © Nintendo / Creatures Inc. / GAME FREAK Inc. PokéSprite's own code is MIT licensed; the
artwork is not covered by that licence. Remove this folder to take the artwork out. The site still works
without it (icons just don't show).
`);

console.log(`Copied ${nMon} Pokémon icons and ${nItem} item icons into assets/sprites/`);
if (missing.length) { console.error('MISSING:', missing.join(', ')); process.exit(1); }
