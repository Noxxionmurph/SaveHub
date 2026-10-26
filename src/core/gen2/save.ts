// Gen 2 (Gold / Silver, English) save file model.
// Layout: pret/pokegold (ram/sram.asm, ram/wram.asm and the addresses in its pokegold.sym), checked against a real
// Gold save. Gold and Silver share every address.
//
// The file is the cartridge's 32 KB of battery RAM, four 8 KB banks:
//   bank 0  party mail, mailbox, and the first half of the backup copy of the game
//   bank 1  options and the game itself (0x2000-0x2D6B, one checksum), the PC box that is open, Hall of Fame,
//           and more of the backup
//   bank 2  PC boxes 1-7        bank 3  PC boxes 8-14, then the rest of the backup and its checksum
// The game loads the main copy if its checksum and two check bytes are right, and the backup otherwise. On save it
// writes both, so this does too: once anything has changed, the backup is refreshed from the main copy.

import type { ChangeGroup, EditableSave, SummaryLine } from '../types.ts';
import {
  DEX_COUNT, EGG_SPECIES, HM_COUNT, TM_COUNT, baseStatsFor, hpDv, maxPp, speciesName, type Dvs,
} from './data.ts';
import { describeGen2Changes } from './diff.ts';
import { decodeText, encodeText } from './text.ts';

export const SAVE_SIZE = 0x8000;

const OFF = {
  options: 0x2000, // wOptions: bits 0-2 text speed, 5 stereo, 6 battle style Set, 7 battle scene off
  textboxFrame: 0x2002, // 0-7, shown as frame TYPE 1-8
  textboxFlags: 0x2003,
  printShade: 0x2004, // wGBPrinterBrightness
  options2: 0x2005, // bit 0: menu account on
  checkValue1: 0x2008, // always 99
  gameData: 0x2009, // the checksum covers 0x2009 up to (not including) 0x2D69
  playerId: 0x2009, // u16 big-endian
  playerName: 0x200b,
  momName: 0x2016,
  rivalName: 0x2021,
  gameTimeCap: 0x2052, // bit 0: the clock stopped at 999:59:59
  playHours: 0x2053, // u16 big-endian
  playMinutes: 0x2055,
  playSeconds: 0x2056,
  playFrames: 0x2057,
  money: 0x23db, // 3 bytes, big-endian binary (not BCD as in Gen 1)
  momsMoney: 0x23de,
  coins: 0x23e2, // u16 big-endian
  johtoBadges: 0x23e4,
  kantoBadges: 0x23e5,
  tmhm: 0x23e6, // one count per TM (50) and HM (7)
  items: 0x241f, // count, 20 × (id, qty), 0xFF
  keyItems: 0x2449, // count, 25 × id, 0xFF
  balls: 0x2464, // count, 12 × (id, qty), 0xFF
  pcItems: 0x247e, // count, 50 × (id, qty), 0xFF
  curBox: 0x2724,
  boxNames: 0x2727, // 14 × 9
  party: 0x288a, // count, 6 species + 0xFF, 6 × 48 mons, 6 × 11 OT names, 6 × 11 nicknames
  dexCaught: 0x2a4c, // 32 bytes, one bit per species
  dexSeen: 0x2a6c,
  checksum: 0x2d69, // u16 little-endian: the byte sum of 0x2009-0x2D68
  checkValue2: 0x2d6b, // always 127
  currentBox: 0x2d6c, // the open PC box (its own slot in the box banks is only updated when you change box)
  partyMail: 0x0600, // 6 × 47 bytes, then the same again as a backup
  partyMailBackup: 0x071a,
} as const;
/** The save offsets, for scripts/verify-gen2-against-rom.mjs to check against a ROM. */
export const GEN2_OFFSETS = OFF;

const CHECK_VALUE_1 = 99;
const CHECK_VALUE_2 = 127;

/**
 * Where the game keeps its backup copy: each piece of the main data (start, end) and where its copy goes. The backup
 * checksum is the byte sum of the copies, which is the same as the main checksum.
 */
