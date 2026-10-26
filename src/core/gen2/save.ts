// Gen 2 (Gold / Silver / Crystal, English) save file model.
// Layout: pret/pokegold and pret/pokecrystal (ram/sram.asm, ram/wram.asm and the addresses in their .sym files), checked
// against a real Gold save and a real Crystal save. Gold and Silver share every address; Crystal moved most of them.
//
// The file is the cartridge's 32 KB of battery RAM, four 8 KB banks:
//   bank 0  party mail, mailbox, and (Gold, Silver) the first half of the backup copy of the game, or (Crystal) all of it
//   bank 1  options and the game itself (one checksum), the PC box that is open, Hall of Fame, and in Gold and Silver
//           more of the backup
//   bank 2  PC boxes 1-7        bank 3  PC boxes 8-14, then (Gold, Silver) the rest of the backup and its checksum
// The game loads the main copy if its checksum and two check bytes are right, and the backup otherwise. On save it
// writes both, so this does too: once anything has changed, the backup is refreshed from the main copy.

import type { ChangeGroup, EditableSave, SummaryLine } from '../types.ts';
import {
  DEX_COUNT, EGG_SPECIES, HM_COUNT, TM_COUNT, baseStatsFor, hpDv, maxPp, speciesName, type Dvs,
} from './data.ts';
import { describeGen2Changes } from './diff.ts';
import { decodeText, encodeText } from './text.ts';

export const SAVE_SIZE = 0x8000;

/** Which cartridge wrote the save: Gold and Silver share one layout, Crystal moved most things a few bytes. */
export type Gen2Game = 'gs' | 'crystal';

interface Layout {
  options: number; // wOptions: bits 0-2 text speed, 5 stereo, 6 battle style Set, 7 battle scene off
  textboxFrame: number; // 0-7, shown as frame TYPE 1-8
  textboxFlags: number;
  printShade: number; // wGBPrinterBrightness
  options2: number; // bit 0: menu account on
  checkValue1: number; // always 99
  gameData: number; // the checksum covers gameData up to (not including) gameDataEnd
  gameDataEnd: number;
  playerId: number; // u16 big-endian
  playerName: number;
  momName: number;
  rivalName: number;
  gameTimeCap: number; // bit 0: the clock stopped at 999:59:59
  playHours: number; // u16 big-endian
  playMinutes: number;
  playSeconds: number;
  money: number; // 3 bytes, big-endian binary (not BCD as in Gen 1)
  momsMoney: number;
  coins: number; // u16 big-endian
  johtoBadges: number;
  kantoBadges: number;
  tmhm: number; // one count per TM (50) and HM (7)
  items: number; // count, 20 × (id, qty), 0xFF
  keyItems: number; // count, 25 × id, 0xFF
  balls: number; // count, 12 × (id, qty), 0xFF
  pcItems: number; // count, 50 × (id, qty), 0xFF
  curBox: number;
  boxNames: number; // 14 × 9
  party: number; // count, 6 species + 0xFF, 6 × 48 mons, 6 × 11 OT names, 6 × 11 nicknames
  dexCaught: number; // 32 bytes, one bit per species
  dexSeen: number;
  checksum: number; // u16 little-endian: the byte sum of the game data
  checkValue2: number; // always 127
  currentBox: number; // the open PC box (its own slot in the box banks is only updated when you change box)
  partyMail: number; // 6 × 47 bytes, then the same again as a backup
  partyMailBackup: number;
  /** Crystal only: wPlayerGender (bit 0 set for a girl), kept outside the checksummed data. */
  playerGender?: number;
  /**
   * Where the game keeps its backup copy: each piece of the main data (start, end) and where its copy goes. The backup
   * checksum is the byte sum of the copies, which is the same as the main checksum.
   */
  backup: readonly [from: number, to: number, at: number][];
  backupChecksum: number;
  backupCheckValue2: number;
}

