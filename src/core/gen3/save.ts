// Gen 3 (Ruby / Sapphire / Emerald, English) save file model.
// Layout: pret/pokeruby and pret/pokeemerald (include/global.h, src/save.c, include/pokemon.h), checked against real
// Ruby and Emerald saves and saves made by the real Ruby game.
//
// The file is 128 KB of flash: two save slots of 14 sectors (4 KB each), then the Hall of Fame and other extras. Each
// time the game saves it writes the whole game into the slot it didn't use last, with a higher save counter, and on
// Continue it loads the slot with the highest counter whose sectors are all valid. Each sector holds up to 3,968 bytes
// of one block, then a footer: the sector's id (0-13), a 16-bit checksum of its data, a signature and the save counter.
// The game also rotates which physical sector holds which id, so sectors are found by id, not by position.
//
//   id 0       SaveBlock2: the player's name, gender, ID, play time, options, Pokédex
//   ids 1-4    SaveBlock1: the party, money, bag, flags and the rest of the game state
//   ids 5-13   the PC: current box, 14 boxes of 30 Pokémon, box names and wallpapers
//
// This edits the newest slot in place (same counter, same sector order), so the game loads it as before, and an
// unedited file comes back byte for byte. Emerald hides money, coins and bag quantities behind a random key.

import type { ChangeGroup, EditableSave, SummaryLine } from '../types.ts';
import {
  DEX_COUNT, EGG_SPECIES, ENGLISH, HM_COUNT, TM01, TM_COUNT, abilityOf, baseStatsFor, calcStats, dexOf, expForLevel, growthOf,
  levelForExp, maxPp, natureOf, speciesOf, type Evs, type Gen3Game, type Ivs, type Pocket, type Stats,
} from './data.ts';
import { describeGen3Changes } from './diff.ts';
import { decodeText, encodeText } from './text.ts';

export const SAVE_SIZE = 0x20000;
const SECTOR = 0x1000;
const SECTOR_DATA = 3968;
const SECTORS_PER_SLOT = 14;
const SIGNATURE = 0x08012025;

interface Layout {
  /** How many bytes of each block the game saves (and so checksums). */
  sb2Size: number;
  sb1Size: number;
  items: number; itemsMax: number;
  keyItems: number; keyItemsMax: number;
  balls: number; ballsMax: number;
  tmhm: number; tmhmMax: number;
  berries: number; berriesMax: number;
  /** The two copies of the Pokédex's "seen" flags kept in SaveBlock1 (the game checks all three agree). */
  seenCopies: [number, number];
  flags: number;
  vars: number;
  /** Event flag numbers. */
  badgeFlag: number;
  nationalDexFlag: number;
  /** Money, coins and bag quantities are XORed with the key at SaveBlock2 0xAC. */
  encrypted: boolean;
}

const RS: Layout = {
  sb2Size: 0x890, sb1Size: 0x3ac0,
  items: 0x560, itemsMax: 20, keyItems: 0x5b0, keyItemsMax: 20, balls: 0x600, ballsMax: 16,
  tmhm: 0x640, tmhmMax: 64, berries: 0x740, berriesMax: 46,
  seenCopies: [0x938, 0x3a8c], flags: 0x1220, vars: 0x1340, badgeFlag: 0x807, nationalDexFlag: 0x836, encrypted: false,
};

const EMERALD: Layout = {
  sb2Size: 0xf2c, sb1Size: 0x3d88,
  items: 0x560, itemsMax: 30, keyItems: 0x5d8, keyItemsMax: 30, balls: 0x650, ballsMax: 16,
  tmhm: 0x690, tmhmMax: 64, berries: 0x790, berriesMax: 46,
  seenCopies: [0x988, 0x3b24], flags: 0x1270, vars: 0x139c, badgeFlag: 0x867, nationalDexFlag: 0x896, encrypted: true,
};

export const GEN3_LAYOUTS: Readonly<Record<Gen3Game, Layout>> = { rs: RS, emerald: EMERALD };

/** How many different items each pocket (and the PC) holds, and how many of one item fits in a slot. */
export function pocketSizes(game: Gen3Game): Record<Pocket | 'pc', { slots: number; count: number }> {
  const L = GEN3_LAYOUTS[game];
  return {
    item: { slots: L.itemsMax, count: 99 }, key: { slots: L.keyItemsMax, count: 99 }, ball: { slots: L.ballsMax, count: 99 },
    tmhm: { slots: L.tmhmMax, count: 99 }, berry: { slots: L.berriesMax, count: 999 }, pc: { slots: 50, count: 999 },
  };
}

// Shared offsets.
const SB2 = {
  name: 0x00, gender: 0x08, trainerId: 0x0a, playHours: 0x0e, playMinutes: 0x10, playSeconds: 0x11, playFrames: 0x12,
  buttonMode: 0x13, options: 0x14, dexMode: 0x19, nationalMagic: 0x1a, dexOwned: 0x28, dexSeen: 0x5c, key: 0xac,
};
const SB1 = { partyCount: 0x234, party: 0x238, money: 0x490, coins: 0x494, pcItems: 0x498 };
const PC_ITEMS_MAX = 50;
const STORAGE = { currentBox: 0, boxes: 4, names: 0x8344, size: 0x83d0 };
const VAR_NATIONAL_DEX = 0x4046;
const NATIONAL_MAGIC = 0xda;