const BACKUP: readonly [from: number, to: number, at: number][] = [
  [0x2000, 0x2009, 0x7e30], // options and the first check byte
  [0x2009, 0x222f, 0x15c7], // wPlayerData1
  [0x222f, 0x23d9, 0x3d96], // wPlayerData2
  [0x23d9, 0x2856, 0x0c6b], // wPlayerData3
  [0x2856, 0x288a, 0x7e39], // wCurMapData
  [0x288a, 0x2d69, 0x10e8], // wPokemonData
];
const BACKUP_CHECKSUM = 0x7e6d;
const BACKUP_CHECK_VALUE_2 = 0x7e6f;

const NAME_LEN = 11;
/** The game keeps a player's name to 7 characters and a box's to 8. */
export const PLAYER_NAME_MAX = 7;
export const BOX_NAME_LEN = 9;
const PARTY_MON_SIZE = 48;
const BOX_MON_SIZE = 32;
const MAIL_SIZE = 47;
export const PARTY_MAX = 6;
export const BOX_MAX = 20;
export const BOX_COUNT = 14;
const BOX_BYTES = 0x450;
const BOXES_PER_BANK = 7;
export const BAG_MAX = { items: 20, keyItems: 25, balls: 12, pcItems: 50 } as const;
export const DEX_BYTES = 32;
export const MONEY_MAX = 999999;
export const COINS_MAX = 9999;

export interface Gen2Options {
  /** Bits 0-2: 1 / 3 / 5 are the menu's Fast, Mid and Slow; anything else is kept as it was. */
  textSpeed: number;
  battleSceneOff: boolean;
  battleStyleSet: boolean;
  stereo: boolean;
  /** 0-7, the menu's frame TYPE 1-8. */
  frame: number;
  /** The PRINT option, one of PRINT_SHADES (other values are kept). */
  printShade: number;
  menuAccount: boolean;
}

export interface Stats { hp: number; atk: number; def: number; spe: number; spa: number; spd: number }

export interface Gen2Mon {
  species: number;
  /** True when the party or box list marks this one as an egg (the species is what will hatch). */
  isEgg: boolean;
  item: number;
  moves: [number, number, number, number];
  otId: number;
  exp: number;
  /** Stat experience: HP, Attack, Defense, Speed and Special (Special Attack and Special Defense share one). */
  evs: { hp: number; atk: number; def: number; spe: number; spc: number };
  dvs: Dvs;
  pp: [number, number, number, number];
  ppUps: [number, number, number, number];
  /** Friendship (happiness). For an egg, the egg cycles left before it hatches. */
  friendship: number;
  pokerus: number;
  /** Two bytes Gold and Silver never use (Crystal records where a Pokémon was caught there); kept as they are. */
  unused: [number, number];
  level: number;
  nickname: string;
  otName: string;
  nickRaw?: Uint8Array;
  otRaw?: Uint8Array;
  // Party Pokémon only: the rest of the 48-byte entry.
  status: number;
  partyUnused: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spe: number;
  spa: number;
  spd: number;
  /** The letter a party Pokémon holding Mail carries (the game files it by party position, so it moves with the Pokémon). */
  mail?: Uint8Array;
}

export interface BagItem {
  id: number;
  count: number;
}

// ---------- helpers ----------

const u16 = (d: Uint8Array, o: number) => (d[o] << 8) | d[o + 1];
const setU16 = (d: Uint8Array, o: number, v: number) => { d[o] = (v >> 8) & 0xff; d[o + 1] = v & 0xff; };
const u24 = (d: Uint8Array, o: number) => (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
const setU24 = (d: Uint8Array, o: number, v: number) => { d[o] = (v >> 16) & 0xff; d[o + 1] = (v >> 8) & 0xff; d[o + 2] = v & 0xff; };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v)));

/** The game's checksum (pokegold: Checksum): a 16-bit sum of the bytes. */
export function sum16(d: Uint8Array, start: number, end: number): number {
  let s = 0;
  for (let i = start; i < end; i++) s = (s + d[i]) & 0xffff;
  return s;
}

