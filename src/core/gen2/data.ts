// Gen 2 (Gold / Silver) static data: names, base stats, moves and items come from tables.ts (generated from the
// pret/pokegold disassembly); this file adds the rules the editor needs on top of them.
// Unlike Gen 1, the save stores a Pokémon's National Dex number itself as its species, so there is no internal
// index to translate.

import { BASE_TABLE, ITEM_TABLE, MOVE_TABLE, SPECIES_NAMES, TMHM_MOVES } from './tables.ts';

export const DEX_COUNT = 251;
export const DEX_NAMES = SPECIES_NAMES;
/** The species byte the party and box lists use for an egg (the Pokémon itself still records what will hatch). */
export const EGG_SPECIES = 0xfd;

export const isSpecies = (id: number): boolean => id >= 1 && id <= DEX_COUNT;

export function speciesName(id: number): string {
  return isSpecies(id) ? DEX_NAMES[id - 1] : `Glitch (0x${id.toString(16).toUpperCase().padStart(2, '0')})`;
}

export interface BaseStats {
  hp: number; atk: number; def: number; spe: number; spa: number; spd: number;
  type1: string; type2: string;
  /** The game's gender ratio byte (see genderOf). */
  gender: number;
  growth: Growth;
  catchRate: number;
  /** Egg cycles to hatch (an egg counts these down in its friendship byte). */
  eggCycles: number;
}

// ---------- growth ----------

export type Growth = 'Medium Fast' | 'Slightly Fast' | 'Slightly Slow' | 'Medium Slow' | 'Fast' | 'Slow';
/** In the order the game numbers them (data/growth_rates.asm). */
export const GROWTH_RATES: readonly Growth[] = ['Medium Fast', 'Slightly Fast', 'Slightly Slow', 'Medium Slow', 'Fast', 'Slow'];
/** a/b·n³ + c·n² + d·n − e for each curve, as the game stores them. */
const CURVES: Record<Growth, [a: number, b: number, c: number, d: number, e: number]> = {
  'Medium Fast': [1, 1, 0, 0, 0],
  'Slightly Fast': [3, 4, 10, 0, 30],
  'Slightly Slow': [3, 4, 20, 0, 70],
  'Medium Slow': [6, 5, -15, 100, 140],
  Fast: [4, 5, 0, 0, 0],
  Slow: [5, 4, 0, 0, 0],
};

/**
 * The least experience for a level on a curve (pokegold: CalcExpAtLevel). The game works out a·n³ / b first, rounding
 * down, then adds the rest. At level 1 the Medium Slow curve comes out below zero; the editor uses 0 there.
 */
export function expForLevel(growth: Growth, n: number): number {
  const [a, b, c, d, e] = CURVES[growth];
  return Math.max(0, Math.floor((a * n * n * n) / b) + c * n * n + d * n - e);
}

export const MAX_EXP = 0xffffff;

export const BASE_STATS: readonly BaseStats[] = BASE_TABLE.map(([hp, atk, def, spe, spa, spd, type1, type2, gender, growth, catchRate, eggCycles]) => ({
  hp, atk, def, spe, spa, spd, type1, type2, gender, growth: GROWTH_RATES[growth], catchRate, eggCycles,
}));

export function baseStatsFor(id: number): BaseStats | null {
  return isSpecies(id) ? BASE_STATS[id - 1] : null;
}

/** The growth curve for a species. A glitch species has none, so `fallback` is used. */
export function growthOf(id: number, fallback: Growth = 'Medium Fast'): Growth {
  return baseStatsFor(id)?.growth ?? fallback;
}

/** The level a Pokémon with this much experience has reached on its curve (1-100). */
export function levelForExp(growth: Growth, exp: number): number {
  let level = 1;
  while (level < 100 && expForLevel(growth, level + 1) <= exp) level++;
  return level;
}

/** The first growth curve consistent with a level and experience (falls back to Medium Fast). For glitch species. */
export function guessGrowth(level: number, exp: number): Growth {
  for (const g of GROWTH_RATES) {
    const lo = expForLevel(g, level);
    const hi = level >= 100 ? Infinity : expForLevel(g, level + 1);
    if (exp >= lo && exp < hi) return g;
  }
  return 'Medium Fast';
}

// ---------- DVs: gender, shininess, Unown's letter, Hidden Power ----------