export const PARTY_MAX = 6;
export const BOX_COUNT = 14;
export const BOX_SLOTS = 30;
export const BOX_NAME_LEN = 8;
export const PLAYER_NAME_MAX = 7;
export const NICKNAME_MAX = 10;
const DEX_BYTES = 52;
export const MONEY_MAX = 999999;
export const COINS_MAX = 9999;
const PARTY_MON_SIZE = 100;
const BOX_MON_SIZE = 80;

// ---------- little-endian helpers ----------

const u16 = (d: Uint8Array, o: number) => d[o] | (d[o + 1] << 8);
const u32 = (d: Uint8Array, o: number) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
const setU16 = (d: Uint8Array, o: number, v: number) => { d[o] = v & 0xff; d[o + 1] = (v >> 8) & 0xff; };
const setU32 = (d: Uint8Array, o: number, v: number) => { setU16(d, o, v & 0xffff); setU16(d, o + 2, (v >>> 16) & 0xffff); };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v)));

/** The sector checksum (pokeemerald: CalculateChecksum): a 32-bit sum of the words, folded to 16 bits. */
export function sectorChecksum(d: Uint8Array, start: number, size: number): number {
  let sum = 0;
  for (let i = 0; i < size; i += 4) sum = (sum + u32(d, start + i)) >>> 0;
  return ((sum >>> 16) + sum) & 0xffff;
}

/** How many bytes the game saves in sector `id`. */
function sectorSize(L: Layout, id: number): number {
  if (id === 0) return L.sb2Size;
  if (id <= 4) return Math.min(SECTOR_DATA, L.sb1Size - (id - 1) * SECTOR_DATA);
  return Math.min(SECTOR_DATA, STORAGE.size - (id - 5) * SECTOR_DATA);
}

interface Slot { slot: number; counter: number; sectorOf: number[] }

/** Each slot that has all 14 sectors with the signature and right checksums, newest first. */
function validSlots(data: Uint8Array, L: Layout): Slot[] {
  const out: Slot[] = [];
  for (let slot = 0; slot < 2; slot++) {
    const sectorOf: number[] = [];
    let counter = -1;
    let ok = true;
    for (let i = 0; i < SECTORS_PER_SLOT && ok; i++) {
      const o = (slot * SECTORS_PER_SLOT + i) * SECTOR;
      const id = u16(data, o + 0xff4);
      if (u32(data, o + 0xff8) !== SIGNATURE || id >= SECTORS_PER_SLOT || sectorOf[id] !== undefined) { ok = false; break; }
      if (u16(data, o + 0xff6) !== sectorChecksum(data, o, sectorSize(L, id))) { ok = false; break; }
      const c = u32(data, o + 0xffc);
      if (counter >= 0 && c !== counter) ok = false;
      counter = c;
      sectorOf[id] = slot * SECTORS_PER_SLOT + i;
    }
    if (ok && sectorOf.length === SECTORS_PER_SLOT) out.push({ slot, counter, sectorOf });
  }
  // The game picks the higher counter; a counter that wrapped around past 0xFFFFFFFF counts as newer.
  return out.sort((a, b) => (a.counter === 0xffffffff && b.counter === 0 ? 1 : b.counter === 0xffffffff && a.counter === 0 ? -1 : b.counter - a.counter));
}

/**
 * Which game wrote the file. Ruby and Sapphire save 0x890 bytes of the first block and 0xC40 of the fifth; Emerald
 * saves 0xF2C and 0xF08, and since its checksums cover those longer runs, an Emerald file has data the Ruby layout
 * doesn't. When the extra bytes are all zero the two checksums agree, and the Ruby layout is the one that fits.
 */
export function detectGen3(data: Uint8Array): Gen3Game | null {
  if (data.length < SAVE_SIZE) return null;
  const rs = validSlots(data, RS)[0];
  const em = validSlots(data, EMERALD)[0];
  if (em && !rs) return 'emerald';
  if (rs && !em) return 'rs';
  if (!rs || !em) return null;
  // Both fit, so the extra bytes are all zero: tell them apart by Emerald's money key, which Ruby leaves as part of
  // its Battle Tower record. A Ruby file whose money only makes sense without a key is Ruby.
  const s0 = rs.sectorOf[0] * SECTOR;
  const s1 = rs.sectorOf[1] * SECTOR;
  const key = u32(data, s0 + SB2.key);
  const raw = u32(data, s1 + SB1.money);
  return key !== 0 && raw > MONEY_MAX && ((raw ^ key) >>> 0) <= MONEY_MAX ? 'emerald' : 'rs';
}

// ---------- Pokémon ----------

