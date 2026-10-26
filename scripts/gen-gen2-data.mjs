// Generates src/core/gen2/tables.ts (species, base stats, moves, items and the TM/HM list for Pokémon Gold and Silver)
// from the pret/pokegold disassembly. Run only when you want to regenerate the tables:
//
//   git clone --depth 1 https://github.com/pret/pokegold /tmp/pokegold
//   node scripts/gen-gen2-data.mjs /tmp/pokegold
//
// The game writes every name in capitals. The editor shows them in mixed case, so names are title-cased here, with
// the Gen 1 spellings reused where the two games share a name and a short table for the words run together.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX_NAMES as GEN1_DEX, MOVE_NAMES as GEN1_MOVES } from '../src/core/gen1/data.ts';

const src = process.argv[2] && resolve(process.argv[2]);
if (!src) { console.error('Usage: node scripts/gen-gen2-data.mjs <path to a pokegold checkout>'); process.exit(1); }
const read = (p) => readFile(join(src, p), 'utf8');
const problems = [];

// ---- types: the byte values the game uses (constants/type_constants.asm) ----
const typeAsm = await read('constants/type_constants.asm');
const TYPE_IDS = {};
{
  let v = 0;
  for (const line of typeAsm.split('\n')) {
    const m = line.match(/^\s*(const_def|const_next|const_skip|const)\s*(\w+)?/);
    if (!m) continue;
    if (m[1] === 'const_def') v = 0;
    else if (m[1] === 'const_next') v = Number(m[2].replace('$', '0x'));
    else if (m[1] === 'const_skip') v += 1;
    else { TYPE_IDS[m[2]] = v; v += 1; }
  }
}
const typeName = (c) => {
  if (c === 'PSYCHIC_TYPE') return 'Psychic';
  if (c === 'CURSE_TYPE') return '???';
  return c[0] + c.slice(1).toLowerCase();
};
if (TYPE_IDS.STEEL !== 9 || TYPE_IDS.FIRE !== 20 || TYPE_IDS.DARK !== 27) problems.push(`type ids moved: ${JSON.stringify(TYPE_IDS)}`);

// ---- names ----
const titleWord = (w) => w.split('-').map((p) => (p ? p[0] + p.slice(1).toLowerCase() : p)).join('-');
const title = (s) => s.split(' ').map(titleWord).join(' ');
const norm = (s) => s.toUpperCase().replace(/É/g, 'E').replace(/[^A-Z0-9♀♂]/g, '');

// ---- species ----
const speciesNames = [...(await read('data/pokemon/names.asm')).matchAll(/dname "([^"]*)"/g)].map((m) => m[1]).slice(0, 251);
const SPECIES_FIX = { 'HO-OH': 'Ho-Oh', PORYGON2: 'Porygon2' };
const species = speciesNames.map((n, i) => {
  if (i < 151) {
    if (norm(n) !== norm(GEN1_DEX[i])) problems.push(`species #${i + 1}: pokegold ${n} vs Gen 1 ${GEN1_DEX[i]}`);
    return GEN1_DEX[i];
  }
  return SPECIES_FIX[n] ?? title(n);
});

