// Gen 2 save layouts and the checks that tell a Gold/Silver save from a Crystal one. Kept apart from save.ts, which
// needs the species and move tables, so the landing page can recognise a file without downloading them (see
// games/pokemon-gen2.ts). Addresses: see save.ts.

export const SAVE_SIZE = 0x8000;

/** Which cartridge wrote the save: Gold and Silver share one layout, Crystal moved most things a few bytes. */
export type Gen2Game = 'gs' | 'crystal';

export interface Layout {
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

export const CHECK_VALUE_1 = 99;
export const CHECK_VALUE_2 = 127;

/** The game's checksum (pokegold: Checksum): a 16-bit sum of the bytes. */
export function sum16(d: Uint8Array, start: number, end: number): number {
  let s = 0;
  for (let i = start; i < end; i++) s = (s + d[i]) & 0xffff;
  return s;
}

/** The main copy is the one the game loads: both check bytes in place and the checksum right. */
export function mainValid(data: Uint8Array, game: Gen2Game = 'gs'): boolean {
  const L = GEN2_LAYOUTS[game];
  return data.length >= SAVE_SIZE && data[L.checkValue1] === CHECK_VALUE_1 && data[L.checkValue2] === CHECK_VALUE_2
    && (data[L.checksum] | (data[L.checksum + 1] << 8)) === sum16(data, L.gameData, L.gameDataEnd);
}

/** The backup copy is good: both of its check bytes in place, and its checksum the sum of its copy of the game data. */
export function backupValid(data: Uint8Array, game: Gen2Game = 'gs'): boolean {
  const L = GEN2_LAYOUTS[game];
  if (data.length < SAVE_SIZE) return false;
  let sum = 0, check1 = -1;
  for (const [from, to, at] of L.backup) {
    if (L.checkValue1 >= from && L.checkValue1 < to) check1 = data[at + L.checkValue1 - from];
    const lo = Math.max(from, L.gameData), hi = Math.min(to, L.gameDataEnd);
    if (lo < hi) sum = (sum + sum16(data, at + lo - from, at + hi - from)) & 0xffff;
  }
  return check1 === CHECK_VALUE_1 && data[L.backupCheckValue2] === CHECK_VALUE_2
    && (data[L.backupChecksum] | (data[L.backupChecksum + 1] << 8)) === sum;
}

/**
 * The layout whose main copy is valid, or else whose backup is (the game falls back to it), or null. Only one layout
 * can match: the checksums sit in different places.
 */
export function detectGen2(data: Uint8Array): Gen2Game | null {
  if (mainValid(data, 'crystal')) return 'crystal';
  if (mainValid(data, 'gs')) return 'gs';
  if (backupValid(data, 'crystal')) return 'crystal';
  if (backupValid(data, 'gs')) return 'gs';
  return null;
}
