// Gen 1 (Red / Blue / Yellow, international) save file model.
// Layout reference: pret/pokered wram + SRAM map, PKHeX's SAV1.

import type { EditableSave } from '../types.ts';
import { baseStatsFor, speciesName, TYPE_BYTE } from './data.ts';
import { decodeText, encodeText } from './text.ts';

export const SAVE_SIZE = 0x8000;

const OFF = {
  playerName: 0x2598, // 11 bytes
  dexOwned: 0x25a3, // 19 bytes
  dexSeen: 0x25b6, // 19 bytes
  bagCount: 0x25c9, // count, then 20 × (id, qty), 0xFF terminator
  money: 0x25f3, // 3 bytes BCD
  rivalName: 0x25f6, // 11 bytes
  badges: 0x2602,
  playerId: 0x2605, // u16 big-endian
  pcItemCount: 0x27e6, // count, then 50 × (id, qty), 0xFF
  currentBox: 0x284c, // low 7 bits = box index, bit 7 = "box changed" flag
  coins: 0x2850, // 2 bytes BCD
  playHours: 0x2ced,
  playMaxed: 0x2cee,
  playMinutes: 0x2cef,
  playSeconds: 0x2cf0,
  party: 0x2f2c, // count, species[7], 6 × 44 mons, 6 × 11 OT, 6 × 11 nicknames
  currentBoxData: 0x30c0,
  checksum: 0x3523,
  checksumStart: 0x2598,
  checksumEnd: 0x3523, // exclusive
  bank2: 0x4000,
  bank3: 0x6000,
} as const;

const NAME_LEN = 11;
const PARTY_MON_SIZE = 44;
const BOX_MON_SIZE = 33;
const PARTY_MAX = 6;
const BOX_MAX = 20;
const BOX_SIZE = 0x462;
const BOXES_PER_BANK = 6;
const BOX_COUNT = 12;
const BAG_MAX = 20;
const PC_MAX = 50;
export const DEX_BYTES = 19;

export interface Gen1Mon {
  species: number; // internal index
  hp: number;
  level: number; // box level (byte 3)
  status: number;
  type1: number;
  type2: number;
  catchRate: number;
  moves: [number, number, number, number];
  pp: [number, number, number, number]; // 0..63
  ppUps: [number, number, number, number]; // 0..3
  otId: number;
  exp: number;
  evs: { hp: number; atk: number; def: number; spe: number; spc: number };
  dvs: { atk: number; def: number; spe: number; spc: number };
  nickname: string;
  otName: string;
  // Party-only computed stats (ignored for box mons).
  partyLevel: number;
  maxHp: number;
  atk: number;
  def: number;
  spe: number;
  spc: number;
  /** Original raw name bytes, used to avoid corrupting untouched names. */
  nickRaw?: Uint8Array;
  otRaw?: Uint8Array;
}

export interface BagItem {
  id: number;
  count: number;
}

export interface Stats {
  hp: number; atk: number; def: number; spe: number; spc: number;
}

// ---------- helpers ----------

const u16 = (d: Uint8Array, o: number) => (d[o] << 8) | d[o + 1];
const setU16 = (d: Uint8Array, o: number, v: number) => { d[o] = (v >> 8) & 0xff; d[o + 1] = v & 0xff; };

export function sum8(d: Uint8Array, start: number, end: number): number {
  let s = 0;
  for (let i = start; i < end; i++) s = (s + d[i]) & 0xff;
  return s;
}
/** Gen 1 checksum: bitwise NOT of the byte sum. */
export const checksum8 = (d: Uint8Array, start: number, end: number) => ~sum8(d, start, end) & 0xff;

