// Gen 3 (Ruby / Sapphire / Emerald) static data: names, base stats, moves and items come from tables.ts (generated from
// the pret disassemblies); this file adds the rules the editor needs on top of them. Checked against pokeemerald's
// src/pokemon.c (stats, gender, shininess, Unown's letter, PP) and src/data/pokemon/experience_tables.h.

import {
  ABILITY_NAMES, BASE_TABLE, INTERNAL_TO_DEX, ITEM_TABLE, MOVE_TABLE, NATURE_NAMES, PLACE_NAMES, RS_PLACE_COUNT, SPECIES_NAMES,
  TMHM_MOVES,
} from './tables.ts';

export const DEX_COUNT = 386;
export const DEX_NAMES = SPECIES_NAMES;
export { ABILITY_NAMES, NATURE_NAMES, TMHM_MOVES };

/** Which layout and item list a save uses: Ruby and Sapphire share one, Emerald moved things and added a few items. */
export type Gen3Game = 'rs' | 'emerald';

// ---------- species ----------

/** The game's species number for an egg (the Pokémon itself still records what will hatch). */
export const EGG_SPECIES = 412;
const DEX_TO_INTERNAL: number[] = [];
INTERNAL_TO_DEX.forEach((dex, id) => { if (dex) DEX_TO_INTERNAL[dex] = id; });

/** National Dex number for the game's species number, or 0 for an empty or glitch one. */
export const dexOf = (species: number): number => INTERNAL_TO_DEX[species] ?? 0;
/** The game's species number for a National Dex number. */
export const speciesOf = (dex: number): number => DEX_TO_INTERNAL[dex] ?? 0;

export const isDex = (dex: number): boolean => dex >= 1 && dex <= DEX_COUNT;

export function speciesName(dex: number): string {
  return isDex(dex) ? DEX_NAMES[dex - 1] : `Glitch (${dex})`;
}

// ---------- growth ----------

export type Growth = 'Medium Fast' | 'Erratic' | 'Fluctuating' | 'Medium Slow' | 'Fast' | 'Slow';
/** In the order the game numbers them (pokeemerald: GROWTH_*). */
export const GROWTH_RATES: readonly Growth[] = ['Medium Fast', 'Erratic', 'Fluctuating', 'Medium Slow', 'Fast', 'Slow'];

const cube = (n: number) => n * n * n;
const div = (a: number, b: number) => Math.trunc(a / b);
/** The game's exp formulas (experience_tables.h), in its integer arithmetic. Level 1 is 1 on every curve. */
const CURVES: Record<Growth, (n: number) => number> = {
  'Medium Fast': (n) => cube(n),
  Erratic: (n) => (n <= 50 ? div((100 - n) * cube(n), 50) : n <= 68 ? div((150 - n) * cube(n), 100)
    : n <= 98 ? div(div(1911 - 10 * n, 3) * cube(n), 500) : div((160 - n) * cube(n), 100)),
  Fluctuating: (n) => (n <= 15 ? div((div(n + 1, 3) + 24) * cube(n), 50) : n <= 36 ? div((n + 14) * cube(n), 50)
    : div((div(n, 2) + 32) * cube(n), 50)),
  'Medium Slow': (n) => div(6 * cube(n), 5) - 15 * n * n + 100 * n - 140,
  Fast: (n) => div(4 * cube(n), 5),
  Slow: (n) => div(5 * cube(n), 4),
};

/** The least experience a Pokémon on this curve has at level n (1-100). */
export function expForLevel(growth: Growth, n: number): number {
  return n <= 1 ? 1 : CURVES[growth](n);
}

/** The level a Pokémon with this much experience has reached (pokeemerald: GetLevelFromBoxMonExp), at least 1. */
export function levelForExp(growth: Growth, exp: number): number {
  let level = 1;
  while (level < 100 && expForLevel(growth, level + 1) <= exp) level++;
  return level;
}

export interface BaseStats {
  hp: number; atk: number; def: number; spe: number; spa: number; spd: number;
  type1: string; type2: string;
  /** The gender ratio byte (see genderOf). */
  gender: number;
  growth: Growth;
  eggCycles: number;
  abilities: [number, number];
  friendship: number;
}