/** Gen 2 stat formula. Special Attack and Special Defense both use the Special DV and Special stat experience. */
export function calcStats(species: number, level: number, dvs: Dvs, evs: Gen2Mon['evs']): Stats | null {
  const base = baseStatsFor(species);
  if (!base) return null;
  const evBonus = (ev: number) => Math.floor(Math.min(255, Math.ceil(Math.sqrt(ev))) / 4);
  const stat = (b: number, dv: number, ev: number) => Math.floor((((b + dv) * 2 + evBonus(ev)) * level) / 100) + 5;
  return {
    hp: Math.floor((((base.hp + hpDv(dvs)) * 2 + evBonus(evs.hp)) * level) / 100) + level + 10,
    atk: stat(base.atk, dvs.atk, evs.atk),
    def: stat(base.def, dvs.def, evs.def),
    spe: stat(base.spe, dvs.spe, evs.spe),
    spa: stat(base.spa, dvs.spc, evs.spc),
    spd: stat(base.spd, dvs.spc, evs.spc),
  };
}

/** Recalculate a party Pokémon's stored stats from its species, level, DVs and stat experience (and keep HP in range). */
export function recalcPartyStats(mon: Gen2Mon, heal = false): void {
  const s = calcStats(mon.species, mon.level, mon.dvs, mon.evs);
  if (!s) return;
  mon.maxHp = s.hp; mon.atk = s.atk; mon.def = s.def; mon.spe = s.spe; mon.spa = s.spa; mon.spd = s.spd;
  mon.hp = mon.isEgg ? 0 : heal ? s.hp : Math.min(mon.hp, s.hp);
}

/** What the game does when a Pokémon comes out of the PC (pokegold: SendGetMonIntoFromBox): stats worked out, HP full, status cleared. */
export function withdrawFromBox(mon: Gen2Mon): void {
  mon.status = 0;
  recalcPartyStats(mon, true);
}

/** What the game does when a Pokémon goes into the PC (pokegold: RestorePPOfDepositedPokemon): its PP is refilled. */
export function depositInBox(mon: Gen2Mon): void {
  mon.pp = mon.moves.map((m, i) => maxPp(m, mon.ppUps[i])) as Gen2Mon['pp'];
  delete mon.mail;
}

/** Gen 2 stores the (uppercase) species name as the default nickname, and "EGG" for an egg. */
export const defaultNickname = (species: number, egg = false) => (egg ? 'EGG' : speciesName(species).toUpperCase());

export function newMon(species: number, level = 5): Gen2Mon {
  const mon: Gen2Mon = {
    species, isEgg: false, item: 0, moves: [33, 0, 0, 0], otId: 0, exp: 0,
    evs: { hp: 0, atk: 0, def: 0, spe: 0, spc: 0 }, dvs: { atk: 8, def: 8, spe: 8, spc: 8 },
    pp: [35, 0, 0, 0], ppUps: [0, 0, 0, 0], friendship: 70, pokerus: 0, unused: [0, 0], level,
    nickname: defaultNickname(species), otName: '',
    status: 0, partyUnused: 0, hp: 1, maxHp: 1, atk: 1, def: 1, spe: 1, spa: 1, spd: 1,
  };
  recalcPartyStats(mon, true);
  return mon;
}

// ---------- (de)serialisation of one Pokémon ----------

function readMon(d: Uint8Array, off: number, party: boolean, listSpecies: number, otRaw: Uint8Array, nickRaw: Uint8Array): Gen2Mon {
  const mon: Gen2Mon = {
    species: d[off],
    isEgg: listSpecies === EGG_SPECIES,
    item: d[off + 1],
    moves: [d[off + 2], d[off + 3], d[off + 4], d[off + 5]],
    otId: u16(d, off + 6),
    exp: u24(d, off + 8),
    evs: { hp: u16(d, off + 11), atk: u16(d, off + 13), def: u16(d, off + 15), spe: u16(d, off + 17), spc: u16(d, off + 19) },
    dvs: { atk: d[off + 21] >> 4, def: d[off + 21] & 0xf, spe: d[off + 22] >> 4, spc: d[off + 22] & 0xf },
    pp: [d[off + 23] & 0x3f, d[off + 24] & 0x3f, d[off + 25] & 0x3f, d[off + 26] & 0x3f],
    ppUps: [d[off + 23] >> 6, d[off + 24] >> 6, d[off + 25] >> 6, d[off + 26] >> 6],
    friendship: d[off + 27],
    pokerus: d[off + 28],
    unused: [d[off + 29], d[off + 30]],
    level: d[off + 31],
    nickname: decodeText(nickRaw),
    otName: decodeText(otRaw),
    nickRaw, otRaw,
    status: 0, partyUnused: 0, hp: 0, maxHp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0,
  };
  if (party) {
    mon.status = d[off + 32];
    mon.partyUnused = d[off + 33];
    mon.hp = u16(d, off + 34);
    mon.maxHp = u16(d, off + 36);
    mon.atk = u16(d, off + 38);
    mon.def = u16(d, off + 40);
    mon.spe = u16(d, off + 42);
    mon.spa = u16(d, off + 44);
    mon.spd = u16(d, off + 46);
  }
  return mon;
}