// ---- base stats, in the order base_stats.asm includes them ----
const pct = (n) => Math.floor((n * 0xff) / 100);
const GENDER = { GENDER_F0: 0, GENDER_F12_5: pct(12) + 1, GENDER_F25: pct(25), GENDER_F50: pct(50), GENDER_F75: pct(75), GENDER_F100: pct(100) - 1, GENDER_UNKNOWN: 255 };
const GROWTH = ['GROWTH_MEDIUM_FAST', 'GROWTH_SLIGHTLY_FAST', 'GROWTH_SLIGHTLY_SLOW', 'GROWTH_MEDIUM_SLOW', 'GROWTH_FAST', 'GROWTH_SLOW'];
const files = [...(await read('data/pokemon/base_stats.asm')).matchAll(/INCLUDE "([^"]+)"/g)].map((m) => m[1]);
if (files.length !== 251) problems.push(`base_stats.asm includes ${files.length} files`);
const base = [];
for (const [i, f] of files.entries()) {
  const asm = await read(f);
  const stats = asm.match(/^\s*db\s+(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*$/m);
  const types = asm.match(/^\s*db\s+(\w+),\s*(\w+)\s*; type/m);
  const catchRate = asm.match(/^\s*db\s+(\d+)\s*; catch rate/m);
  const gender = asm.match(/^\s*db\s+(\w+)\s*; gender ratio/m);
  const hatch = asm.match(/^\s*db\s+(\d+)\s*; step cycles to hatch/m);
  const growth = asm.match(/^\s*db\s+(\w+)\s*; growth rate/m);
  if (!stats || !types || !catchRate || !gender || !hatch || !growth) { problems.push(`could not read ${f}`); continue; }
  const [hp, atk, def, spe, spa, spd] = stats.slice(1).map(Number);
  if (!(gender[1] in GENDER)) problems.push(`${f}: unknown gender ratio ${gender[1]}`);
  const g = GROWTH.indexOf(growth[1]);
  if (g < 0) problems.push(`${f}: unknown growth rate ${growth[1]}`);
  base.push(`  [${hp}, ${atk}, ${def}, ${spe}, ${spa}, ${spd}, '${typeName(types[1])}', '${typeName(types[2])}', ${GENDER[gender[1]]}, ${g}, ${Number(catchRate[1])}, ${Number(hatch[1])}], // ${i + 1} ${species[i]}`);
}

// ---- moves ----
const moveNames = [...(await read('data/moves/names.asm')).matchAll(/li "([^"]*)"/g)].map((m) => m[1]);
const moveRows = [...(await read('data/moves/moves.asm')).matchAll(/^\s*move\s+(\w+),\s*(\w+),\s*(\d+),\s*(\w+),\s*(\d+),\s*(\d+),\s*(\d+)\s*$/gm)];
if (moveRows.length !== 251 || moveNames.length !== 251) problems.push(`pokegold has ${moveRows.length} moves and ${moveNames.length} move names`);
// Words the game runs together, spelled the way the Gen 1 names already are (DoubleSlap, ThunderPunch, ...).
const MOVE_FIX = {
  CONVERSION2: 'Conversion 2', DYNAMICPUNCH: 'DynamicPunch', DRAGONBREATH: 'DragonBreath', EXTREMESPEED: 'ExtremeSpeed',
  ANCIENTPOWER: 'AncientPower', 'LOCK-ON': 'Lock-On', 'MUD-SLAP': 'Mud-Slap',
};
const moves = moveRows.map((m, i) => {
  const n = moveNames[i];
  let name;
  if (i < 165) {
    if (norm(n) !== norm(GEN1_MOVES[i + 1])) problems.push(`move #${i + 1}: pokegold ${n} vs Gen 1 ${GEN1_MOVES[i + 1]}`);
    name = GEN1_MOVES[i + 1];
  } else name = MOVE_FIX[n] ?? title(n);
  return `  [${JSON.stringify(name)}, '${typeName(m[4])}', ${m[3]}, ${pct(Number(m[5]))}, ${m[6]}], // ${i + 1}`;
});

// ---- items ----
const itemNames = [...(await read('data/items/names.asm')).matchAll(/li "([^"]*)"/g)].map((m) => m[1]);
const attrs = [...(await read('data/items/attributes.asm')).matchAll(/^\s*item_attribute\s+[^,]+,\s*(\w+),\s*[^,]+,\s*([^,]+?),\s*(\w+),/gm)];
const itemConsts = [...(await read('constants/item_constants.asm')).matchAll(/^\s*(?:const|add_tm|add_hm)\s+(\w+)/gm)].map((m) => m[1]).filter((c) => c !== 'TM_' && c !== 'HM_').slice(1);
const ITEM_FIX = {
  '# BALL': 'Poké Ball', '# DOLL': 'Poké Doll', BRIGHTPOWDER: 'BrightPowder', THUNDERSTONE: 'Thunderstone', 'EXP.SHARE': 'Exp. Share',
  SECRETPOTION: 'SecretPotion', 'S.S.TICKET': 'S.S. Ticket', 'MOOMOO MILK': 'MooMoo Milk', PSNCUREBERRY: 'PSNCureBerry',
  PRZCUREBERRY: 'PRZCureBerry', "KING'S ROCK": "King's Rock", TINYMUSHROOM: 'TinyMushroom', SILVERPOWDER: 'SilverPowder',
  'BLU APRICORN': 'Blu Apricorn', TWISTEDSPOON: 'TwistedSpoon', BLACKBELT: 'BlackBelt', BLACKGLASSES: 'BlackGlasses',
  SLOWPOKETAIL: 'SlowpokeTail', NEVERMELTICE: 'NeverMeltIce', MIRACLEBERRY: 'MiracleBerry', RAGECANDYBAR: 'RageCandyBar',
  ENERGYPOWDER: 'EnergyPowder', MYSTERYBERRY: 'MysteryBerry', 'UP-GRADE': 'Up-Grade', SQUIRTBOTTLE: 'SquirtBottle',
  LITEBLUEMAIL: 'LiteBlueMail', PORTRAITMAIL: 'PortraitMail', 'BLUESKY MAIL': 'BlueSky Mail', 'POLKADOT BOW': 'Polkadot Bow',
  'GUARD SPEC.': 'Guard Spec.', 'HP UP': 'HP Up', 'PP UP': 'PP Up', 'X ACCURACY': 'X Accuracy', 'X ATTACK': 'X Attack',
  'X DEFEND': 'X Defend', 'X SPEED': 'X Speed', 'X SPECIAL': 'X Special',
};
const POCKET = { ITEM: 'item', KEY_ITEM: 'key', BALL: 'ball', TM_HM: 'tmhm' };
const items = [];
for (let id = 1; id < itemNames.length && id <= 0xff; id++) {
  const n = itemNames[id - 1];
  const a = attrs[id - 1];
  if (!a) { problems.push(`item ${id}: no attributes`); continue; }
  if (n === '?' || id > itemConsts.length) continue;
  const dummy = n === 'TERU-SAMA';
  const name = /^(TM|HM)\d\d$/.test(n) ? n : ITEM_FIX[n] ?? title(n);
  if (!dummy && !(a[3] in POCKET)) problems.push(`item ${n}: unknown pocket ${a[3]}`);
  items.push(`  [0x${id.toString(16).padStart(2, '0')}, ${JSON.stringify(dummy ? '' : name)}, '${dummy ? '' : POCKET[a[3]]}'], // ${itemConsts[id - 1]}`);
}
// ---- TMs and HMs: the move each one teaches ----
const itemConstAsm = await read('constants/item_constants.asm');
const tmMoves = [...itemConstAsm.matchAll(/add_tm\s+(\w+)/g)].map((m) => m[1]);
const hmMoves = [...itemConstAsm.matchAll(/add_hm\s+(\w+)/g)].map((m) => m[1]);
const moveConsts = moveRows.map((m) => m[1]);
const tmhm = [...tmMoves, ...hmMoves].map((c) => {
  const id = moveConsts.indexOf(c) + 1;
  if (!id) problems.push(`TM/HM move ${c} not found`);
  return id;
});
if (tmMoves.length !== 50 || hmMoves.length !== 7) problems.push(`${tmMoves.length} TMs and ${hmMoves.length} HMs`);

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const out = `// Pokémon Gold and Silver data tables, by the ids the save uses.
// Generated by scripts/gen-gen2-data.mjs from the pret/pokegold disassembly. Do not edit by hand.

/** National Dex 1-251. Gen 2 stores the dex number itself as the species, so index + 1 is the species byte. */
export const SPECIES_NAMES: readonly string[] = ${JSON.stringify(species)};

/**
 * Per species, by dex number - 1: base HP, Attack, Defense, Speed, Special Attack, Special Defense, the two types,
 * the gender ratio byte (0 = always male, 254 = always female, 255 = genderless; otherwise a Pokémon is female when
 * its Attack and Speed DVs together, as one byte, are at or below it), the growth rate (an index into GROWTH_RATES),
 * the catch rate and the egg cycles to hatch.
 */
export const BASE_TABLE: readonly [hp: number, atk: number, def: number, spe: number, spa: number, spd: number, type1: string, type2: string, gender: number, growth: number, catchRate: number, eggCycles: number][] = [
${base.join('\n')}
];

/** Per move, by move id - 1: name, type, power, accuracy (0-255, as the game stores it), base PP. */
export const MOVE_TABLE: readonly [name: string, type: string, power: number, accuracy: number, pp: number][] = [
${moves.join('\n')}
];

/**
 * Every item id the game's tables have: id, name and pocket ('item', 'key', 'ball' or 'tmhm'). An empty name is one of
 * the game's unused placeholder entries.
 */
export const ITEM_TABLE: readonly [id: number, name: string, pocket: '' | 'item' | 'key' | 'ball' | 'tmhm'][] = [
${items.join('\n')}
];

/** The move each TM (01-50) and then each HM (01-07) teaches. */
export const TMHM_MOVES: readonly number[] = ${JSON.stringify(tmhm)};
`;
await writeFile(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core', 'gen2', 'tables.ts'), out);
console.log(`Wrote ${species.length} species, ${moves.length} moves, ${items.length} items and ${tmhm.length} TMs/HMs to src/core/gen2/tables.ts`);