export function bcdDecode(d: Uint8Array, o: number, len: number): number {
  let v = 0;
  for (let i = 0; i < len; i++) v = v * 100 + (d[o + i] >> 4) * 10 + (d[o + i] & 0xf);
  return v;
}
export function bcdEncode(d: Uint8Array, o: number, len: number, value: number): void {
  const max = 10 ** (len * 2) - 1;
  let v = Math.max(0, Math.min(max, Math.floor(value)));
  for (let i = len - 1; i >= 0; i--) {
    const two = v % 100;
    d[o + i] = ((Math.floor(two / 10)) << 4) | (two % 10);
    v = Math.floor(v / 100);
  }
}

/** Gen 1 stat formula. `ev` is the 16-bit stat experience. */
export function calcStats(
  species: number,
  level: number,
  dvs: Gen1Mon['dvs'],
  evs: Gen1Mon['evs'],
): Stats | null {
  const base = baseStatsFor(species);
  if (!base) return null;
  const evBonus = (ev: number) => Math.floor(Math.min(255, Math.ceil(Math.sqrt(ev))) / 4);
  const stat = (b: number, dv: number, ev: number) =>
    Math.floor((((b + dv) * 2 + evBonus(ev)) * level) / 100) + 5;
  const hpDv = ((dvs.atk & 1) << 3) | ((dvs.def & 1) << 2) | ((dvs.spe & 1) << 1) | (dvs.spc & 1);
  return {
    hp: Math.floor((((base.hp + hpDv) * 2 + evBonus(evs.hp)) * level) / 100) + level + 10,
    atk: stat(base.atk, dvs.atk, evs.atk),
    def: stat(base.def, dvs.def, evs.def),
    spe: stat(base.spe, dvs.spe, evs.spe),
    spc: stat(base.spc, dvs.spc, evs.spc),
  };
}

export const hpDv = (dvs: Gen1Mon['dvs']) =>
  ((dvs.atk & 1) << 3) | ((dvs.def & 1) << 2) | ((dvs.spe & 1) << 1) | (dvs.spc & 1);

/** Recalculate a party mon's stored stats (and clamp HP) from its species/level/DVs/EVs. */
export function recalcPartyStats(mon: Gen1Mon, heal = false): void {
  const s = calcStats(mon.species, mon.level, mon.dvs, mon.evs);
  mon.partyLevel = mon.level;
  if (!s) return;
  mon.maxHp = s.hp; mon.atk = s.atk; mon.def = s.def; mon.spe = s.spe; mon.spc = s.spc;
  mon.hp = heal ? s.hp : Math.min(mon.hp, s.hp);
}

/** Sync the stored type bytes with the species' types. */
export function applySpeciesTypes(mon: Gen1Mon): void {
  const b = baseStatsFor(mon.species);
  if (!b) return;
  mon.type1 = TYPE_BYTE[b.type1];
  mon.type2 = TYPE_BYTE[b.type2];
}

/** Gen 1 stores the (uppercase) species name as the default nickname. */
export const defaultNickname = (species: number) => speciesName(species).toUpperCase();

export function newMon(species: number, level = 5): Gen1Mon {
  const mon: Gen1Mon = {
    species, hp: 1, level, status: 0, type1: 0, type2: 0, catchRate: 0xff,
    moves: [33, 0, 0, 0], pp: [35, 0, 0, 0], ppUps: [0, 0, 0, 0],
    otId: 0, exp: 0,
    evs: { hp: 0, atk: 0, def: 0, spe: 0, spc: 0 },
    dvs: { atk: 8, def: 8, spe: 8, spc: 8 },
    nickname: defaultNickname(species), otName: '',
    partyLevel: level, maxHp: 1, atk: 1, def: 1, spe: 1, spc: 1,
  };
  applySpeciesTypes(mon);
  recalcPartyStats(mon, true);
  return mon;
}

// ---------- (de)serialisation of a single Pokémon ----------