/** The order of the four 12-byte parts (Growth, Attacks, EVs, Misc) inside a Pokémon, by personality % 24. */
const ORDERS = [
  'GAEM', 'GAME', 'GEAM', 'GEMA', 'GMAE', 'GMEA', 'AGEM', 'AGME', 'AEGM', 'AEMG', 'AMGE', 'AMEG',
  'EGAM', 'EGMA', 'EAGM', 'EAMG', 'EMGA', 'EMAG', 'MGAE', 'MGEA', 'MAGE', 'MAEG', 'MEGA', 'MEAG',
];
const PART = { G: 0, A: 1, E: 2, M: 3 } as const;

export interface Gen3Mon {
  pid: number;
  /** Original trainer: ID in the low 16 bits, secret ID in the high 16. */
  otId: number;
  nickname: string;
  language: number;
  otName: string;
  markings: number;
  /** National Dex number (0 for a glitch species, see `rawSpecies`). */
  species: number;
  item: number;
  exp: number;
  ppUps: [number, number, number, number];
  /** Friendship. For an egg, the egg cycles left before it hatches. */
  friendship: number;
  moves: [number, number, number, number];
  pp: [number, number, number, number];
  evs: Evs;
  /** Cool, Beauty, Cute, Smart, Tough, Sheen. */
  contest: [number, number, number, number, number, number];
  pokerus: number;
  metLocation: number;
  /** 0 for a hatched egg. */
  metLevel: number;
  metGame: number;
  ball: number;
  otGender: 'male' | 'female';
  ivs: Ivs;
  isEgg: boolean;
  /** 0 for the species' first ability, 1 for its second. */
  abilityBit: number;
  ribbons: number;
  level: number;
  // Party Pokémon only:
  status: number;
  /** Which saved letter a held Mail is (0xFF for none); it stays with the Pokémon. */
  mail: number;
  hp: number; maxHp: number; atk: number; def: number; spe: number; spa: number; spd: number;
  /** The decrypted 80 bytes as read, so fields the editor doesn't know are written back unchanged. */
  raw: Uint8Array;
  /** A "Bad Egg": its checksum was wrong when read, so the game shows it as one. It is written back untouched. */
  bad?: boolean;
  nickRaw?: Uint8Array;
  otRaw?: Uint8Array;
}

function decryptBox(d: Uint8Array, off: number): { raw: Uint8Array; checksumOk: boolean } {
  const pid = u32(d, off);
  const key = (pid ^ u32(d, off + 4)) >>> 0;
  const raw = d.slice(off, off + BOX_MON_SIZE);
  // Undo the XOR, and put the four parts in G, A, E, M order.
  const plain = new Uint8Array(48);
  for (let i = 0; i < 48; i += 4) setU32(plain, i, (u32(raw, 32 + i) ^ key) >>> 0);
  const order = ORDERS[pid % 24];
  for (let pos = 0; pos < 4; pos++) raw.set(plain.subarray(pos * 12, pos * 12 + 12), 32 + PART[order[pos] as keyof typeof PART] * 12);
  let sum = 0;
  for (let i = 32; i < 80; i += 2) sum = (sum + u16(raw, i)) & 0xffff;
  return { raw, checksumOk: sum === u16(raw, 28) };
}

function encryptBox(raw: Uint8Array): Uint8Array {
  const out = raw.slice(0, BOX_MON_SIZE);
  let sum = 0;
  for (let i = 32; i < 80; i += 2) sum = (sum + u16(out, i)) & 0xffff;
  setU16(out, 28, sum);
  const pid = u32(out, 0);
  const key = (pid ^ u32(out, 4)) >>> 0;
  const order = ORDERS[pid % 24];
  const plain = new Uint8Array(48);
  for (let pos = 0; pos < 4; pos++) {
    const p = PART[order[pos] as keyof typeof PART];
    plain.set(raw.subarray(32 + p * 12, 32 + p * 12 + 12), pos * 12);
  }
  for (let i = 0; i < 48; i += 4) setU32(out, 32 + i, (u32(plain, i) ^ key) >>> 0);
  return out;
}