export const BASE_STATS: readonly BaseStats[] = BASE_TABLE.map(([hp, atk, def, spe, spa, spd, type1, type2, gender, growth, eggCycles, a1, a2, friendship]) => ({
  hp, atk, def, spe, spa, spd, type1, type2, gender, growth: GROWTH_RATES[growth], eggCycles, abilities: [a1, a2], friendship,
}));

/** Base stats by National Dex number. */
export function baseStatsFor(dex: number): BaseStats | null {
  return isDex(dex) ? BASE_STATS[dex - 1] : null;
}

export const growthOf = (dex: number): Growth => baseStatsFor(dex)?.growth ?? 'Medium Fast';

// ---------- personality: nature, gender, shininess, Unown's letter ----------

/** The nature is the personality value mod 25. */
export const natureOf = (pid: number): number => (pid >>> 0) % 25;

export type StatKey = 'hp' | 'atk' | 'def' | 'spe' | 'spa' | 'spd';
/** The stats a nature raises and lowers, in the game's order (pokeemerald: gNatureStatTable). Equal means neutral. */
const NATURE_STATS: StatKey[] = ['atk', 'def', 'spe', 'spa', 'spd'];
export function natureEffect(nature: number): { up: StatKey; down: StatKey } | null {
  const up = NATURE_STATS[Math.floor(nature / 5)], down = NATURE_STATS[nature % 5];
  return up === down ? null : { up, down };
}

export type Gender = 'male' | 'female' | 'none';

/** pokeemerald GetGenderFromSpeciesAndPersonality: female when the ratio is above the personality's low byte. */
export function genderOf(dex: number, pid: number): Gender {
  const ratio = baseStatsFor(dex)?.gender;
  if (ratio === undefined || ratio === 255) return 'none';
  if (ratio === 0) return 'male';
  if (ratio === 254) return 'female';
  return ratio > (pid & 0xff) ? 'female' : 'male';
}

export const hasTwoGenders = (dex: number): boolean => {
  const r = baseStatsFor(dex)?.gender;
  return r !== undefined && r !== 0 && r !== 254 && r !== 255;
};

/** Shiny when the trainer's ID and secret ID and the two halves of the personality XOR to less than 8. */
export function isShiny(otId: number, pid: number): boolean {
  const x = ((otId >>> 16) ^ (otId & 0xffff) ^ (pid >>> 16) ^ (pid & 0xffff)) & 0xffff;
  return x < 8;
}

export const UNOWN = 201;
/** Gen 3 added ! and ? to Unown's 26 letters. */
export const UNOWN_FORMS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!?';
/** pokeemerald GetUnownLetterByPersonality: two bits from each byte of the personality, mod 28. */
export function unownForm(pid: number): string {
  const n = (((pid & 0x3000000) >>> 18) | ((pid & 0x30000) >>> 12) | ((pid & 0x300) >>> 6) | (pid & 0x3)) % 28;
  return UNOWN_FORMS[n];
}

export interface PidWish {
  nature?: number;
  gender?: 'male' | 'female';
  shiny?: boolean;
  unown?: string;
}

/**
 * A new personality value with the nature, gender, shininess and Unown letter asked for (each one left out keeps what
 * `current` gives). The game draws these from one random number, so changing any of them means a new one; the rest of
 * the Pokémon (IVs, ability, moves) is stored separately and doesn't change.
 */
export function findPid(dex: number, otId: number, current: number, wish: PidWish, random: () => number = Math.random): number {
  const want = {
    nature: wish.nature ?? natureOf(current),
    gender: hasTwoGenders(dex) ? wish.gender ?? genderOf(dex, current) : null,
    shiny: wish.shiny ?? isShiny(otId, current),
    unown: dex === UNOWN ? wish.unown ?? unownForm(current) : null,
  };
  const fits = (pid: number) => natureOf(pid) === want.nature && (want.gender === null || genderOf(dex, pid) === want.gender)
    && isShiny(otId, pid) === want.shiny && (want.unown === null || unownForm(pid) === want.unown);
  if (fits(current >>> 0)) return current >>> 0;
  const tsv = ((otId >>> 16) ^ (otId & 0xffff)) & 0xffff;
  for (let tries = 0; tries < 2_000_000; tries++) {
    const hi = Math.floor(random() * 0x10000);
    // A shiny one needs its low half to XOR with the rest to 0-7; otherwise any low half that doesn't.
    const lo = want.shiny ? (tsv ^ hi ^ Math.floor(random() * 8)) & 0xffff : Math.floor(random() * 0x10000);
    const pid = ((hi << 16) | lo) >>> 0;
    if (fits(pid)) return pid;
  }
  return current >>> 0;
}