function writeMon(d: Uint8Array, off: number, mon: Gen2Mon, party: boolean): void {
  d[off] = mon.species;
  d[off + 1] = mon.item;
  for (let i = 0; i < 4; i++) d[off + 2 + i] = mon.moves[i];
  setU16(d, off + 6, mon.otId);
  setU24(d, off + 8, clamp(mon.exp, 0, 0xffffff));
  setU16(d, off + 11, mon.evs.hp);
  setU16(d, off + 13, mon.evs.atk);
  setU16(d, off + 15, mon.evs.def);
  setU16(d, off + 17, mon.evs.spe);
  setU16(d, off + 19, mon.evs.spc);
  d[off + 21] = ((mon.dvs.atk & 0xf) << 4) | (mon.dvs.def & 0xf);
  d[off + 22] = ((mon.dvs.spe & 0xf) << 4) | (mon.dvs.spc & 0xf);
  for (let i = 0; i < 4; i++) d[off + 23 + i] = ((mon.ppUps[i] & 3) << 6) | (mon.pp[i] & 0x3f);
  d[off + 27] = mon.friendship & 0xff;
  d[off + 28] = mon.pokerus & 0xff;
  d[off + 29] = mon.unused[0];
  d[off + 30] = mon.unused[1];
  d[off + 31] = mon.level;
  if (party) {
    d[off + 32] = mon.status;
    d[off + 33] = mon.partyUnused;
    setU16(d, off + 34, mon.hp);
    setU16(d, off + 36, mon.maxHp);
    setU16(d, off + 38, mon.atk);
    setU16(d, off + 40, mon.def);
    setU16(d, off + 42, mon.spe);
    setU16(d, off + 44, mon.spa);
    setU16(d, off + 46, mon.spd);
  }
}

/** Where each part of a party or box list starts. */
function listLayout(base: number, party: boolean) {
  const max = party ? PARTY_MAX : BOX_MAX;
  const size = party ? PARTY_MON_SIZE : BOX_MON_SIZE;
  const monsAt = base + 1 + max + 1;
  const otAt = monsAt + max * size;
  return { max, size, monsAt, otAt, nickAt: otAt + max * NAME_LEN };
}

function readMonList(d: Uint8Array, base: number, party: boolean): Gen2Mon[] {
  const { max, size, monsAt, otAt, nickAt } = listLayout(base, party);
  const count = Math.min(d[base], max);
  const out: Gen2Mon[] = [];
  for (let i = 0; i < count; i++) {
    out.push(readMon(d, monsAt + i * size, party, d[base + 1 + i],
      d.slice(otAt + i * NAME_LEN, otAt + (i + 1) * NAME_LEN), d.slice(nickAt + i * NAME_LEN, nickAt + (i + 1) * NAME_LEN)));
  }
  return out;
}