/** Read one Pokémon (80 bytes in a box, 100 in the party). Returns null for an empty slot. */
export function readMon(d: Uint8Array, off: number, party: boolean): Gen3Mon | null {
  const pid = u32(d, off), otId = u32(d, off + 4);
  const { raw, checksumOk } = decryptBox(d, off);
  const flags = raw[19];
  const species = u16(raw, 32);
  if (!species && checksumOk && !(flags & 2)) return null;
  const G = 32, A = 44, E = 56, M = 68;
  const origins = u16(raw, M + 2);
  const iv = u32(raw, M + 4);
  const ppb = raw[G + 8];
  const mon: Gen3Mon = {
    pid, otId,
    nickname: decodeText(raw.subarray(8, 18)), language: raw[18], otName: decodeText(raw.subarray(20, 27)), markings: raw[27],
    nickRaw: raw.slice(8, 18), otRaw: raw.slice(20, 27),
    species: dexOf(species), item: u16(raw, G + 2), exp: u32(raw, G + 4),
    ppUps: [ppb & 3, (ppb >> 2) & 3, (ppb >> 4) & 3, (ppb >> 6) & 3], friendship: raw[G + 9],
    moves: [u16(raw, A), u16(raw, A + 2), u16(raw, A + 4), u16(raw, A + 6)],
    pp: [raw[A + 8], raw[A + 9], raw[A + 10], raw[A + 11]],
    evs: { hp: raw[E], atk: raw[E + 1], def: raw[E + 2], spe: raw[E + 3], spa: raw[E + 4], spd: raw[E + 5] },
    contest: [raw[E + 6], raw[E + 7], raw[E + 8], raw[E + 9], raw[E + 10], raw[E + 11]],
    pokerus: raw[M], metLocation: raw[M + 1],
    metLevel: origins & 0x7f, metGame: (origins >> 7) & 0xf, ball: (origins >> 11) & 0xf, otGender: origins & 0x8000 ? 'female' : 'male',
    ivs: { hp: iv & 31, atk: (iv >>> 5) & 31, def: (iv >>> 10) & 31, spe: (iv >>> 15) & 31, spa: (iv >>> 20) & 31, spd: (iv >>> 25) & 31 },
    isEgg: !!(iv & 0x40000000), abilityBit: iv >>> 31, ribbons: u32(raw, M + 8),
    level: 0, status: 0, mail: 0xff, hp: 0, maxHp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0,
    raw,
  };
  if (!checksumOk || (flags & 1)) mon.bad = true;
  if (party) {
    mon.status = u32(d, off + 80);
    mon.level = d[off + 84];
    mon.mail = d[off + 85];
    mon.hp = u16(d, off + 86); mon.maxHp = u16(d, off + 88); mon.atk = u16(d, off + 90); mon.def = u16(d, off + 92);
    mon.spe = u16(d, off + 94); mon.spa = u16(d, off + 96); mon.spd = u16(d, off + 98);
  } else {
    mon.level = levelForExp(growthOf(mon.species), mon.exp);
  }
  return mon;
}

/** The decrypted 80 bytes for a Pokémon, from its fields on top of the bytes it was read with. */
function monBytes(mon: Gen3Mon): Uint8Array {
  const raw = mon.raw.slice();
  if (mon.bad) return raw;
  const G = 32, A = 44, E = 56, M = 68;
  setU32(raw, 0, mon.pid);
  setU32(raw, 4, mon.otId);
  raw.set(encodeText(mon.nickname, 10, mon.nickRaw), 8);
  raw[18] = mon.language;
  // bit 1: has a species; bit 2: show the name "EGG" (set with the egg bit by the game).
  raw[19] = (raw[19] & ~0x06) | (mon.species ? 2 : 0) | (mon.isEgg ? 4 : 0);
  raw.set(encodeText(mon.otName, 7, mon.otRaw), 20);
  raw[27] = mon.markings;
  // A glitch species keeps the number it was read with.
  const species = mon.species ? speciesOf(mon.species) : u16(mon.raw, G);
  setU16(raw, G, species);
  setU16(raw, G + 2, mon.item);
  setU32(raw, G + 4, clamp(mon.exp, 0, 0x7fffffff));
  raw[G + 8] = (mon.ppUps[0] & 3) | ((mon.ppUps[1] & 3) << 2) | ((mon.ppUps[2] & 3) << 4) | ((mon.ppUps[3] & 3) << 6);
  raw[G + 9] = mon.friendship & 0xff;
  mon.moves.forEach((m, i) => { setU16(raw, A + i * 2, m); raw[A + 8 + i] = mon.pp[i] & 0xff; });
  const ev = mon.evs;
  [ev.hp, ev.atk, ev.def, ev.spe, ev.spa, ev.spd, ...mon.contest].forEach((v, i) => { raw[E + i] = clamp(v, 0, 255); });
  raw[M] = mon.pokerus & 0xff;
  raw[M + 1] = mon.metLocation & 0xff;
  setU16(raw, M + 2, (mon.metLevel & 0x7f) | ((mon.metGame & 0xf) << 7) | ((mon.ball & 0xf) << 11) | (mon.otGender === 'female' ? 0x8000 : 0));
  const iv = mon.ivs;
  const ivWord = (iv.hp & 31) | ((iv.atk & 31) << 5) | ((iv.def & 31) << 10) | ((iv.spe & 31) << 15) | ((iv.spa & 31) << 20)
    | ((iv.spd & 31) << 25) | (mon.isEgg ? 0x40000000 : 0) | ((mon.abilityBit & 1) << 31);
  setU32(raw, M + 4, ivWord >>> 0);
  setU32(raw, M + 8, mon.ribbons >>> 0);
  return raw;
}

function writeMon(d: Uint8Array, off: number, mon: Gen3Mon, party: boolean): void {
  d.set(mon.bad ? encryptRawAsIs(mon.raw) : encryptBox(monBytes(mon)), off);
  if (party) {
    setU32(d, off + 80, mon.status >>> 0);
    d[off + 84] = mon.level;
    d[off + 85] = mon.mail;
    [mon.hp, mon.maxHp, mon.atk, mon.def, mon.spe, mon.spa, mon.spd].forEach((v, i) => setU16(d, off + 86 + i * 2, clamp(v, 0, 0xffff)));
  }
}