const GOLD: Layout = {
  options: 0x2000, textboxFrame: 0x2002, textboxFlags: 0x2003, printShade: 0x2004, options2: 0x2005, checkValue1: 0x2008,
  gameData: 0x2009, gameDataEnd: 0x2d69,
  playerId: 0x2009, playerName: 0x200b, momName: 0x2016, rivalName: 0x2021,
  gameTimeCap: 0x2052, playHours: 0x2053, playMinutes: 0x2055, playSeconds: 0x2056,
  money: 0x23db, momsMoney: 0x23de, coins: 0x23e2, johtoBadges: 0x23e4, kantoBadges: 0x23e5, tmhm: 0x23e6,
  items: 0x241f, keyItems: 0x2449, balls: 0x2464, pcItems: 0x247e,
  curBox: 0x2724, boxNames: 0x2727, party: 0x288a, dexCaught: 0x2a4c, dexSeen: 0x2a6c,
  checksum: 0x2d69, checkValue2: 0x2d6b, currentBox: 0x2d6c, partyMail: 0x0600, partyMailBackup: 0x071a,
  backup: [
    [0x2000, 0x2009, 0x7e30], // options and the first check byte
    [0x2009, 0x222f, 0x15c7], // wPlayerData1
    [0x222f, 0x23d9, 0x3d96], // wPlayerData2
    [0x23d9, 0x2856, 0x0c6b], // wPlayerData3
    [0x2856, 0x288a, 0x7e39], // wCurMapData
    [0x288a, 0x2d69, 0x10e8], // wPokemonData
  ],
  backupChecksum: 0x7e6d, backupCheckValue2: 0x7e6f,
};

// pret/pokecrystal (ram/sram.asm and pokecrystal11.sym); Crystal 1.0 and 1.1 save at the same addresses. Crystal keeps
// the backup in one piece in bank 0, and the game data ends early, with padding before the checksum.
const CRYSTAL: Layout = {
  options: 0x2000, textboxFrame: 0x2002, textboxFlags: 0x2003, printShade: 0x2004, options2: 0x2005, checkValue1: 0x2008,
  gameData: 0x2009, gameDataEnd: 0x2b83,
  playerId: 0x2009, playerName: 0x200b, momName: 0x2016, rivalName: 0x2021,
  gameTimeCap: 0x2051, playHours: 0x2052, playMinutes: 0x2054, playSeconds: 0x2055,
  money: 0x23dc, momsMoney: 0x23df, coins: 0x23e3, johtoBadges: 0x23e5, kantoBadges: 0x23e6, tmhm: 0x23e7,
  items: 0x2420, keyItems: 0x244a, balls: 0x2465, pcItems: 0x247f,
  curBox: 0x2700, boxNames: 0x2703, party: 0x2865, dexCaught: 0x2a27, dexSeen: 0x2a47,
  checksum: 0x2d0d, checkValue2: 0x2d0f, currentBox: 0x2d10, partyMail: 0x0600, partyMailBackup: 0x071a,
  playerGender: 0x3e3d, // sCrystalData
  backup: [
    [0x2000, 0x2009, 0x1200], // options and the first check byte
    [0x2009, 0x2b83, 0x1209], // the game data
  ],
  backupChecksum: 0x1f0d, backupCheckValue2: 0x1f0f,
};

/** The save offsets for each layout, for scripts and tests. */
export const GEN2_LAYOUTS: Readonly<Record<Gen2Game, Layout>> = { gs: GOLD, crystal: CRYSTAL };