function writeMonList(d: Uint8Array, base: number, mons: Gen2Mon[], party: boolean): void {
  const { max, size, monsAt, otAt, nickAt } = listLayout(base, party);
  // Only slots in use are written; whatever the game left in unused slots stays, so an unedited save round-trips.
  const list = mons.slice(0, max);
  d[base] = list.length;
  list.forEach((mon, i) => {
    d[base + 1 + i] = mon.isEgg ? EGG_SPECIES : mon.species;
    writeMon(d, monsAt + i * size, mon, party);
    // Original trainer names are padded with zeros after the end marker, nicknames with more end markers (as the game does).
    d.set(encodeText(mon.otName, NAME_LEN, mon.otRaw, 0), otAt + i * NAME_LEN);
    d.set(encodeText(mon.nickname, NAME_LEN, mon.nickRaw), nickAt + i * NAME_LEN);
  });
  d[base + 1 + list.length] = 0xff;
}

function readItems(d: Uint8Array, base: number, max: number): BagItem[] {
  const count = Math.min(d[base], max);
  const items: BagItem[] = [];
  for (let i = 0; i < count; i++) items.push({ id: d[base + 1 + i * 2], count: d[base + 2 + i * 2] });
  return items;
}

function writeItems(d: Uint8Array, base: number, items: BagItem[], max: number): void {
  const list = items.filter((it) => it.id !== 0 && it.id !== 0xff).slice(0, max);
  d[base] = list.length;
  list.forEach((it, i) => {
    d[base + 1 + i * 2] = it.id;
    d[base + 2 + i * 2] = clamp(it.count, 1, 99);
  });
  d[base + 1 + list.length * 2] = 0xff;
}

// ---------- the save ----------

export class Gen2Save implements EditableSave {
  trainerName: string;
  rivalName: string;
  momName: string;
  trainerId: number;
  money: number;
  momsMoney: number;
  coins: number;
  johtoBadges: number;
  kantoBadges: number;
  options: Gen2Options;
  playHours: number;
  playMinutes: number;
  playSeconds: number;
  currentBoxIndex: number;
  boxNames: string[];
  items: BagItem[];
  keyItems: number[];
  balls: BagItem[];
  /** How many of each TM (0-49) and HM (50-56) you carry. */
  tmhm: number[];
  pcItems: BagItem[];
  party: Gen2Mon[];
  boxes: Gen2Mon[][];
  dexCaught: Uint8Array;
  dexSeen: Uint8Array;

  private original: Uint8Array;
  private raw: { name: Uint8Array; rival: Uint8Array; mom: Uint8Array; boxNames: Uint8Array[] };

  constructor(data: Uint8Array) {
    if (data.length < SAVE_SIZE) throw new Error(`Gold and Silver saves are ${SAVE_SIZE.toLocaleString('en-US')} bytes (this file is ${data.length.toLocaleString('en-US')}).`);
    this.original = data.slice();
    const d = this.original;
    this.raw = {
      name: d.slice(OFF.playerName, OFF.playerName + NAME_LEN),
      rival: d.slice(OFF.rivalName, OFF.rivalName + NAME_LEN),
      mom: d.slice(OFF.momName, OFF.momName + NAME_LEN),
      boxNames: Array.from({ length: BOX_COUNT }, (_, i) => d.slice(OFF.boxNames + i * BOX_NAME_LEN, OFF.boxNames + (i + 1) * BOX_NAME_LEN)),
    };
    this.trainerName = decodeText(this.raw.name);
    this.rivalName = decodeText(this.raw.rival);
    this.momName = decodeText(this.raw.mom);
    this.boxNames = this.raw.boxNames.map(decodeText);
    this.trainerId = u16(d, OFF.playerId);
    this.money = u24(d, OFF.money);
    this.momsMoney = u24(d, OFF.momsMoney);
    this.coins = u16(d, OFF.coins);
    this.johtoBadges = d[OFF.johtoBadges];
    this.kantoBadges = d[OFF.kantoBadges];
    const o = d[OFF.options];
    this.options = {
      textSpeed: o & 7, stereo: !!(o & 0x20), battleStyleSet: !!(o & 0x40), battleSceneOff: !!(o & 0x80),
      frame: d[OFF.textboxFrame] & 7, printShade: d[OFF.printShade], menuAccount: !!(d[OFF.options2] & 1),
    };
    this.playHours = u16(d, OFF.playHours);
    this.playMinutes = d[OFF.playMinutes];
    this.playSeconds = d[OFF.playSeconds];
    this.currentBoxIndex = Math.min(d[OFF.curBox], BOX_COUNT - 1);
    this.items = readItems(d, OFF.items, BAG_MAX.items);
    this.balls = readItems(d, OFF.balls, BAG_MAX.balls);
    this.pcItems = readItems(d, OFF.pcItems, BAG_MAX.pcItems);
    this.keyItems = Array.from(d.slice(OFF.keyItems + 1, OFF.keyItems + 1 + Math.min(d[OFF.keyItems], BAG_MAX.keyItems)));
    this.tmhm = Array.from(d.slice(OFF.tmhm, OFF.tmhm + TM_COUNT + HM_COUNT));
    this.dexCaught = d.slice(OFF.dexCaught, OFF.dexCaught + DEX_BYTES);
    this.dexSeen = d.slice(OFF.dexSeen, OFF.dexSeen + DEX_BYTES);
    this.party = readMonList(d, OFF.party, true);
    this.party.forEach((mon, i) => { mon.mail = d.slice(OFF.partyMail + i * MAIL_SIZE, OFF.partyMail + (i + 1) * MAIL_SIZE); });
    this.boxes = Array.from({ length: BOX_COUNT }, (_, i) =>
      readMonList(d, i === this.currentBoxIndex ? OFF.currentBox : Gen2Save.boxOffset(i), false));
  }