export interface Dvs { atk: number; def: number; spe: number; spc: number }

/** HP's DV isn't stored; the game builds it from the lowest bit of the other four. */
export const hpDv = (dvs: Dvs): number => ((dvs.atk & 1) << 3) | ((dvs.def & 1) << 2) | ((dvs.spe & 1) << 1) | (dvs.spc & 1);

export type Gender = 'male' | 'female' | 'none';

/**
 * Gender comes from the DVs (pokegold: GetGender): the Attack DV and the Speed DV make one byte, and a Pokémon is female
 * when that byte is at or below its species' ratio. Ratio 0 is always male, 254 always female and 255 genderless.
 */
export function genderOf(species: number, dvs: Dvs): Gender {
  const ratio = baseStatsFor(species)?.gender;
  if (ratio === undefined || ratio === 255) return 'none';
  if (ratio === 0) return 'male';
  if (ratio === 254) return 'female';
  return ((dvs.atk << 4) | dvs.spe) <= ratio ? 'female' : 'male';
}

/** True when a species can be either gender, so the editor can offer to change it. */
export const hasTwoGenders = (species: number): boolean => {
  const r = baseStatsFor(species)?.gender;
  return r !== undefined && r !== 0 && r !== 254 && r !== 255;
};

/**
 * The nearest Attack DV that gives the wanted gender (the Speed DV is kept). Returns the DV unchanged if it already
 * does, or if the species can't be that gender.
 */
export function attackDvForGender(species: number, dvs: Dvs, want: 'male' | 'female'): number {
  if (genderOf(species, dvs) === want || !hasTwoGenders(species)) return dvs.atk;
  const order = Array.from({ length: 16 }, (_, i) => i).sort((x, y) => Math.abs(x - dvs.atk) - Math.abs(y - dvs.atk) || y - x);
  return order.find((atk) => genderOf(species, { ...dvs, atk }) === want) ?? dvs.atk;
}

/** Shiny (pokegold: CheckShininess): Defense, Speed and Special DVs of 10, and an Attack DV of 2, 3, 6, 7, 10, 11, 14 or 15. */
export const isShiny = (dvs: Dvs): boolean => dvs.def === 10 && dvs.spe === 10 && dvs.spc === 10 && (dvs.atk & 2) !== 0;

/** The DVs that make a Pokémon shiny while changing as little as possible: Attack keeps its value if it can. */
export function shinyDvs(dvs: Dvs): Dvs {
  return { atk: dvs.atk & 2 ? dvs.atk : dvs.atk | 2, def: 10, spe: 10, spc: 10 };
}

/** Unown's letter, 'A' to 'Z' (pokegold: GetUnownLetter): the middle two bits of each DV, divided by 10. */
export function unownLetter(dvs: Dvs): string {
  const mid = (v: number) => (v >> 1) & 3;
  const n = (mid(dvs.atk) << 6) | (mid(dvs.def) << 4) | (mid(dvs.spe) << 2) | mid(dvs.spc);
  return String.fromCharCode(65 + Math.floor(n / 10));
}

export const UNOWN = 201;
export const UNOWN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * DVs that give Unown the wanted letter, changing only the middle two bits of each DV, and staying as close as possible
 * to the letter value the DVs have now (so asking for the letter it already is changes nothing).
 */
export function dvsForUnownLetter(dvs: Dvs, letter: string): Dvs {
  const want = UNOWN_LETTERS.indexOf(letter.toUpperCase());
  if (want < 0 || unownLetter(dvs) === UNOWN_LETTERS[want]) return { ...dvs };
  const mid = (v: number) => (v >> 1) & 3;
  const now = (mid(dvs.atk) << 6) | (mid(dvs.def) << 4) | (mid(dvs.spe) << 2) | mid(dvs.spc);
  // Letter n covers the values n*10 to n*10+9 (Z only 250-255).
  const lo = want * 10, hi = Math.min(255, lo + 9);
  const n = Math.max(lo, Math.min(hi, now));
  const put = (v: number, bits: number) => (v & ~6) | (bits << 1);
  return { atk: put(dvs.atk, (n >> 6) & 3), def: put(dvs.def, (n >> 4) & 3), spe: put(dvs.spe, (n >> 2) & 3), spc: put(dvs.spc, n & 3) };
}