// ---------- stats ----------

export interface Ivs { hp: number; atk: number; def: number; spe: number; spa: number; spd: number }
export type Evs = Ivs;
export type Stats = Ivs;
export const SHEDINJA = 292;

/** The Gen 3 stat formula (pokeemerald: CalculateMonStats), nature included. Shedinja always has 1 HP. */
export function calcStats(dex: number, level: number, ivs: Ivs, evs: Evs, nature: number): Stats | null {
  const base = baseStatsFor(dex);
  if (!base) return null;
  const effect = natureEffect(nature);
  const other = (k: Exclude<StatKey, 'hp'>) => {
    const n = Math.floor(((2 * base[k] + ivs[k] + Math.floor(evs[k] / 4)) * level) / 100) + 5;
    if (effect?.up === k) return Math.floor((n * 110) / 100);
    if (effect?.down === k) return Math.floor((n * 90) / 100);
    return n;
  };
  return {
    hp: dex === SHEDINJA ? 1 : Math.floor(((2 * base.hp + ivs.hp + Math.floor(evs.hp / 4)) * level) / 100) + level + 10,
    atk: other('atk'), def: other('def'), spe: other('spe'), spa: other('spa'), spd: other('spd'),
  };
}

/** EVs: each stat holds 0-255, and the game stops giving them at 510 in total. */
export const EV_MAX = 255;
export const EV_TOTAL_MAX = 510;

// ---------- abilities ----------

/** The ability a Pokémon has: its species' second one if the ability bit is set and the species has a second. */
export function abilityOf(dex: number, abilityBit: number): number {
  const a = baseStatsFor(dex)?.abilities;
  if (!a) return 0;
  return abilityBit && a[1] ? a[1] : a[0];
}

// ---------- moves ----------

export const MOVE_COUNT = MOVE_TABLE.length;
export const MOVE_NAMES: readonly string[] = ['—', ...MOVE_TABLE.map((m) => m[0])];

export interface MoveInfo { name: string; type: string; power: number; accuracy: number; pp: number }

export function moveInfo(id: number): MoveInfo | null {
  const row = MOVE_TABLE[id - 1];
  return row ? { name: row[0], type: row[1], power: row[2], accuracy: row[3], pp: row[4] } : null;
}

/** The most PP after `ppUps` PP Ups (pokeemerald: CalculatePPWithBonus): each adds a fifth of the base PP. */
export function maxPp(id: number, ppUps: number): number {
  const info = moveInfo(id);
  if (!info) return 0;
  return info.pp + Math.floor((info.pp * 20 * Math.max(0, Math.min(3, ppUps))) / 100);
}

export const TM_COUNT = 50;
export const HM_COUNT = 8;
/** The item ids of TM01 and HM01; the TMs and HMs are numbered on from them. */
export const TM01 = 289;
export const TMHM_LABELS: readonly string[] = TMHM_MOVES.map((_, i) => (i < TM_COUNT ? `TM${String(i + 1).padStart(2, '0')}` : `HM${String(i - TM_COUNT + 1).padStart(2, '0')}`));

// ---------- items ----------

export type Pocket = 'item' | 'ball' | 'tmhm' | 'berry' | 'key';
/** Emerald can hold its own two key items on top of Ruby and Sapphire's; FireRed and LeafGreen's are left out. */
const EMERALD_ONLY = new Set([375, 376]);
const ITEMS = new Map(ITEM_TABLE.map(([id, name, pocket, rs]) => [id, { name, pocket, rs }]));