function readMon(d: Uint8Array, off: number, party: boolean, otRaw: Uint8Array, nickRaw: Uint8Array): Gen1Mon {
  const mon: Gen1Mon = {
    species: d[off],
    hp: u16(d, off + 1),
    level: d[off + 3],
    status: d[off + 4],
    type1: d[off + 5],
    type2: d[off + 6],
    catchRate: d[off + 7],
    moves: [d[off + 8], d[off + 9], d[off + 10], d[off + 11]],
    otId: u16(d, off + 12),
    exp: (d[off + 14] << 16) | (d[off + 15] << 8) | d[off + 16],
    evs: {
      hp: u16(d, off + 17), atk: u16(d, off + 19), def: u16(d, off + 21),
      spe: u16(d, off + 23), spc: u16(d, off + 25),
    },
    dvs: {
      atk: d[off + 27] >> 4, def: d[off + 27] & 0xf,
      spe: d[off + 28] >> 4, spc: d[off + 28] & 0xf,
    },
    pp: [d[off + 29] & 0x3f, d[off + 30] & 0x3f, d[off + 31] & 0x3f, d[off + 32] & 0x3f],
    ppUps: [d[off + 29] >> 6, d[off + 30] >> 6, d[off + 31] >> 6, d[off + 32] >> 6],
    nickname: decodeText(nickRaw),
    otName: decodeText(otRaw),
    nickRaw, otRaw,
    partyLevel: d[off + 3], maxHp: 0, atk: 0, def: 0, spe: 0, spc: 0,
  };
  if (party) {
    mon.partyLevel = d[off + 33];
    mon.maxHp = u16(d, off + 34);
    mon.atk = u16(d, off + 36);
    mon.def = u16(d, off + 38);
    mon.spe = u16(d, off + 40);
    mon.spc = u16(d, off + 42);
  }
  return mon;
}

function writeMon(d: Uint8Array, off: number, mon: Gen1Mon, party: boolean): void {
  const size = party ? PARTY_MON_SIZE : BOX_MON_SIZE;
  d.fill(0, off, off + size);
  d[off] = mon.species;
  setU16(d, off + 1, mon.hp);
  d[off + 3] = mon.level;
  d[off + 4] = mon.status;
  d[off + 5] = mon.type1;
  d[off + 6] = mon.type2;
  d[off + 7] = mon.catchRate;
  for (let i = 0; i < 4; i++) d[off + 8 + i] = mon.moves[i];
  setU16(d, off + 12, mon.otId);
  d[off + 14] = (mon.exp >> 16) & 0xff;
  d[off + 15] = (mon.exp >> 8) & 0xff;
  d[off + 16] = mon.exp & 0xff;
  setU16(d, off + 17, mon.evs.hp);
  setU16(d, off + 19, mon.evs.atk);
  setU16(d, off + 21, mon.evs.def);
  setU16(d, off + 23, mon.evs.spe);
  setU16(d, off + 25, mon.evs.spc);
  d[off + 27] = ((mon.dvs.atk & 0xf) << 4) | (mon.dvs.def & 0xf);
  d[off + 28] = ((mon.dvs.spe & 0xf) << 4) | (mon.dvs.spc & 0xf);
  for (let i = 0; i < 4; i++) d[off + 29 + i] = ((mon.ppUps[i] & 3) << 6) | (mon.pp[i] & 0x3f);
  if (party) {
    d[off + 33] = mon.partyLevel;
    setU16(d, off + 34, mon.maxHp);
    setU16(d, off + 36, mon.atk);
    setU16(d, off + 38, mon.def);
    setU16(d, off + 40, mon.spe);
    setU16(d, off + 42, mon.spc);
  }
}

/** Read a list container (party or box): count, species list, mons, OT names, nicknames. */
function readMonList(d: Uint8Array, base: number, party: boolean): Gen1Mon[] {
  const max = party ? PARTY_MAX : BOX_MAX;
  const size = party ? PARTY_MON_SIZE : BOX_MON_SIZE;
  const monsAt = base + 1 + max + 1;
  const otAt = monsAt + max * size;
  const nickAt = otAt + max * NAME_LEN;
  const count = Math.min(d[base], max);
  const out: Gen1Mon[] = [];
  for (let i = 0; i < count; i++) {
    out.push(readMon(
      d, monsAt + i * size, party,
      d.slice(otAt + i * NAME_LEN, otAt + (i + 1) * NAME_LEN),
      d.slice(nickAt + i * NAME_LEN, nickAt + (i + 1) * NAME_LEN),
    ));
  }
  return out;
}