// ---------- moves ----------

export const MOVE_NAMES: readonly string[] = ['—', ...MOVE_TABLE.map((m) => m[0])];

export interface MoveInfo { name: string; type: string; power: number; accuracy: number; pp: number }

/** Info for a move id, or null for "no move" (0) and ids that don't exist. Accuracy is a percentage. */
export function moveInfo(id: number): MoveInfo | null {
  const row = MOVE_TABLE[id - 1];
  return row ? { name: row[0], type: row[1], power: row[2], accuracy: Math.round((row[3] * 100) / 255), pp: row[4] } : null;
}

/**
 * The most PP a move can have after `ppUps` PP Ups (pokegold: ComputeMaxPP): each adds a fifth of the base PP, at most 7,
 * so a 40-PP move tops out at 61.
 */
export function maxPp(id: number, ppUps: number): number {
  const info = moveInfo(id);
  if (!info) return 0;
  const bonus = Math.min(7, Math.floor(info.pp / 5));
  return (info.pp + bonus * Math.max(0, Math.min(3, ppUps))) & 63;
}

export const TM_COUNT = 50;
export const HM_COUNT = 7;
/** "TM01" ... "TM50", "HM01" ... "HM07", in the order the TM pocket stores them. */
export const TMHM_LABELS: readonly string[] = TMHM_MOVES.map((_, i) => (i < TM_COUNT ? `TM${String(i + 1).padStart(2, '0')}` : `HM${String(i - TM_COUNT + 1).padStart(2, '0')}`));
export { TMHM_MOVES };

// ---------- items ----------

export type Pocket = 'item' | 'key' | 'ball' | 'tmhm';
const ITEMS = new Map(ITEM_TABLE.map(([id, name, pocket]) => [id, { name, pocket }]));

export function itemName(id: number): string {
  if (id === 0) return 'Nothing';
  const it = ITEMS.get(id);
  return it?.name || `Item 0x${id.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** Which pocket the game files an item in, or null for its unused placeholder entries. */
export const pocketOf = (id: number): Pocket | null => ITEMS.get(id)?.pocket || null;

/** Items offered by a picker: the real items of one pocket, in id order. */
export function itemChoices(...pockets: Pocket[]): { id: number; name: string }[] {
  return ITEM_TABLE.filter(([, name, pocket]) => name && pockets.includes(pocket as Pocket)).map(([id, name]) => ({ id, name }));
}

/** What a Pokémon can hold: anything from the Items and Balls pockets (the game won't give it a key item or a TM). */
export const HOLDABLE = (id: number): boolean => { const p = pocketOf(id); return p === 'item' || p === 'ball'; };

/** Mail is an item with a letter attached; a held letter lives in its own part of the save, which the editor leaves alone. */
export const isMail = (id: number): boolean => (id >= 0xb5 && id <= 0xbd) || id === 0x9e;

// ---------- trainer ----------

/** The badges in the order the game stores their bits (bit 0 first): Johto's eight, then Kanto's. */
export const JOHTO_BADGES = ['Zephyr', 'Hive', 'Plain', 'Fog', 'Mineral', 'Storm', 'Glacier', 'Rising'] as const;
export const KANTO_BADGES = ['Boulder', 'Cascade', 'Thunder', 'Rainbow', 'Soul', 'Marsh', 'Volcano', 'Earth'] as const;

/** Text speed as the game stores it in bits 0-2 of the options byte (pokegold: TEXT_DELAY_*). */
export const TEXT_SPEEDS = [
  { value: 1, label: 'Fast' },
  { value: 3, label: 'Mid' },
  { value: 5, label: 'Slow' },
] as const;

/** The PRINT option: how dark the Game Boy Printer prints (pokegold: GBPRINTER_*). */
export const PRINT_SHADES = [
  { value: 0x00, label: 'Lightest' },
  { value: 0x20, label: 'Lighter' },
  { value: 0x40, label: 'Normal' },
  { value: 0x60, label: 'Darker' },
  { value: 0x7f, label: 'Darkest' },
] as const;

/** Pokérus: the high four bits are the strain, the low four the days left (0 with a strain means cured, immune for life). */
export function pokerusState(byte: number): 'none' | 'infected' | 'cured' {
  if (!byte) return 'none';
  return byte & 0x0f ? 'infected' : 'cured';
}