const inGame = (id: number, game: Gen3Game): boolean => {
  const it = ITEMS.get(id);
  return !!it && (it.rs || (game === 'emerald' && EMERALD_ONLY.has(id)));
};

export function itemName(id: number): string {
  if (id === 0) return 'Nothing';
  return ITEMS.get(id)?.name ?? `Item ${id}`;
}

export const pocketOf = (id: number): Pocket | null => ITEMS.get(id)?.pocket ?? null;

/** Items a picker offers: the ones the game has, from the pockets given, in id order. */
export function itemChoices(pockets: readonly Pocket[], game: Gen3Game = 'rs'): { id: number; name: string }[] {
  return ITEM_TABLE.filter(([id, , pocket]) => pockets.includes(pocket) && inGame(id, game)).map(([id, name]) => ({ id, name }));
}

/** Mail (Orange Mail to Retro Mail): a held letter is kept elsewhere in the save, and only the game can write one. */
export const isMail = (id: number): boolean => id >= 121 && id <= 132;

/** The Poké Balls, by the number a Pokémon stores for the ball it was caught in (the same as the item id). */
export const BALLS = ITEM_TABLE.filter(([id, , pocket]) => pocket === 'ball' && id <= 12).map(([id, name]) => ({ id, name }));

// ---------- trainer ----------

export const HOENN_BADGES = ['Stone', 'Knuckle', 'Dynamo', 'Heat', 'Balance', 'Feather', 'Mind', 'Rain'] as const;

/** OPTION menu text speed (pokeemerald: OPTIONS_TEXT_SPEED_*). */
export const TEXT_SPEEDS = [{ value: 0, label: 'Slow' }, { value: 1, label: 'Mid' }, { value: 2, label: 'Fast' }] as const;
/** OPTION menu BUTTON MODE (OPTIONS_BUTTON_MODE_*). */
export const BUTTON_MODES = [{ value: 0, label: 'Normal' }, { value: 1, label: 'LR' }, { value: 2, label: 'L=A' }] as const;
/** The OPTION menu's FRAME has 20 types. */
export const FRAME_COUNT = 20;

/** Pokérus: the high four bits are the strain, the low four the days left (0 with a strain means cured). */
export function pokerusState(byte: number): 'none' | 'infected' | 'cured' {
  if (!byte) return 'none';
  return byte & 0x0f ? 'infected' : 'cured';
}

// ---------- where a Pokémon came from ----------

/** The game a Pokémon was met in (its "met game" number). */
export const GAMES_OF_ORIGIN = [
  { value: 1, label: 'Sapphire' }, { value: 2, label: 'Ruby' }, { value: 3, label: 'Emerald' },
  { value: 4, label: 'FireRed' }, { value: 5, label: 'LeafGreen' }, { value: 15, label: 'Colosseum or XD' },
] as const;

/** The language a Pokémon was caught in (pokeemerald: LANGUAGE_*). */
export const LANGUAGES = [
  { value: 1, label: 'Japanese' }, { value: 2, label: 'English' }, { value: 3, label: 'French' },
  { value: 4, label: 'Italian' }, { value: 5, label: 'German' }, { value: 7, label: 'Spanish' },
] as const;
export const ENGLISH = 2;

/** Special met-location values (pokeemerald: METLOC_*). */
export const METLOC_IN_GAME_TRADE = 0xfe;
export const METLOC_FATEFUL = 0xff;

export function placeName(id: number): string {
  if (id === METLOC_IN_GAME_TRADE) return 'In-game trade';
  if (id === METLOC_FATEFUL) return 'Fateful encounter';
  return PLACE_NAMES[id] || `Place ${id}`;
}

/** Places a picker offers for a game: Ruby and Sapphire's Hoenn ones, or every one Emerald names. */
export function placeChoices(game: Gen3Game): { id: number; name: string }[] {
  const count = game === 'rs' ? RS_PLACE_COUNT : PLACE_NAMES.length;
  const seen = new Set<string>();
  const out: { id: number; name: string }[] = [];
  for (let id = 0; id < count; id++) {
    const name = PLACE_NAMES[id];
    // Several ids share a name (the underwater areas, both halves of a cave); the picker offers the first.
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ id, name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
