// Copies the sprites the app uses out of a checkout of PokéSprite (https://github.com/msikma/pokesprite)
// into assets/sprites/ (the artwork repository, SaveHub-assets, checked out as ./assets/). Run once, then commit and push
// the result in that repository; the site itself needs no network access to PokéSprite.
//
//   git clone --depth 1 https://github.com/msikma/pokesprite /tmp/pokesprite
//   node scripts/import-sprites.mjs /tmp/pokesprite
//
// Pokémon box icons for dex #1-386 -> assets/sprites/pokemon/<dex>.png (68x56)
// Unown's other 27 forms          -> assets/sprites/pokemon/201-<letter>.png (A is 201.png; ! and ? are
//                                    201-exclamation.png and 201-question.png)
// The shiny versions of both      -> assets/sprites/pokemon/shiny/<dex>.png, shiny/201-<letter>.png
// An egg                          -> assets/sprites/pokemon/egg.png
// Item icons used by Gen 1, 2 and 3 -> assets/sprites/items/<category>/<name>.png (32x32)
// Type icons for the 17 Gen 2 types -> assets/sprites/types/<type>.png (128x128, shown small)
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allItemSpritePaths as gen1Items } from '../src/ui/editors/gen1/itemSprites.ts';
import { allItemSpritePaths as gen2Items } from '../src/ui/editors/gen2/itemSprites.ts';
import { allItemSpritePaths as gen3Items } from '../src/ui/editors/gen3/itemSprites.ts';

const src = process.argv[2] && resolve(process.argv[2]);
if (!src || !existsSync(join(src, 'data', 'pokemon.json'))) {
  console.error('Usage: node scripts/import-sprites.mjs <path to a PokéSprite checkout>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'sprites');
await rm(join(out, 'pokemon'), { recursive: true, force: true });
await rm(join(out, 'items'), { recursive: true, force: true });

const missing = [];
const pokemon = JSON.parse(await readFile(join(src, 'data', 'pokemon.json'), 'utf8'));
await mkdir(join(out, 'pokemon', 'shiny'), { recursive: true });
let nMon = 0;
for (let dex = 1; dex <= 386; dex++) {
  const slug = pokemon[String(dex).padStart(3, '0')]?.slug?.eng;
  const from = join(src, 'pokemon-gen7x', 'regular', `${slug}.png`);
  if (slug && existsSync(from)) { await copyFile(from, join(out, 'pokemon', `${dex}.png`)); nMon++; }
  else missing.push(`pokemon #${dex} (${slug})`);
  const shiny = join(src, 'pokemon-gen7x', 'shiny', `${slug}.png`);
  if (slug && existsSync(shiny)) { await copyFile(shiny, join(out, 'pokemon', 'shiny', `${dex}.png`)); nMon++; }
  else missing.push(`shiny pokemon #${dex} (${slug})`);
}
{
  // An egg, in the same box-icon size.
  const from = join(src, 'pokemon-gen7x', 'egg.png');
  if (existsSync(from)) { await copyFile(from, join(out, 'pokemon', 'egg.png')); nMon++; }
  else missing.push('egg');
}
// Unown B to Z, and the ! and ? that Ruby and Sapphire added.
for (const letter of [...'bcdefghijklmnopqrstuvwxyz', 'exclamation', 'question']) {
  const from = join(src, 'pokemon-gen7x', 'regular', `unown-${letter}.png`);
  if (existsSync(from)) { await copyFile(from, join(out, 'pokemon', `201-${letter}.png`)); nMon++; }
  else missing.push(`unown ${letter}`);
  const shiny = join(src, 'pokemon-gen7x', 'shiny', `unown-${letter}.png`);
  if (existsSync(shiny)) { await copyFile(shiny, join(out, 'pokemon', 'shiny', `201-${letter}.png`)); nMon++; }
  else missing.push(`shiny unown ${letter}`);
}

let nItem = 0;
for (const p of new Set([...gen1Items(), ...gen2Items(), ...gen3Items()])) {
  const from = join(src, 'items', `${p}.png`);
  if (!existsSync(from)) { missing.push(`item ${p}`); continue; }
  await mkdir(dirname(join(out, 'items', `${p}.png`)), { recursive: true });
  await copyFile(from, join(out, 'items', `${p}.png`));
  nItem++;
}

// (types/unknown.png, the ??? type, is drawn by the artwork repository's scripts/make-unknown-type.py, so the
// folder isn't emptied first.)
const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'];
await mkdir(join(out, 'types'), { recursive: true });
let nType = 0;
for (const t of TYPES) {
  const from = join(src, 'misc', 'types', 'gen8', `${t}.png`);
  if (existsSync(from)) { await copyFile(from, join(out, 'types', `${t}.png`)); nType++; }
  else missing.push(`type ${t}`);
}

// Who made each picture is in the artwork repository's CREDITS.md; update it there when adding a new source.
await import('./measure-icons.mjs'); // re-centre offsets for the icons we just copied
console.log(`Copied ${nMon} Pokémon icons, ${nItem} item icons and ${nType} type icons into assets/sprites/`);
if (missing.length) { console.error('MISSING:', missing.join(', ')); process.exit(1); }