/** A Bad Egg goes back exactly as it came: encrypted again without fixing its checksum. */
function encryptRawAsIs(raw: Uint8Array): Uint8Array {
  const checksum = u16(raw, 28);
  const out = encryptBox(raw);
  setU16(out, 28, checksum);
  return out;
}

/** Recalculate a party Pokémon's stored stats (and keep its HP in range, or fill it with `heal`). */
export function recalcPartyStats(mon: Gen3Mon, heal = false): void {
  const s = calcStats(mon.species, mon.level, mon.ivs, mon.evs, natureOf(mon.pid));
  if (!s) return;
  mon.maxHp = s.hp; mon.atk = s.atk; mon.def = s.def; mon.spe = s.spe; mon.spa = s.spa; mon.spd = s.spd;
  mon.hp = mon.isEgg || heal ? s.hp : Math.min(mon.hp, s.hp); // an egg is always at full HP, as CreateEgg leaves it
}

/** The stats a Pokémon has now: a party Pokémon's are stored, a box Pokémon's are worked out. */
export function statsOf(mon: Gen3Mon, party: boolean): Stats | null {
  if (party) return { hp: mon.maxHp, atk: mon.atk, def: mon.def, spe: mon.spe, spa: mon.spa, spd: mon.spd };
  return calcStats(mon.species, mon.level, mon.ivs, mon.evs, natureOf(mon.pid));
}

/** What the game does when a Pokémon comes out of the PC (pokeemerald: BoxMonToMon): stats worked out, HP full, status cleared. */
export function withdrawFromBox(mon: Gen3Mon): void {
  mon.status = 0;
  mon.mail = 0xff;
  mon.level = levelForExp(growthOf(mon.species), mon.exp);
  recalcPartyStats(mon, true);
}

/** What the game does when a Pokémon goes into the PC (pokeemerald: SetPlacedMonData): its PP is refilled. */
export function depositInBox(mon: Gen3Mon): void {
  mon.pp = mon.moves.map((m, i) => maxPp(m, mon.ppUps[i])) as Gen3Mon['pp'];
}

/** The ability id a Pokémon has. */
export const monAbility = (mon: Gen3Mon): number => abilityOf(mon.species, mon.abilityBit);

/** The species name in capitals, as the game names a Pokémon that has no nickname; "EGG" for an egg. */
export const defaultNickname = (dex: number, egg = false, name = ''): string => (egg ? 'EGG' : name.toUpperCase());

/** A brand-new Pokémon (the editor's "+ Add"), caught at its level in a Poké Ball by the given trainer. */
export function newMon(dex: number, level: number, trainer: { name: string; id: number; gender: 'male' | 'female' }, game: Gen3Game, pid: number, name: string): Gen3Mon {
  const raw = new Uint8Array(BOX_MON_SIZE);
  const base = baseStatsFor(dex);
  const mon: Gen3Mon = {
    pid: pid >>> 0, otId: trainer.id >>> 0, nickname: defaultNickname(dex, false, name), language: ENGLISH, otName: trainer.name, markings: 0,
    species: dex, item: 0, exp: expForLevel(growthOf(dex), level), ppUps: [0, 0, 0, 0], friendship: base?.friendship ?? 70,
    moves: [33, 0, 0, 0], pp: [35, 0, 0, 0], evs: { hp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0 }, contest: [0, 0, 0, 0, 0, 0],
    pokerus: 0, metLocation: 0x10, metLevel: level, metGame: game === 'emerald' ? 3 : 2, ball: 4, otGender: trainer.gender,
    ivs: { hp: 15, atk: 15, def: 15, spe: 15, spa: 15, spd: 15 }, isEgg: false, abilityBit: 0, ribbons: 0,
    level, status: 0, mail: 0xff, hp: 1, maxHp: 1, atk: 1, def: 1, spe: 1, spa: 1, spd: 1, raw,
  };
  recalcPartyStats(mon, true);
  return mon;
}

// ---------- items ----------

export interface BagItem { id: number; count: number }

function readItems(d: Uint8Array, off: number, max: number, key: number): BagItem[] {
  const out: BagItem[] = [];
  for (let i = 0; i < max; i++) {
    const id = u16(d, off + i * 4);
    if (!id) continue;
    out.push({ id, count: (u16(d, off + i * 4 + 2) ^ key) & 0xffff });
  }
  return out;
}

/** Items are written packed from the start; the rest of the pocket is cleared (id 0, quantity 0 under the key). A count
 * above the game's limit (from another editor) is kept rather than cut down behind the user's back. */
function writeItems(d: Uint8Array, off: number, items: BagItem[], max: number, key: number, maxCount: number): void {
  const list = items.filter((it) => it.id > 0).slice(0, max);
  for (let i = 0; i < max; i++) {
    const it = list[i];
    setU16(d, off + i * 4, it ? it.id : 0);
    setU16(d, off + i * 4 + 2, ((it ? clamp(it.count, 1, Math.max(maxCount, it.count)) : 0) ^ key) & 0xffff);
  }
}