  static boxOffset(i: number): number {
    return (i < BOXES_PER_BANK ? 0x4000 : 0x6000) + (i % BOXES_PER_BANK) * BOX_BYTES;
  }

  /** The main copy is the one the game loads: both check bytes in place and the checksum right. */
  static mainValid(data: Uint8Array): boolean {
    return data.length >= SAVE_SIZE && data[OFF.checkValue1] === CHECK_VALUE_1 && data[OFF.checkValue2] === CHECK_VALUE_2
      && (data[OFF.checksum] | (data[OFF.checksum + 1] << 8)) === sum16(data, OFF.gameData, OFF.checksum);
  }

  private bit = (arr: Uint8Array, dex: number) => (arr[(dex - 1) >> 3] >> ((dex - 1) & 7)) & 1;
  private setBit(arr: Uint8Array, dex: number, on: boolean): void {
    const i = (dex - 1) >> 3, b = 1 << ((dex - 1) & 7);
    arr[i] = on ? arr[i] | b : arr[i] & ~b;
  }
  isOwned = (dex: number) => this.bit(this.dexCaught, dex);
  isSeen = (dex: number) => this.bit(this.dexSeen, dex);
  setOwned(dex: number, on: boolean): void {
    this.setBit(this.dexCaught, dex, on);
    if (on) this.setSeen(dex, true);
  }
  setSeen(dex: number, on: boolean): void {
    this.setBit(this.dexSeen, dex, on);
    if (!on) this.setOwned(dex, false);
  }

  /** The rows the game's own save window shows (PLAYER, BADGES, POKéDEX, TIME), for the top of the review dialog. */
  summary(): SummaryLine[] {
    const pop = (n: number) => { let c = 0; for (let v = n & 0xff; v; v &= v - 1) c++; return c; };
    let owned = 0;
    for (let n = 1; n <= DEX_COUNT; n++) owned += this.isOwned(n);
    return [
      { label: 'PLAYER', value: this.trainerName || '—' },
      { label: 'BADGES', value: String(pop(this.johtoBadges) + pop(this.kantoBadges)) },
      { label: 'POKéDEX', value: String(owned) },
      { label: 'TIME', value: `${this.playHours}:${String(this.playMinutes).padStart(2, '0')}` },
    ];
  }

  describeChanges(before: EditableSave): ChangeGroup[] {
    return describeGen2Changes(before as Gen2Save, this);
  }