function writeMonList(d: Uint8Array, base: number, mons: Gen1Mon[], party: boolean): void {
  const max = party ? PARTY_MAX : BOX_MAX;
  const size = party ? PARTY_MON_SIZE : BOX_MON_SIZE;
  const monsAt = base + 1 + max + 1;
  const otAt = monsAt + max * size;
  const nickAt = otAt + max * NAME_LEN;
  // Only slots in use are written; stale bytes in unused slots are left alone (as the game itself does),
  // so an unedited save round-trips byte-for-byte.
  const list = mons.slice(0, max);
  d[base] = list.length;
  list.forEach((mon, i) => {
    d[base + 1 + i] = mon.species;
    writeMon(d, monsAt + i * size, mon, party);
    d.set(encodeText(mon.otName, NAME_LEN, mon.otRaw), otAt + i * NAME_LEN);
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
    d[base + 2 + i * 2] = Math.max(1, Math.min(99, it.count));
  });
  d[base + 1 + list.length * 2] = 0xff;
}

// ---------- the save ----------

export class Gen1Save implements EditableSave {
  trainerName: string;
  rivalName: string;
  trainerId: number;
  money: number;
  coins: number;
  badges: number;
  playHours: number;
  playMinutes: number;
  playSeconds: number;
  currentBoxIndex: number;
  bag: BagItem[];
  pcItems: BagItem[];
  party: Gen1Mon[];
  boxes: Gen1Mon[][];
  dexOwned: Uint8Array;
  dexSeen: Uint8Array;

  private original: Uint8Array;
  private nameRaw: Uint8Array;
  private rivalRaw: Uint8Array;

  constructor(data: Uint8Array) {
    if (data.length < SAVE_SIZE) throw new Error(`Gen 1 saves are ${SAVE_SIZE} bytes (got ${data.length}).`);
    this.original = data.slice();
    const d = this.original;
    this.nameRaw = d.slice(OFF.playerName, OFF.playerName + NAME_LEN);
    this.rivalRaw = d.slice(OFF.rivalName, OFF.rivalName + NAME_LEN);
    this.trainerName = decodeText(this.nameRaw);
    this.rivalName = decodeText(this.rivalRaw);
    this.trainerId = u16(d, OFF.playerId);
    this.money = bcdDecode(d, OFF.money, 3);
    this.coins = bcdDecode(d, OFF.coins, 2);
    this.badges = d[OFF.badges];
    this.playHours = d[OFF.playHours];
    this.playMinutes = d[OFF.playMinutes];
    this.playSeconds = d[OFF.playSeconds];
    this.currentBoxIndex = Math.min(d[OFF.currentBox] & 0x7f, BOX_COUNT - 1);
    this.bag = readItems(d, OFF.bagCount, BAG_MAX);
    this.pcItems = readItems(d, OFF.pcItemCount, PC_MAX);
    this.dexOwned = d.slice(OFF.dexOwned, OFF.dexOwned + DEX_BYTES);
    this.dexSeen = d.slice(OFF.dexSeen, OFF.dexSeen + DEX_BYTES);
    this.party = readMonList(d, OFF.party, true);
    this.boxes = [];
    for (let i = 0; i < BOX_COUNT; i++) {
      this.boxes.push(readMonList(d, i === this.currentBoxIndex ? OFF.currentBoxData : this.boxOffset(i), false));
    }
  }

  private boxOffset(i: number): number {
    const bank = i < BOXES_PER_BANK ? OFF.bank2 : OFF.bank3;
    return bank + (i % BOXES_PER_BANK) * BOX_SIZE;
  }