/** True when two item lists hold the same things in the same order. */
const sameItems = (a: BagItem[], b: BagItem[]) => a.length === b.length && a.every((it, i) => it.id === b[i].id && it.count === b[i].count);

// ---------- the save ----------

export interface Gen3Options {
  textSpeed: number;
  frame: number;
  stereo: boolean;
  battleStyleSet: boolean;
  battleSceneOff: boolean;
  buttonMode: number;
}

export class Gen3Save implements EditableSave {
  readonly game: Gen3Game;
  trainerName: string;
  gender: 'male' | 'female';
  /** Trainer ID (shown on the trainer card) and the secret ID that comes with it. */
  trainerId: number;
  secretId: number;
  money: number;
  coins: number;
  playHours: number;
  playMinutes: number;
  playSeconds: number;
  options: Gen3Options;
  /** Bit i set for badge i+1 (Stone ... Rain). */
  badges: number;
  nationalDex: boolean;
  pockets: Record<Exclude<Pocket, 'tmhm'>, BagItem[]> & { tmhm: BagItem[] };
  pcItems: BagItem[];
  party: Gen3Mon[];
  /** 14 boxes of 30 slots; a box can have gaps, as in the game. */
  boxes: (Gen3Mon | null)[][];
  boxNames: string[];
  currentBoxIndex: number;
  dexOwned: Uint8Array;
  dexSeen: Uint8Array;

  private L: Layout;
  private original: Uint8Array;
  private slot: Slot;
  private sb2: Uint8Array;
  private sb1: Uint8Array;
  private storage: Uint8Array;
  private key: number;
  private loaded: { pockets: string; pcItems: string; boxNameRaw: Uint8Array[]; nameRaw: Uint8Array };

  constructor(data: Uint8Array, game?: Gen3Game) {
    if (data.length < SAVE_SIZE) throw new Error(`Gen 3 Pokémon saves are ${SAVE_SIZE.toLocaleString('en-US')} bytes (this file is ${data.length.toLocaleString('en-US')}).`);
    this.game = game ?? detectGen3(data) ?? 'rs';
    const L = this.L = GEN3_LAYOUTS[this.game];
    this.original = data.slice();
    const slot = validSlots(data, L)[0];
    if (!slot) throw new Error('Neither save slot in this file is complete. Load it in the game and save once, then try again.');
    this.slot = slot;
    const block = (from: number, to: number) => {
      const out = new Uint8Array((to - from + 1) * SECTOR_DATA);
      for (let id = from; id <= to; id++) out.set(data.subarray(slot.sectorOf[id] * SECTOR, slot.sectorOf[id] * SECTOR + SECTOR_DATA), (id - from) * SECTOR_DATA);
      return out;
    };
    const sb2 = this.sb2 = block(0, 0);
    const sb1 = this.sb1 = block(1, 4);
    const st = this.storage = block(5, 13);
    this.key = L.encrypted ? u32(sb2, SB2.key) : 0;
    const key16 = this.key & 0xffff;

    this.trainerName = decodeText(sb2.subarray(SB2.name, SB2.name + 8));
    this.gender = sb2[SB2.gender] ? 'female' : 'male';
    this.trainerId = u16(sb2, SB2.trainerId);
    this.secretId = u16(sb2, SB2.trainerId + 2);
    this.playHours = u16(sb2, SB2.playHours);
    this.playMinutes = sb2[SB2.playMinutes];
    this.playSeconds = sb2[SB2.playSeconds];
    const o = u16(sb2, SB2.options);
    this.options = {
      textSpeed: o & 7, frame: (o >> 3) & 31, stereo: !!(o & 0x100), battleStyleSet: !!(o & 0x200), battleSceneOff: !!(o & 0x400),
      buttonMode: sb2[SB2.buttonMode],
    };
    this.dexOwned = sb2.slice(SB2.dexOwned, SB2.dexOwned + DEX_BYTES);
    this.dexSeen = sb2.slice(SB2.dexSeen, SB2.dexSeen + DEX_BYTES);
    this.money = (u32(sb1, SB1.money) ^ this.key) >>> 0;
    this.coins = (u16(sb1, SB1.coins) ^ key16) & 0xffff;
    this.badges = 0;
    for (let i = 0; i < 8; i++) if (this.flag(L.badgeFlag + i)) this.badges |= 1 << i;
    this.nationalDex = sb2[SB2.nationalMagic] === NATIONAL_MAGIC && u16(sb1, L.vars + (VAR_NATIONAL_DEX - 0x4000) * 2) === 0x302
      && this.flag(L.nationalDexFlag);
    this.pockets = {
      item: readItems(sb1, L.items, L.itemsMax, key16),
      key: readItems(sb1, L.keyItems, L.keyItemsMax, key16),
      ball: readItems(sb1, L.balls, L.ballsMax, key16),
      tmhm: readItems(sb1, L.tmhm, L.tmhmMax, key16),
      berry: readItems(sb1, L.berries, L.berriesMax, key16),
    };
    this.pcItems = readItems(sb1, SB1.pcItems, PC_ITEMS_MAX, 0);

    const count = Math.min(sb1[SB1.partyCount], PARTY_MAX);
    this.party = [];
    for (let i = 0; i < count; i++) {
      const mon = readMon(sb1, SB1.party + i * PARTY_MON_SIZE, true);
      if (mon) this.party.push(mon);
    }
    this.currentBoxIndex = Math.min(st[STORAGE.currentBox], BOX_COUNT - 1);
    this.boxes = Array.from({ length: BOX_COUNT }, (_, b) => Array.from({ length: BOX_SLOTS }, (_, i) =>
      readMon(st, STORAGE.boxes + (b * BOX_SLOTS + i) * BOX_MON_SIZE, false)));
    const boxNameRaw = Array.from({ length: BOX_COUNT }, (_, i) => st.slice(STORAGE.names + i * 9, STORAGE.names + i * 9 + 9));
    this.boxNames = boxNameRaw.map(decodeText);
    this.loaded = {
      pockets: JSON.stringify(this.pockets), pcItems: JSON.stringify(this.pcItems), boxNameRaw,
      nameRaw: sb2.slice(SB2.name, SB2.name + 8),
    };
  }

