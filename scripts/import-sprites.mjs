// Copies the sprites the app uses out of a checkout of PokéSprite (https://github.com/msikma/pokesprite)
// into assets/sprites/ (the artwork repository, SaveHub-assets, checked out as ./assets/). Run once, then commit and push
// the result in that repository; the site itself needs no network access to PokéSprite.
//
//   git clone --depth 1 https://github.com/msikma/pokesprite /tmp/pokesprite
//   node scripts/import-sprites.mjs /tmp/pokesprite
//
// Pokémon box icons for dex #1-151 -> assets/sprites/pokemon/<dex>.png (68x56)
// Item icons used by Gen 1      -> assets/sprites/items/<category>/<name>.png (32x32)
// Type icons for the 15 Gen 1 types -> assets/sprites/types/<type>.png (128x128, shown small)
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
await rm(join(out, 'pokemon'), { recursive: true, force: true });
await rm(join(out, 'items'), { recursive: true, force: true });
await rm(join(out, 'types'), { recursive: true, force: true });

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

const GEN1_TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon'];
await mkdir(join(out, 'types'), { recursive: true });
let nType = 0;
for (const t of GEN1_TYPES) {
  const from = join(src, 'misc', 'types', 'gen8', `${t}.png`);
  if (existsSync(from)) { await copyFile(from, join(out, 'types', `${t}.png`)); nType++; }
  else missing.push(`type ${t}`);
}

await writeFile(join(out, 'CREDITS.md'), `# Sprite credits

The Pokémon box icons, item icons and type icons in this folder come from **PokéSprite** by msikma
(https://github.com/msikma/pokesprite), copied unchanged except for renaming the Pokémon files to their
National Dex number.

The eight gym badges in \`badges/\` are cut from the Red/Blue "Trainer Card" sheet on The Spriters Resource
(https://www.spriters-resource.com/game_boy_gbc/pokemonredblue/asset/8733/, ripped by FrenchOrange), using the
Super Game Boy colour panel. \`scripts/extract-badges.py\` redoes the cut.

The images are © Nintendo / Creatures Inc. / GAME FREAK Inc. PokéSprite's own code is MIT licensed; the
artwork is not covered by that licence. Remove this folder to take the artwork out. The site still works
without it (icons just don't show).
`);

await import('./measure-icons.mjs'); // re-centre offsets for the icons we just copied
console.log(`Copied ${nMon} Pokémon icons, ${nItem} item icons and ${nType} type icons into assets/sprites/`);
if (missing.length) { console.error('MISSING:', missing.join(', ')); process.exit(1); }