  static checksumValid(data: Uint8Array): boolean {
    return data.length >= SAVE_SIZE && data[OFF.checksum] === checksum8(data, OFF.checksumStart, OFF.checksumEnd);
  }

  isOwned = (dex: number) => (this.dexOwned[(dex - 1) >> 3] >> ((dex - 1) & 7)) & 1;
  isSeen = (dex: number) => (this.dexSeen[(dex - 1) >> 3] >> ((dex - 1) & 7)) & 1;
  setOwned(dex: number, on: boolean): void {
    const i = (dex - 1) >> 3, bit = 1 << ((dex - 1) & 7);
    this.dexOwned[i] = on ? this.dexOwned[i] | bit : this.dexOwned[i] & ~bit;
    if (on) this.setSeen(dex, true);
  }
  setSeen(dex: number, on: boolean): void {
    const i = (dex - 1) >> 3, bit = 1 << ((dex - 1) & 7);
    this.dexSeen[i] = on ? this.dexSeen[i] | bit : this.dexSeen[i] & ~bit;
    if (!on) this.setOwned(dex, false);
  }

  serialize(): Uint8Array {
    const d = this.original.slice();

    d.set(encodeText(this.trainerName, NAME_LEN, this.nameRaw), OFF.playerName);
    d.set(encodeText(this.rivalName, NAME_LEN, this.rivalRaw), OFF.rivalName);
    setU16(d, OFF.playerId, this.trainerId & 0xffff);
    bcdEncode(d, OFF.money, 3, this.money);
    bcdEncode(d, OFF.coins, 2, this.coins);
    d[OFF.badges] = this.badges & 0xff;
    d[OFF.playHours] = this.playHours & 0xff;
    d[OFF.playMinutes] = Math.min(59, this.playMinutes);
    d[OFF.playSeconds] = Math.min(59, this.playSeconds);
    d.set(this.dexOwned, OFF.dexOwned);
    d.set(this.dexSeen, OFF.dexSeen);
    writeItems(d, OFF.bagCount, this.bag, BAG_MAX);
    writeItems(d, OFF.pcItemCount, this.pcItems, PC_MAX);
    writeMonList(d, OFF.party, this.party, true);

    d[OFF.currentBox] = (d[OFF.currentBox] & 0x80) | (this.currentBoxIndex & 0x7f);
    // The game keeps the *current* box in the main bank (0x30C0); its slot in the box banks is only
    // refreshed when the player switches boxes, so edits to the current box go to 0x30C0 only.
    for (let i = 0; i < BOX_COUNT; i++) {
      const at = i === this.currentBoxIndex ? OFF.currentBoxData : this.boxOffset(i);
      writeMonList(d, at, this.boxes[i] ?? [], false);
    }

    // Main checksum.
    d[OFF.checksum] = checksum8(d, OFF.checksumStart, OFF.checksumEnd);
    // Box-bank checksums (whole-bank at +0x1A4C, then one per box), refreshed only for banks we changed.
    const total = BOX_SIZE * BOXES_PER_BANK;
    for (const bank of [OFF.bank2, OFF.bank3]) {
      let changed = false;
      for (let i = bank; i < bank + total && !changed; i++) changed = d[i] !== this.original[i];
      if (!changed) continue;
      d[bank + total] = checksum8(d, bank, bank + total);
      for (let i = 0; i < BOXES_PER_BANK; i++) {
        d[bank + total + 1 + i] = checksum8(d, bank + i * BOX_SIZE, bank + (i + 1) * BOX_SIZE);
      }
    }
    return d;
  }
}

export const gen1Handler = {
  id: 'gen1',
  detect(data) {
    if (data.length < SAVE_SIZE) return false;
    if (!Gen1Save.checksumValid(data)) return false;
    // Player name must be a valid terminated string.
    const name = data.slice(OFF.playerName, OFF.playerName + NAME_LEN);
    return name.includes(0x50) && decodeText(name).length > 0;
  },
  load: (data) => new Gen1Save(data),
};
