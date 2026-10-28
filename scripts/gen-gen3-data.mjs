// Generates src/core/gen3/tables.ts (species, base stats, abilities, natures, moves, items, TMs/HMs and place names for
// Pokémon Ruby, Sapphire and Emerald) from the pret disassemblies. Run only when you want to regenerate the tables:
//
//   git clone --depth 1 https://github.com/pret/pokeemerald /tmp/pokeemerald
//   git clone --depth 1 https://github.com/pret/pokeruby /tmp/pokeruby
//   node scripts/gen-gen3-data.mjs /tmp/pokeemerald /tmp/pokeruby
//
// Emerald's tables are a superset of Ruby and Sapphire's (same ids, same stats); pokeruby is read only to know which
// items Ruby and Sapphire have. Names are title-cased the same way as Gen 2's, reusing the Gen 2 spellings where the
// games share a name.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX_NAMES as GEN2_DEX, MOVE_NAMES as GEN2_MOVES, itemChoices } from '../src/core/gen2/data.ts';

const em = process.argv[2] && resolve(process.argv[2]);
const ru = process.argv[3] && resolve(process.argv[3]);
if (!em || !ru) { console.error('Usage: node scripts/gen-gen3-data.mjs <pokeemerald checkout> <pokeruby checkout>'); process.exit(1); }
const read = (root, p) => readFile(join(root, p), 'utf8');
const problems = [];

const titleWord = (w) => w.split('-').map((p) => (p ? p[0] + p.slice(1).toLowerCase() : p)).join('-');
const title = (s) => s.split(' ').map(titleWord).join(' ').replace(/Poké/g, 'Poké').replace(/PokéMon/gi, 'Pokémon');
const norm = (s) => s.toUpperCase().replace(/É/g, 'E').replace(/[^A-Z0-9♀♂]/g, '');
const cName = (s) => s.replace(/POKé/g, 'POKÉ');