const CHECK_VALUE_1 = 99;
const CHECK_VALUE_2 = 127;

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
  /** Crystal's record of where and when it was caught (see caught.ts). Gold and Silver leave these two bytes alone. */
  caught: [number, number];
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
    pp: [35, 0, 0, 0], ppUps: [0, 0, 0, 0], friendship: 70, pokerus: 0, caught: [0, 0], level,
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
    caught: [d[off + 29], d[off + 30]],
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
  d[off + 29] = mon.caught[0];
  d[off + 30] = mon.caught[1];
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

  /** Which layout the file uses. */
  readonly game: Gen2Game;
  /** Crystal only: the player chose the boy or the girl at the start (null for Gold and Silver). */
  playerGender: 'boy' | 'girl' | null;

  private L: Layout;
  private original: Uint8Array;
  private raw: { name: Uint8Array; rival: Uint8Array; mom: Uint8Array; boxNames: Uint8Array[] };

  /** Opens the file with the layout given, or else the one whose checksum is right (Gold and Silver if neither is). */
  constructor(data: Uint8Array, game?: Gen2Game) {
    if (data.length < SAVE_SIZE) throw new Error(`Gen 2 Pokémon saves are ${SAVE_SIZE.toLocaleString('en-US')} bytes (this file is ${data.length.toLocaleString('en-US')}).`);
    this.game = game ?? Gen2Save.detectGame(data) ?? 'gs';
    const L = this.L = GEN2_LAYOUTS[this.game];
    this.original = data.slice();
    const d = this.original;
    this.playerGender = L.playerGender === undefined ? null : d[L.playerGender] & 1 ? 'girl' : 'boy';
    this.raw = {
      name: d.slice(L.playerName, L.playerName + NAME_LEN),
      rival: d.slice(L.rivalName, L.rivalName + NAME_LEN),
      mom: d.slice(L.momName, L.momName + NAME_LEN),
      boxNames: Array.from({ length: BOX_COUNT }, (_, i) => d.slice(L.boxNames + i * BOX_NAME_LEN, L.boxNames + (i + 1) * BOX_NAME_LEN)),
    };
    this.trainerName = decodeText(this.raw.name);
    this.rivalName = decodeText(this.raw.rival);
    this.momName = decodeText(this.raw.mom);
    this.boxNames = this.raw.boxNames.map(decodeText);
    this.trainerId = u16(d, L.playerId);
    this.money = u24(d, L.money);
    this.momsMoney = u24(d, L.momsMoney);
    this.coins = u16(d, L.coins);
    this.johtoBadges = d[L.johtoBadges];
    this.kantoBadges = d[L.kantoBadges];
    const o = d[L.options];
    this.options = {
      textSpeed: o & 7, stereo: !!(o & 0x20), battleStyleSet: !!(o & 0x40), battleSceneOff: !!(o & 0x80),
      frame: d[L.textboxFrame] & 7, printShade: d[L.printShade], menuAccount: !!(d[L.options2] & 1),
    };
    this.playHours = u16(d, L.playHours);
    this.playMinutes = d[L.playMinutes];
    this.playSeconds = d[L.playSeconds];
    this.currentBoxIndex = Math.min(d[L.curBox], BOX_COUNT - 1);
    this.items = readItems(d, L.items, BAG_MAX.items);
    this.balls = readItems(d, L.balls, BAG_MAX.balls);
    this.pcItems = readItems(d, L.pcItems, BAG_MAX.pcItems);
    this.keyItems = Array.from(d.slice(L.keyItems + 1, L.keyItems + 1 + Math.min(d[L.keyItems], BAG_MAX.keyItems)));
    this.tmhm = Array.from(d.slice(L.tmhm, L.tmhm + TM_COUNT + HM_COUNT));
    this.dexCaught = d.slice(L.dexCaught, L.dexCaught + DEX_BYTES);
    this.dexSeen = d.slice(L.dexSeen, L.dexSeen + DEX_BYTES);
    this.party = readMonList(d, L.party, true);
    this.party.forEach((mon, i) => { mon.mail = d.slice(L.partyMail + i * MAIL_SIZE, L.partyMail + (i + 1) * MAIL_SIZE); });
    this.boxes = Array.from({ length: BOX_COUNT }, (_, i) =>
      readMonList(d, i === this.currentBoxIndex ? L.currentBox : Gen2Save.boxOffset(i), false));
  }

  /** The layout whose main copy is valid, or null. Only one can be: the checksums sit in different places. */
  static detectGame(data: Uint8Array): Gen2Game | null {
    if (Gen2Save.mainValid(data, 'crystal')) return 'crystal';
    if (Gen2Save.mainValid(data, 'gs')) return 'gs';
    return null;
  }

  static boxOffset(i: number): number {
    return (i < BOXES_PER_BANK ? 0x4000 : 0x6000) + (i % BOXES_PER_BANK) * BOX_BYTES;
  }

  /** The main copy is the one the game loads: both check bytes in place and the checksum right. */
  static mainValid(data: Uint8Array, game: Gen2Game = 'gs'): boolean {
    const L = GEN2_LAYOUTS[game];
    return data.length >= SAVE_SIZE && data[L.checkValue1] === CHECK_VALUE_1 && data[L.checkValue2] === CHECK_VALUE_2
      && (data[L.checksum] | (data[L.checksum + 1] << 8)) === sum16(data, L.gameData, L.gameDataEnd);
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
    const L = this.L;
    const d = this.original.slice();

    d[L.options] = (d[L.options] & 0x18) | (this.options.textSpeed & 7) | (this.options.stereo ? 0x20 : 0)
      | (this.options.battleStyleSet ? 0x40 : 0) | (this.options.battleSceneOff ? 0x80 : 0);
    d[L.textboxFrame] = (d[L.textboxFrame] & ~7) | (this.options.frame & 7);
    d[L.printShade] = this.options.printShade & 0xff;
    d[L.options2] = (d[L.options2] & ~1) | (this.options.menuAccount ? 1 : 0);

    setU16(d, L.playerId, this.trainerId & 0xffff);
    d.set(encodeText(this.trainerName, NAME_LEN, this.raw.name, 0), L.playerName);
    d.set(encodeText(this.momName, NAME_LEN, this.raw.mom, 0), L.momName);
    d.set(encodeText(this.rivalName, NAME_LEN, this.raw.rival, 0), L.rivalName);
    const hours = clamp(this.playHours, 0, 999);
    if (hours !== u16(this.original, L.playHours) || this.playMinutes !== this.original[L.playMinutes]) {
      // A clock that was stopped at 999:59:59 starts again once it is below that.
      if (hours < 999 || this.playMinutes < 59) d[L.gameTimeCap] &= ~1;
    }
    setU16(d, L.playHours, hours);
    d[L.playMinutes] = clamp(this.playMinutes, 0, 59);
    d[L.playSeconds] = clamp(this.playSeconds, 0, 59);
    setU24(d, L.money, clamp(this.money, 0, MONEY_MAX));
    setU24(d, L.momsMoney, clamp(this.momsMoney, 0, MONEY_MAX));
    setU16(d, L.coins, clamp(this.coins, 0, COINS_MAX));
    d[L.johtoBadges] = this.johtoBadges & 0xff;
    d[L.kantoBadges] = this.kantoBadges & 0xff;

    this.tmhm.forEach((n, i) => { d[L.tmhm + i] = clamp(n, 0, i < TM_COUNT ? 99 : 1); });
    writeItems(d, L.items, this.items, BAG_MAX.items);
    writeItems(d, L.balls, this.balls, BAG_MAX.balls);
    writeItems(d, L.pcItems, this.pcItems, BAG_MAX.pcItems);
    const keys = this.keyItems.filter((id) => id !== 0 && id !== 0xff).slice(0, BAG_MAX.keyItems);
    d[L.keyItems] = keys.length;
    d.set(keys, L.keyItems + 1);
    d[L.keyItems + 1 + keys.length] = 0xff;

    this.boxNames.forEach((name, i) => d.set(encodeText(name, BOX_NAME_LEN, this.raw.boxNames[i], 0), L.boxNames + i * BOX_NAME_LEN));
    d.set(this.dexCaught, L.dexCaught);
    d.set(this.dexSeen, L.dexSeen);

    writeMonList(d, L.party, this.party, true);
    d[L.curBox] = this.currentBoxIndex;
    for (let i = 0; i < BOX_COUNT; i++) {
      writeMonList(d, i === this.currentBoxIndex ? L.currentBox : Gen2Save.boxOffset(i), this.boxes[i] ?? [], false);
    }

    // Mail travels with the party Pokémon that holds it; the game keeps a second copy right after the first.
    this.party.forEach((mon, i) => {
      if (!mon.mail) return;
      d.set(mon.mail, L.partyMail + i * MAIL_SIZE);
      d.set(mon.mail, L.partyMailBackup + i * MAIL_SIZE);
    });

    // Crystal's player gender lives outside the checksummed data, and the game reads it back on Continue.
    if (L.playerGender !== undefined && this.playerGender) {
      d[L.playerGender] = (d[L.playerGender] & ~1) | (this.playerGender === 'girl' ? 1 : 0);
    }

    const sum = sum16(d, L.gameData, L.gameDataEnd);
    d[L.checksum] = sum & 0xff;
    d[L.checksum + 1] = sum >> 8;

    // The backup copy, refreshed only when the main copy changed (so an unedited file comes back byte for byte).
    let changed = false;
    for (let i = L.options; i < L.checkValue2 + 1 && !changed; i++) changed = d[i] !== this.original[i];
    if (changed) {
      for (const [from, to, at] of L.backup) d.set(d.subarray(from, to), at);
      d[L.backupChecksum] = sum & 0xff;
      d[L.backupChecksum + 1] = sum >> 8;
      d[L.backupCheckValue2] = CHECK_VALUE_2;
    }
    return d;
  }
}
