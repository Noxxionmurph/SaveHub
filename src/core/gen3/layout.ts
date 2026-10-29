// Gen 3 save layouts, sector checks and the test that tells a Ruby/Sapphire save from an Emerald one. Kept apart from
// save.ts, which needs the species and move tables, so the landing page can recognise a file without downloading them
// (see games/pokemon-emerald.ts). The format: see save.ts.
import { le } from '../bytes.ts';
import type { Gen3Game } from './data.ts';

const { u16, u32 } = le;

export const SAVE_SIZE = 0x20000;
export const SECTOR = 0x1000;
export const SECTOR_DATA = 3968;
export const SECTORS_PER_SLOT = 14;
export const SIGNATURE = 0x08012025;

export interface Layout {
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
  /** SaveBlock1's game stats (see stats.ts). */
  gameStats: number;
  /** SaveBlock1's Pokéblock case (see pokeblocks.ts). */
  pokeblocks: number;
  /** SaveBlock1's decoration lists (see decorations.ts), and where the bedroom's and the player's secret base's
   * placed decorations are kept (12 and 16 ids). */
  decorations: number; roomDecor: number; baseDecor: number;
  /** SaveBlock1's roaming Latios or Latias (struct Roamer). */
  roamer: number;
  /** Money, coins and bag quantities are XORed with the key at SaveBlock2 0xAC. */
  encrypted: boolean;
}

export const RS: Layout = {
  sb2Size: 0x890, sb1Size: 0x3ac0,
  items: 0x560, itemsMax: 20, keyItems: 0x5b0, keyItemsMax: 20, balls: 0x600, ballsMax: 16,
  tmhm: 0x640, tmhmMax: 64, berries: 0x740, berriesMax: 46,
  seenCopies: [0x938, 0x3a8c], flags: 0x1220, vars: 0x1340, badgeFlag: 0x807, nationalDexFlag: 0x836, gameStats: 0x1540, pokeblocks: 0x7f8,
  decorations: 0x26a0, roomDecor: 0x2688, baseDecor: 0x1a1a, roamer: 0x3144,
  encrypted: false,
};

export const EMERALD: Layout = {
  sb2Size: 0xf2c, sb1Size: 0x3d88,
  items: 0x560, itemsMax: 30, keyItems: 0x5d8, keyItemsMax: 30, balls: 0x650, ballsMax: 16,
  tmhm: 0x690, tmhmMax: 64, berries: 0x790, berriesMax: 46,
  seenCopies: [0x988, 0x3b24], flags: 0x1270, vars: 0x139c, badgeFlag: 0x867, nationalDexFlag: 0x896, gameStats: 0x159c, pokeblocks: 0x848,
  decorations: 0x2734, roomDecor: 0x271c, baseDecor: 0x1aae, roamer: 0x31dc,
  encrypted: true,
};

export const GEN3_LAYOUTS: Readonly<Record<Gen3Game, Layout>> = { rs: RS, emerald: EMERALD };

// Shared offsets.
export const SB2 = {
  name: 0x00, gender: 0x08, trainerId: 0x0a, playHours: 0x0e, playMinutes: 0x10, playSeconds: 0x11, playFrames: 0x12,
  buttonMode: 0x13, options: 0x14, dexMode: 0x19, nationalMagic: 0x1a, dexOwned: 0x28, dexSeen: 0x5c, key: 0xac,
};
export const SB1 = { partyCount: 0x234, party: 0x238, money: 0x490, coins: 0x494, pcItems: 0x498 };
export const STORAGE = { currentBox: 0, boxes: 4, names: 0x8344, size: 0x83d0 };
export const MONEY_MAX = 999999;

/** The sector checksum (pokeemerald: CalculateChecksum): a 32-bit sum of the words, folded to 16 bits. */
export function sectorChecksum(d: Uint8Array, start: number, size: number): number {
  let sum = 0;
  for (let i = 0; i < size; i += 4) sum = (sum + u32(d, start + i)) >>> 0;
  return ((sum >>> 16) + sum) & 0xffff;
}

/** How many bytes the game saves in sector `id`. */
export function sectorSize(L: Layout, id: number): number {
  if (id === 0) return L.sb2Size;
  if (id <= 4) return Math.min(SECTOR_DATA, L.sb1Size - (id - 1) * SECTOR_DATA);
  return Math.min(SECTOR_DATA, STORAGE.size - (id - 5) * SECTOR_DATA);
}

export interface Slot { slot: number; counter: number; sectorOf: number[] }

/** Each slot that has all 14 sectors with the signature and right checksums, newest first. */
export function validSlots(data: Uint8Array, L: Layout): Slot[] {
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