  serialize(): Uint8Array {
    const d = this.original.slice();

    d[OFF.options] = (d[OFF.options] & 0x18) | (this.options.textSpeed & 7) | (this.options.stereo ? 0x20 : 0)
      | (this.options.battleStyleSet ? 0x40 : 0) | (this.options.battleSceneOff ? 0x80 : 0);
    d[OFF.textboxFrame] = (d[OFF.textboxFrame] & ~7) | (this.options.frame & 7);
    d[OFF.printShade] = this.options.printShade & 0xff;
    d[OFF.options2] = (d[OFF.options2] & ~1) | (this.options.menuAccount ? 1 : 0);

    setU16(d, OFF.playerId, this.trainerId & 0xffff);
    d.set(encodeText(this.trainerName, NAME_LEN, this.raw.name, 0), OFF.playerName);
    d.set(encodeText(this.momName, NAME_LEN, this.raw.mom, 0), OFF.momName);
    d.set(encodeText(this.rivalName, NAME_LEN, this.raw.rival, 0), OFF.rivalName);
    const hours = clamp(this.playHours, 0, 999);
    if (hours !== u16(this.original, OFF.playHours) || this.playMinutes !== this.original[OFF.playMinutes]) {
      // A clock that was stopped at 999:59:59 starts again once it is below that.
      if (hours < 999 || this.playMinutes < 59) d[OFF.gameTimeCap] &= ~1;
    }
    setU16(d, OFF.playHours, hours);
    d[OFF.playMinutes] = clamp(this.playMinutes, 0, 59);
    d[OFF.playSeconds] = clamp(this.playSeconds, 0, 59);
    setU24(d, OFF.money, clamp(this.money, 0, MONEY_MAX));
    setU24(d, OFF.momsMoney, clamp(this.momsMoney, 0, MONEY_MAX));
    setU16(d, OFF.coins, clamp(this.coins, 0, COINS_MAX));
    d[OFF.johtoBadges] = this.johtoBadges & 0xff;
    d[OFF.kantoBadges] = this.kantoBadges & 0xff;

    this.tmhm.forEach((n, i) => { d[OFF.tmhm + i] = clamp(n, 0, i < TM_COUNT ? 99 : 1); });
    writeItems(d, OFF.items, this.items, BAG_MAX.items);
    writeItems(d, OFF.balls, this.balls, BAG_MAX.balls);
    writeItems(d, OFF.pcItems, this.pcItems, BAG_MAX.pcItems);
    const keys = this.keyItems.filter((id) => id !== 0 && id !== 0xff).slice(0, BAG_MAX.keyItems);
    d[OFF.keyItems] = keys.length;
    d.set(keys, OFF.keyItems + 1);
    d[OFF.keyItems + 1 + keys.length] = 0xff;

    this.boxNames.forEach((name, i) => d.set(encodeText(name, BOX_NAME_LEN, this.raw.boxNames[i], 0), OFF.boxNames + i * BOX_NAME_LEN));
    d.set(this.dexCaught, OFF.dexCaught);
    d.set(this.dexSeen, OFF.dexSeen);

    writeMonList(d, OFF.party, this.party, true);
    d[OFF.curBox] = this.currentBoxIndex;
    for (let i = 0; i < BOX_COUNT; i++) {
      writeMonList(d, i === this.currentBoxIndex ? OFF.currentBox : Gen2Save.boxOffset(i), this.boxes[i] ?? [], false);
    }

    // Mail travels with the party Pokémon that holds it; the game keeps a second copy right after the first.
    this.party.forEach((mon, i) => {
      if (!mon.mail) return;
      d.set(mon.mail, OFF.partyMail + i * MAIL_SIZE);
      d.set(mon.mail, OFF.partyMailBackup + i * MAIL_SIZE);
    });

    const sum = sum16(d, OFF.gameData, OFF.checksum);
    d[OFF.checksum] = sum & 0xff;
    d[OFF.checksum + 1] = sum >> 8;

    // The backup copy, refreshed only when the main copy changed (so an unedited file comes back byte for byte).
    let changed = false;
    for (let i = OFF.options; i < OFF.checkValue2 + 1 && !changed; i++) changed = d[i] !== this.original[i];
    if (changed) {
      for (const [from, to, at] of BACKUP) d.set(d.subarray(from, to), at);
      d[BACKUP_CHECKSUM] = sum & 0xff;
      d[BACKUP_CHECKSUM + 1] = sum >> 8;
      d[BACKUP_CHECK_VALUE_2] = CHECK_VALUE_2;
    }
    return d;
  }
}