  /** Which game a file is from, or null if it isn't a Gen 3 save this can read. */
  static detect(data: Uint8Array): Gen3Game | null {
    return detectGen3(data);
  }

  private flag(n: number): boolean {
    return !!(this.sb1[this.L.flags + (n >> 3)] & (1 << (n & 7)));
  }
  private setFlag(n: number, on: boolean): void {
    const i = this.L.flags + (n >> 3);
    this.sb1[i] = on ? this.sb1[i] | (1 << (n & 7)) : this.sb1[i] & ~(1 << (n & 7));
  }

  // ---- Pokédex (the four calls the shared Pokédex tab uses) ----

  private bit = (arr: Uint8Array, dex: number) => (arr[(dex - 1) >> 3] >> ((dex - 1) & 7)) & 1;
  private setBit(arr: Uint8Array, dex: number, on: boolean): void {
    const i = (dex - 1) >> 3, b = 1 << ((dex - 1) & 7);
    arr[i] = on ? arr[i] | b : arr[i] & ~b;
  }
  isOwned = (dex: number) => this.bit(this.dexOwned, dex);
  isSeen = (dex: number) => this.bit(this.dexSeen, dex);
  setOwned(dex: number, on: boolean): void {
    this.setBit(this.dexOwned, dex, on);
    if (on) this.setSeen(dex, true);
  }
  setSeen(dex: number, on: boolean): void {
    this.setBit(this.dexSeen, dex, on);
    if (!on) this.setOwned(dex, false);
  }

  summary(): SummaryLine[] {
    let owned = 0;
    for (let n = 1; n <= DEX_COUNT; n++) owned += this.isOwned(n);
    let badges = 0;
    for (let v = this.badges; v; v &= v - 1) badges++;
    return [
      { label: 'PLAYER', value: this.trainerName || '—' },
      { label: 'BADGES', value: String(badges) },
      { label: 'POKéDEX', value: String(owned) },
      { label: 'TIME', value: `${this.playHours}:${String(this.playMinutes).padStart(2, '0')}` },
    ];
  }

  describeChanges(before: EditableSave): ChangeGroup[] {
    return describeGen3Changes(before as Gen3Save, this);
  }