// ---- species: internal ids, National Dex numbers, names ----
const speciesH = await read(em, 'include/constants/species.h');
const SPECIES_ID = Object.fromEntries([...speciesH.matchAll(/#define SPECIES_(\w+) (\d+)/g)].map((m) => [m[1], Number(m[2])]));
const dexH = await read(em, 'include/constants/pokedex.h');
const dexEnum = dexH.slice(dexH.indexOf('NATIONAL_DEX_NONE')).split('};')[0];
const DEX_NO = {};
[...dexEnum.matchAll(/NATIONAL_DEX_(\w+)/g)].forEach((m, i) => { DEX_NO[m[1]] ??= i; });
const NUM_SPECIES = SPECIES_ID.EGG;
const internalToDex = new Array(NUM_SPECIES).fill(0);
for (const [name, id] of Object.entries(SPECIES_ID)) {
  if (id >= 1 && id < NUM_SPECIES && DEX_NO[name] >= 1 && DEX_NO[name] <= 386) internalToDex[id] = DEX_NO[name];
}
const dexToInternal = new Array(387).fill(0);
internalToDex.forEach((dex, id) => { if (dex) dexToInternal[dex] = id; });
if (dexToInternal.slice(1).some((v) => !v)) problems.push('some National Dex numbers have no species');

const namesH = await read(em, 'src/data/text/species_names.h');
const rawName = Object.fromEntries([...namesH.matchAll(/\[SPECIES_(\w+)\] = _\("([^"]*)"\)/g)].map((m) => [m[1], m[2]]));
const constByInternal = Object.fromEntries(Object.entries(SPECIES_ID).map(([k, v]) => [v, k]));
const species = [];
for (let dex = 1; dex <= 386; dex++) {
  const c = constByInternal[dexToInternal[dex]];
  const n = rawName[c];
  if (dex <= 251) {
    if (norm(n) !== norm(GEN2_DEX[dex - 1])) problems.push(`species #${dex}: ${n} vs Gen 2 ${GEN2_DEX[dex - 1]}`);
    species.push(GEN2_DEX[dex - 1]);
  } else species.push(title(n));
}

// ---- base stats ----
const TYPES = {
  NORMAL: 'Normal', FIGHTING: 'Fighting', FLYING: 'Flying', POISON: 'Poison', GROUND: 'Ground', ROCK: 'Rock', BUG: 'Bug',
  GHOST: 'Ghost', STEEL: 'Steel', MYSTERY: '???', FIRE: 'Fire', WATER: 'Water', GRASS: 'Grass', ELECTRIC: 'Electric',
  PSYCHIC: 'Psychic', ICE: 'Ice', DRAGON: 'Dragon', DARK: 'Dark',
};
const GROWTH = ['MEDIUM_FAST', 'ERRATIC', 'FLUCTUATING', 'MEDIUM_SLOW', 'FAST', 'SLOW'];
const abilitiesH = await read(em, 'include/constants/abilities.h');
const ABILITY_ID = Object.fromEntries([...abilitiesH.matchAll(/#define ABILITY_(\w+) (\d+)/g)].map((m) => [m[1], Number(m[2])]));
const infoH = await read(em, 'src/data/pokemon/species_info.h');
/** The text after each \`[PREFIX_NAME] =\` up to the next one, by NAME. */
const chunks = (text, prefix) => {
  const parts = text.split(new RegExp(`^\\s*\\[${prefix}_(\\w+)\\] =`, 'm'));
  const out = {};
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = parts[i + 1];
  return out;
};
const blocks = chunks(infoH, 'SPECIES');
// PERCENT_FEMALE(n) is min(254, n * 255 / 100), worked out in floating point and stored in a byte (so rounded down).
const genderByte = (g) => {
  if (g === 'MON_MALE') return 0;
  if (g === 'MON_FEMALE') return 254;
  if (g === 'MON_GENDERLESS') return 255;
  const m = g.match(/PERCENT_FEMALE\(([\d.]+)\)/);
  return m ? Math.min(254, Math.floor((Number(m[1]) * 255) / 100)) : NaN;
};
const base = [];
for (let dex = 1; dex <= 386; dex++) {
  const c = constByInternal[dexToInternal[dex]];
  const b = blocks[c];
  if (!b) { problems.push(`no species info for ${c}`); continue; }
  const f = (k) => b.match(new RegExp(`\\.${k}\\s*=\\s*([^,\\n]+(?:\\([^)]*\\))?)`))?.[1]?.trim();
  const [hp, atk, def, spe, spa, spd] = ['baseHP', 'baseAttack', 'baseDefense', 'baseSpeed', 'baseSpAttack', 'baseSpDefense'].map((k) => Number(f(k)));
  const types = b.match(/\.types = \{\s*TYPE_(\w+),\s*TYPE_(\w+)\s*\}/);
  const abil = b.match(/\.abilities = \{\s*ABILITY_(\w+),\s*ABILITY_(\w+)\s*\}/);
  const gr = b.match(/\.genderRatio = ([^,\n]+)/); if (!gr) { problems.push(`gender ${c}: ${b.slice(0, 200)}`); continue; }
  const gender = genderByte(gr[1].trim());
  const growth = GROWTH.indexOf(f('growthRate').replace('GROWTH_', ''));
  const eggCycles = Number(f('eggCycles'));
  const friendship = f('friendship') === 'STANDARD_FRIENDSHIP' ? 70 : Number(f('friendship'));
  if ([hp, atk, def, spe, spa, spd, gender, eggCycles, friendship].some(Number.isNaN) || growth < 0 || !types || !abil) {
    problems.push(`could not read ${c}`); continue;
  }
  base.push(`  [${hp}, ${atk}, ${def}, ${spe}, ${spa}, ${spd}, '${TYPES[types[1]]}', '${TYPES[types[2]]}', ${gender}, ${growth}, ${eggCycles}, ${ABILITY_ID[abil[1]]}, ${ABILITY_ID[abil[2]]}, ${friendship}], // ${dex} ${species[dex - 1]}`);
}

// ---- abilities and natures ----
const abilityText = await read(em, 'src/data/text/abilities.h');
const ABILITY_FIX = { 'LIGHTNINGROD': 'Lightningrod', 'COMPOUNDEYES': 'Compoundeyes' };
const abilityNames = [];
for (const m of abilityText.slice(abilityText.indexOf('gAbilityNames')).matchAll(/\[ABILITY_(\w+)\] = _\("([^"]*)"\)/g)) {
  abilityNames[ABILITY_ID[m[1]]] = m[1] === 'NONE' ? '—' : ABILITY_FIX[m[2]] ?? title(m[2]);
}
if (abilityNames.length !== 78) problems.push(`${abilityNames.length} abilities`);
const natureText = await read(em, 'src/data/text/nature_names.h');
const natures = [...natureText.matchAll(/NatureName\[\] = _\("(\w+)"\)/g)].map((m) => title(m[1]));
if (natures.length !== 25) problems.push(`${natures.length} natures`);

// ---- moves ----
const movesH = await read(em, 'include/constants/moves.h');
const MOVE_ID = Object.fromEntries([...movesH.matchAll(/#define MOVE_(\w+) (\d+)/g)].map((m) => [m[1], Number(m[2])]));
const moveNamesH = await read(em, 'src/data/text/move_names.h');
const moveRaw = Object.fromEntries([...moveNamesH.matchAll(/\[MOVE_(\w+)\] = _\("([^"]*)"\)/g)].map((m) => [MOVE_ID[m[1]], m[2]]));
const battleMoves = await read(em, 'src/data/battle_moves.h');
const moveBlocks = Object.fromEntries(Object.entries(chunks(battleMoves, 'MOVE')).map(([k, v]) => [MOVE_ID[k], v]));
// Words the game runs together, spelled the way the Gen 2 names already are (DoubleSlap, ThunderPunch, ...).
const MOVE_FIX = {
  SMELLINGSALT: 'SmellingSalt', FEATHERDANCE: 'FeatherDance', GRASSWHISTLE: 'GrassWhistle', 'SAND TOMB': 'Sand Tomb',
  'FAKE TEARS': 'Fake Tears', 'POISON FANG': 'Poison Fang', 'CRUSH CLAW': 'Crush Claw', 'WATER SPOUT': 'Water Spout',
  'SIGNAL BEAM': 'Signal Beam', 'SHADOW PUNCH': 'Shadow Punch', 'EXTRASENSORY': 'Extrasensory', 'SKY UPPERCUT': 'Sky Uppercut',
  'ICICLE SPEAR': 'Icicle Spear', 'BLAZE KICK': 'Blaze Kick', 'POISON TAIL': 'Poison Tail', 'VOLT TACKLE': 'Volt Tackle',
  'MAGICAL LEAF': 'Magical Leaf', 'LEAF BLADE': 'Leaf Blade', 'DRAGON DANCE': 'Dragon Dance', 'ROCK BLAST': 'Rock Blast',
  'SHOCK WAVE': 'Shock Wave', 'WATER PULSE': 'Water Pulse', 'DOOM DESIRE': 'Doom Desire', 'PSYCHO BOOST': 'Psycho Boost',
};
const moves = [];
for (let id = 1; id < 355; id++) {
  const n = moveRaw[id];
  const b = moveBlocks[id];
  if (!n || !b) { problems.push(`move ${id} missing`); continue; }
  let name;
  if (id <= 251) {
    if (norm(n) !== norm(GEN2_MOVES[id])) problems.push(`move #${id}: ${n} vs Gen 2 ${GEN2_MOVES[id]}`);
    name = GEN2_MOVES[id];
  } else name = MOVE_FIX[n] ?? title(n);
  const g = (k) => b.match(new RegExp(`\\.${k} = (\\w+)`))?.[1];
  moves.push(`  [${JSON.stringify(name)}, '${TYPES[g('type').replace('TYPE_', '')]}', ${Number(g('power'))}, ${Number(g('accuracy'))}, ${Number(g('pp'))}], // ${id}`);
}

// ---- items ----
const itemsConst = await read(em, 'include/constants/items.h');
const itemEnum = itemsConst.slice(itemsConst.indexOf('enum {'), itemsConst.indexOf('ITEMS_COUNT'));
const itemConsts = [...itemEnum.replace(/\/\/.*$/gm, '').matchAll(/\b(ITEM_\w+)\s*,/g)].map((m) => m[1]);
const itemsH = await read(em, 'src/data/items.h');
// Keyed by each entry's .itemId (the TMs are listed under aliases named after their moves).
const itemBlocks = Object.fromEntries(Object.values(chunks(itemsH, 'ITEM')).map((v) => [v.match(/\.itemId = (ITEM_\w+)/)?.[1], v]));
const rubyItems = [...(await read(ru, 'src/data/items_en.h')).matchAll(/\.name = _\("([^"]*)"\)/g)].map((m) => m[1]);
// Gen 2's spellings (BlackGlasses, TwistedSpoon, ...) by their run-together game names, and the new ones.
const GEN2_ITEM = new Map(itemChoices(['item', 'ball', 'key', 'tmhm']).map((c) => [norm(c.name), c.name]));
const ITEM_FIX = {
  'POKé BALL': 'Poké Ball', 'POKé DOLL': 'Poké Doll', 'DEVON GOODS': 'Devon Goods', 'SOOT SACK': 'Soot Sack', 'BASEMENT KEY': 'Basement Key',
  'ACRO BIKE': 'Acro Bike', 'POKéBLOCK CASE': 'Pokéblock Case', 'DEVON SCOPE': 'Devon Scope', 'METEORITE': 'Meteorite',
  'RM. 1 KEY': 'Rm. 1 Key', 'RM. 2 KEY': 'Rm. 2 Key', 'RM. 4 KEY': 'Rm. 4 Key', 'RM. 6 KEY': 'Rm. 6 Key', 'STORAGE KEY': 'Storage Key',
  'ROOT FOSSIL': 'Root Fossil', 'CLAW FOSSIL': 'Claw Fossil', 'S.S. TICKET': 'S.S. Ticket', 'EON TICKET': 'Eon Ticket',
  'WAILMER PAIL': 'Wailmer Pail', 'POKéNAV': 'PokéNav', 'SCANNER': 'Scanner', 'GO-GOGGLES': 'Go-Goggles', 'LETTER': 'Letter',
  'MACH BIKE': 'Mach Bike', 'COIN CASE': 'Coin Case', 'ITEMFINDER': 'Itemfinder', 'OLD ROD': 'Old Rod', 'GOOD ROD': 'Good Rod',
  'SUPER ROD': 'Super Rod', 'CONTEST PASS': 'Contest Pass', 'MAGMA EMBLEM': 'Magma Emblem', 'OLD SEA MAP': 'Old Sea Map',
  'RED ORB': 'Red Orb', 'BLUE ORB': 'Blue Orb', 'FULL HEAL': 'Full Heal', 'X DEFEND': 'X Defend', 'X SPECIAL': 'X Special',
  ENERGYPOWDER: 'EnergyPowder', 'ENERGY ROOT': 'Energy Root', 'HEAL POWDER': 'Heal Powder', 'REVIVAL HERB': 'Revival Herb',
  'SODA POP': 'Soda Pop', LEMONADE: 'Lemonade', 'MOOMOO MILK': 'MooMoo Milk', 'LAVA COOKIE': 'Lava Cookie', 'BERRY JUICE': 'Berry Juice',
  'SACRED ASH': 'Sacred Ash', 'HP UP': 'HP Up', 'PP UP': 'PP Up', 'PP MAX': 'PP Max', 'GUARD SPEC.': 'Guard Spec.', 'DIRE HIT': 'Dire Hit',
  'X ATTACK': 'X Attack', 'X SPEED': 'X Speed', 'X ACCURACY': 'X Accuracy', 'POKé FLUTE': 'Poké Flute', 'BLUE FLUTE': 'Blue Flute',
  'YELLOW FLUTE': 'Yellow Flute', 'RED FLUTE': 'Red Flute', 'BLACK FLUTE': 'Black Flute', 'WHITE FLUTE': 'White Flute',
  'SHOAL SALT': 'Shoal Salt', 'SHOAL SHELL': 'Shoal Shell', 'RED SHARD': 'Red Shard', 'BLUE SHARD': 'Blue Shard',
  'YELLOW SHARD': 'Yellow Shard', 'GREEN SHARD': 'Green Shard', 'SUPER REPEL': 'Super Repel', 'MAX REPEL': 'Max Repel',
  'ESCAPE ROPE': 'Escape Rope', 'SUN STONE': 'Sun Stone', 'MOON STONE': 'Moon Stone', 'FIRE STONE': 'Fire Stone',
  THUNDERSTONE: 'Thunderstone', 'WATER STONE': 'Water Stone', 'LEAF STONE': 'Leaf Stone', TINYMUSHROOM: 'TinyMushroom',
  'BIG MUSHROOM': 'Big Mushroom', 'BIG PEARL': 'Big Pearl', 'STAR PIECE': 'Star Piece', 'HEART SCALE': 'Heart Scale',
  'ORANGE MAIL': 'Orange Mail', 'HARBOR MAIL': 'Harbor Mail', 'GLITTER MAIL': 'Glitter Mail', 'MECH MAIL': 'Mech Mail',
  'WOOD MAIL': 'Wood Mail', 'WAVE MAIL': 'Wave Mail', 'BEAD MAIL': 'Bead Mail', 'SHADOW MAIL': 'Shadow Mail',
  'TROPIC MAIL': 'Tropic Mail', 'DREAM MAIL': 'Dream Mail', 'FAB MAIL': 'Fab Mail', 'RETRO MAIL': 'Retro Mail',
  'WHITE HERB': 'White Herb', 'MACHO BRACE': 'Macho Brace', 'EXP. SHARE': 'Exp. Share', 'QUICK CLAW': 'Quick Claw',
  'SOOTHE BELL': 'Soothe Bell', 'MENTAL HERB': 'Mental Herb', 'CHOICE BAND': 'Choice Band', "KING'S ROCK": "King's Rock",
  SILVERPOWDER: 'SilverPowder', 'AMULET COIN': 'Amulet Coin', 'CLEANSE TAG': 'Cleanse Tag', 'SOUL DEW': 'Soul Dew',
  'DEEPSEATOOTH': 'DeepSeaTooth', 'DEEPSEASCALE': 'DeepSeaScale', 'SMOKE BALL': 'Smoke Ball', 'EVERSTONE': 'Everstone',
  'FOCUS BAND': 'Focus Band', 'LUCKY EGG': 'Lucky Egg', 'SCOPE LENS': 'Scope Lens', 'METAL COAT': 'Metal Coat',
  LEFTOVERS: 'Leftovers', 'DRAGON SCALE': 'Dragon Scale', 'LIGHT BALL': 'Light Ball', 'SOFT SAND': 'Soft Sand',
  'HARD STONE': 'Hard Stone', 'MIRACLE SEED': 'Miracle Seed', BLACKGLASSES: 'BlackGlasses', 'BLACK BELT': 'Black Belt',
  MAGNET: 'Magnet', 'MYSTIC WATER': 'Mystic Water', 'SHARP BEAK': 'Sharp Beak', 'POISON BARB': 'Poison Barb',
  'NEVERMELTICE': 'NeverMeltIce', 'SPELL TAG': 'Spell Tag', TWISTEDSPOON: 'TwistedSpoon', CHARCOAL: 'Charcoal',
  'DRAGON FANG': 'Dragon Fang', 'SILK SCARF': 'Silk Scarf', 'UP-GRADE': 'Up-Grade', 'SHELL BELL': 'Shell Bell',
  'SEA INCENSE': 'Sea Incense', 'LAX INCENSE': 'Lax Incense', 'LUCKY PUNCH': 'Lucky Punch', 'METAL POWDER': 'Metal Powder',
  'THICK CLUB': 'Thick Club', STICK: 'Stick', 'RED SCARF': 'Red Scarf', 'BLUE SCARF': 'Blue Scarf', 'PINK SCARF': 'Pink Scarf',
  'GREEN SCARF': 'Green Scarf', 'YELLOW SCARF': 'Yellow Scarf', 'BRIGHTPOWDER': 'BrightPowder', 'ENIGMA BERRY': 'Enigma Berry',
  'TM CASE': 'TM Case', 'BERRY POUCH': 'Berry Pouch', 'TEACHY TV': 'Teachy TV', 'TRI-PASS': 'Tri-Pass', 'RAINBOW PASS': 'Rainbow Pass',
  "OAK'S PARCEL": "Oak's Parcel", 'SECRET KEY': 'Secret Key', 'BIKE VOUCHER': 'Bike Voucher', 'GOLD TEETH': 'Gold Teeth',
  'OLD AMBER': 'Old Amber', 'CARD KEY': 'Card Key', 'LIFT KEY': 'Lift Key', 'HELIX FOSSIL': 'Helix Fossil', 'DOME FOSSIL': 'Dome Fossil',
  'SILPH SCOPE': 'Silph Scope', 'TOWN MAP': 'Town Map', 'VS SEEKER': 'VS Seeker', 'FAME CHECKER': 'Fame Checker',
  '{POKEBLOCK} CASE': 'Pokéblock Case', 'MYSTICTICKET': 'MysticTicket', 'AURORATICKET': 'AuroraTicket', 'POWDER JAR': 'Powder Jar',
};
const POCKET = { POCKET_ITEMS: 'item', POCKET_POKE_BALLS: 'ball', POCKET_TM_HM: 'tmhm', POCKET_BERRIES: 'berry', POCKET_KEY_ITEMS: 'key' };
const items = [];
for (let id = 1; id < itemConsts.length; id++) {
  const c = itemConsts[id];
  const b = itemBlocks[c];
  if (/^ITEM_([0-9A-F]{3}|UNUSED_BERRY_\d)$/.test(c)) continue; // the game's unused placeholder ids
  if (!b) { problems.push(`no item data for ${c}`); continue; }
  const nm = b.match(/\.name = _\("([^"]*)"\)/);
  if (!nm) { problems.push(`item name ${c}: ${b.slice(0, 120)}`); continue; }
  const raw = nm[1];
  const pocket = POCKET[b.match(/\.pocket = (\w+)/)[1]];
  if (raw === '????????') continue; // the game's unused placeholder ids
  if (!pocket) problems.push(`item ${c}: unknown pocket`);
  const rs = id < rubyItems.length && rubyItems[id] !== '????????';
  if (rs && norm(rubyItems[id]) !== norm(raw)) problems.push(`item ${id}: Ruby ${rubyItems[id]} vs Emerald ${raw}`);
  let name;
  if (/^(TM|HM)\d\d$/.test(raw)) name = raw;
  else if (/ BERRY$/.test(raw)) name = title(raw);
  else name = ITEM_FIX[raw] ?? GEN2_ITEM.get(norm(raw)) ?? title(raw);
  items.push(`  [${id}, ${JSON.stringify(name)}, '${pocket}', ${rs}], // ${c}`);
}

// ---- TMs and HMs ----
const tmsH = await read(em, 'include/constants/tms_hms.h');
const tmNames = [...tmsH.slice(tmsH.indexOf('FOREACH_TM(F)'), tmsH.indexOf('FOREACH_HM(F)')).matchAll(/F\((\w+)\)/g)].map((m) => m[1]);
const hmNames = [...tmsH.slice(tmsH.indexOf('FOREACH_HM(F)'), tmsH.indexOf('FOREACH_TMHM')).matchAll(/F\((\w+)\)/g)].map((m) => m[1]);
if (tmNames.length !== 50 || hmNames.length !== 8) problems.push(`${tmNames.length} TMs and ${hmNames.length} HMs`);
const tmhm = [...tmNames, ...hmNames].map((n) => MOVE_ID[n] ?? (problems.push(`TM move ${n}`), 0));

// ---- place names (map sections), for where a Pokémon was met ----
const sections = JSON.parse(await read(em, 'src/data/region_map/region_map_sections.json')).map_sections;
const PLACE_FIX = { 'CAVE OF ORIGIN': 'Cave of Origin', 'INSIDE OF TRUCK': 'Inside of Truck', '{AQUA} HIDEOUT': 'Aqua Hideout', 'S.S. ANNE': 'S.S. Anne', "DIGLETT'S CAVE": "Diglett's Cave", 'MT. CHIMNEY': 'Mt. Chimney', 'MT. PYRE': 'Mt. Pyre', 'MT. MOON': 'Mt. Moon', 'MT. EMBER': 'Mt. Ember', 'SILPH CO.': 'Silph Co.' };
const places = sections.map((s) => (s.name ? PLACE_FIX[s.name] ?? title(cName(s.name)).replace(/Poké/g, 'Poké') : ''));
// Ruby and Sapphire stop at the Hoenn places (the last one, 0x57, is the game's "wherever the player is").
const rsPlaces = sections.findIndex((s) => s.id === 'MAPSEC_DYNAMIC');

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const out = `// Pokémon Ruby, Sapphire and Emerald data tables, by the ids the save uses.
// Generated by scripts/gen-gen3-data.mjs from the pret/pokeemerald and pret/pokeruby disassemblies. Do not edit by hand.

/** National Dex 1-386. */
export const SPECIES_NAMES: readonly string[] = ${JSON.stringify(species)};

/**
 * The save stores the game's own species number, which is the National Dex number up to Celebi (251). After that come
 * 25 unused slots and then the Hoenn Pokémon in Hoenn Dex order, so this maps each species number to its National Dex
 * number (0 for the unused ones).
 */
export const INTERNAL_TO_DEX: readonly number[] = ${JSON.stringify(internalToDex)};

/**
 * Per species, by dex number - 1: base HP, Attack, Defense, Speed, Special Attack, Special Defense, the two types,
 * the gender ratio byte (0 = always male, 254 = always female, 255 = genderless; otherwise a Pokémon is female when the
 * low byte of its personality value is below it), the growth rate (an index into GROWTH_RATES), the egg cycles to hatch,
 * its first and second ability (ABILITY_NAMES ids, 0 for none) and the friendship it starts with.
 */
export const BASE_TABLE: readonly [hp: number, atk: number, def: number, spe: number, spa: number, spd: number, type1: string, type2: string, gender: number, growth: number, eggCycles: number, ability1: number, ability2: number, friendship: number][] = [
${base.join('\n')}
];

/** Ability names by id (0 is none). */
export const ABILITY_NAMES: readonly string[] = ${JSON.stringify(abilityNames)};

/** The 25 natures, by personality value % 25. */
export const NATURE_NAMES: readonly string[] = ${JSON.stringify(natures)};

/** Per move, by move id - 1: name, type, power, accuracy (a percentage, 0 for moves that never miss), base PP. */
export const MOVE_TABLE: readonly [name: string, type: string, power: number, accuracy: number, pp: number][] = [
${moves.join('\n')}
];

/**
 * Every real item: id, name, pocket ('item', 'ball', 'tmhm', 'berry' or 'key') and whether Ruby and Sapphire have it
 * (Emerald adds its own and FireRed and LeafGreen's at the end of the list).
 */
export const ITEM_TABLE: readonly [id: number, name: string, pocket: 'item' | 'ball' | 'tmhm' | 'berry' | 'key', rs: boolean][] = [
${items.join('\n')}
];

/** The move each TM (01-50) and then each HM (01-08) teaches. */
export const TMHM_MOVES: readonly number[] = ${JSON.stringify(tmhm)};

/** Place names by map section id, as a Pokémon's met location stores them. */
export const PLACE_NAMES: readonly string[] = ${JSON.stringify(places)};

/** Ruby and Sapphire only have the places before this id. */
export const RS_PLACE_COUNT = ${rsPlaces};
`;
await writeFile(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core', 'gen3', 'tables.ts'), out);
console.log(`Wrote ${species.length} species, ${moves.length} moves, ${items.length} items, ${abilityNames.length} abilities and ${tmhm.length} TMs/HMs`);