  serialize(): Uint8Array {
    const L = this.L;
    const sb2 = this.sb2.slice(), sb1 = this.sb1.slice(), st = this.storage.slice();
    const key16 = this.key & 0xffff;

    sb2.set(encodeText(this.trainerName, 8, this.loaded.nameRaw, PLAYER_NAME_MAX), SB2.name);
    sb2[SB2.gender] = this.gender === 'female' ? 1 : 0;
    setU16(sb2, SB2.trainerId, this.trainerId);
    setU16(sb2, SB2.trainerId + 2, this.secretId);
    setU16(sb2, SB2.playHours, clamp(this.playHours, 0, 999));
    sb2[SB2.playMinutes] = clamp(this.playMinutes, 0, 59);
    sb2[SB2.playSeconds] = clamp(this.playSeconds, 0, 59);
    const o = this.options;
    setU16(sb2, SB2.options, (u16(sb2, SB2.options) & ~0x7ff) | (o.textSpeed & 7) | ((o.frame & 31) << 3) | (o.stereo ? 0x100 : 0)
      | (o.battleStyleSet ? 0x200 : 0) | (o.battleSceneOff ? 0x400 : 0));
    sb2[SB2.buttonMode] = o.buttonMode;
    sb2.set(this.dexOwned, SB2.dexOwned);
    sb2.set(this.dexSeen, SB2.dexSeen);

    // The two copies of "seen" in SaveBlock1 must match the main one, or the game forgets the Pokémon.
    for (const at of L.seenCopies) sb1.set(this.dexSeen, at);
    setU32(sb1, SB1.money, (clamp(this.money, 0, MONEY_MAX) ^ this.key) >>> 0);
    setU16(sb1, SB1.coins, (clamp(this.coins, 0, COINS_MAX) ^ key16) & 0xffff);
    for (let i = 0; i < 8; i++) this.setFlagIn(sb1, L.badgeFlag + i, !!(this.badges & (1 << i)));

    const wasNational = sb2[SB2.nationalMagic] === NATIONAL_MAGIC && u16(sb1, L.vars + (VAR_NATIONAL_DEX - 0x4000) * 2) === 0x302;
    if (this.nationalDex && !wasNational) {
      // What the game does when Professor Birch upgrades the Pokédex (pokeemerald: EnableNationalPokedex).
      sb2[SB2.nationalMagic] = NATIONAL_MAGIC;
      setU16(sb1, L.vars + (VAR_NATIONAL_DEX - 0x4000) * 2, 0x302);
      this.setFlagIn(sb1, L.nationalDexFlag, true);
    } else if (!this.nationalDex && wasNational) {
      sb2[SB2.nationalMagic] = 0;
      setU16(sb1, L.vars + (VAR_NATIONAL_DEX - 0x4000) * 2, 0);
      this.setFlagIn(sb1, L.nationalDexFlag, false);
      sb2[SB2.dexMode] = 0;
    }

    // Pockets are rewritten only when they changed, so an unedited bag keeps its exact bytes (gaps and all).
    if (JSON.stringify(this.pockets) !== this.loaded.pockets) {
      writeItems(sb1, L.items, this.pockets.item, L.itemsMax, key16, 99);
      writeItems(sb1, L.keyItems, this.pockets.key, L.keyItemsMax, key16, 99);
      writeItems(sb1, L.balls, this.pockets.ball, L.ballsMax, key16, 99);
      writeItems(sb1, L.tmhm, this.pockets.tmhm, L.tmhmMax, key16, 99);
      writeItems(sb1, L.berries, this.pockets.berry, L.berriesMax, key16, 999);
    }
    if (JSON.stringify(this.pcItems) !== this.loaded.pcItems) writeItems(sb1, SB1.pcItems, this.pcItems, PC_ITEMS_MAX, 0, 999);

    const party = this.party.slice(0, PARTY_MAX);
    sb1[SB1.partyCount] = party.length;
    party.forEach((mon, i) => writeMon(sb1, SB1.party + i * PARTY_MON_SIZE, mon, true));
    // Slots past the end of the party are emptied, as the game does.
    for (let i = party.length; i < Math.min(this.sb1[SB1.partyCount], PARTY_MAX); i++) {
      sb1.fill(0, SB1.party + i * PARTY_MON_SIZE, SB1.party + (i + 1) * PARTY_MON_SIZE);
    }

    st[STORAGE.currentBox] = this.currentBoxIndex;
    this.boxes.forEach((box, b) => box.forEach((mon, i) => {
      const off = STORAGE.boxes + (b * BOX_SLOTS + i) * BOX_MON_SIZE;
      if (mon) writeMon(st, off, mon, false);
      else if (readMon(this.storage, off, false)) st.fill(0, off, off + BOX_MON_SIZE);
    }));
    this.boxNames.forEach((name, i) => st.set(encodeText(name, 9, this.loaded.boxNameRaw[i], BOX_NAME_LEN), STORAGE.names + i * 9));

    // Back into the sectors of the slot it came from, with fresh checksums.
    const d = this.original.slice();
    const put = (blockData: Uint8Array, from: number, to: number) => {
      for (let id = from; id <= to; id++) {
        const at = this.slot.sectorOf[id] * SECTOR;
        const size = sectorSize(L, id);
        d.set(blockData.subarray((id - from) * SECTOR_DATA, (id - from) * SECTOR_DATA + size), at);
        setU16(d, at + 0xff6, sectorChecksum(d, at, size));
      }
    };
    put(sb2, 0, 0);
    put(sb1, 1, 4);
    put(st, 5, 13);
    return d;
  }

  private setFlagIn(sb1: Uint8Array, n: number, on: boolean): void {
    const i = this.L.flags + (n >> 3);
    sb1[i] = on ? sb1[i] | (1 << (n & 7)) : sb1[i] & ~(1 << (n & 7));
  }

  /** The bag's TM/HM pocket as a count per TM (0-49) and HM (50-57), the way the editor shows it. */
  tmCounts(): number[] {
    const counts = new Array(TM_COUNT + HM_COUNT).fill(0);
    for (const it of this.pockets.tmhm) if (it.id >= TM01 && it.id < TM01 + counts.length) counts[it.id - TM01] = it.count;
    return counts;
  }

  /** Set the TM/HM pocket from counts, keeping the order the pocket already had for the ones still there. */
  setTmCounts(counts: number[]): void {
    const kept = this.pockets.tmhm.filter((it) => counts[it.id - TM01] > 0).map((it) => ({ id: it.id, count: counts[it.id - TM01] }));
    const added = counts.map((n, i) => ({ id: TM01 + i, count: n })).filter((it) => it.count > 0 && !kept.some((k) => k.id === it.id));
    this.pockets.tmhm = [...kept, ...added];
  }
}

export { sameItems };
