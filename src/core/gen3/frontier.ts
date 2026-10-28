// Emerald's Battle Frontier streaks (pokeemerald include/global.h struct BattleFrontier, offsets into SaveBlock2). Each
// facility keeps a current streak and a record per battle mode and level (Lv. 50, Open Level). A current streak only
// carries on into the next challenge while its bit in winStreakActiveFlags is set (include/constants/frontier_util.h),
// as the game leaves it after a won challenge; otherwise the game shows it as the previous streak.

export const STREAK_MAX = 9999;
export const LEVELS = ['Lv. 50', 'Open Level'] as const;
const ACTIVE_FLAGS = 0xcdc;
export const CARD_BATTLE_POINTS = 0xeba;

export interface StreakRow {
  facility: string;
  /** e.g. "Singles", or "" for facilities with one mode. */
  mode: string;
  level: number;
  /** What the game counts: wins, tournaments, rooms or floors. */
  unit: string;
  current: number;
  best: number;
  activeBit: number;
  /** Dome championships (one number) or Factory rentals (current and record). */
  extra?: { label: string; current?: number; best: number };
}

function rows(): StreakRow[] {
  const out: StreakRow[] = [];
  // `modes` lists each mode's active-flag bits for Lv. 50 (Open Level is the next bit).
  const add = (facility: string, unit: string, cur: number, best: number, modes: [string, number][],
    extra?: (m: number, l: number) => StreakRow['extra']) => {
    modes.forEach(([mode, bit], m) => LEVELS.forEach((_, l) => out.push({
      facility, mode, level: l, unit, current: cur + (m * 2 + l) * 2, best: best + (m * 2 + l) * 2, activeBit: bit + l,
      extra: extra?.(m, l),
    })));
  };
  add('Battle Tower', 'Win streak', 0xce0, 0xcf0, [['Singles', 0], ['Doubles', 14], ['Multi', 16], ['Link Multi', 18]]);
  add('Battle Dome', 'Tournament streak', 0xd0c, 0xd14, [['Singles', 2], ['Doubles', 20]],
    (m, l) => ({ label: 'Championships', best: 0xd1c + (m * 2 + l) * 2 }));
  add('Battle Palace', 'Win streak', 0xdc8, 0xdd0, [['Singles', 4], ['Doubles', 22]]);
  add('Battle Arena', 'Win streak', 0xdda, 0xdde, [['', 6]]);
  add('Battle Factory', 'Win streak', 0xde2, 0xdea, [['Singles', 8], ['Doubles', 24]],
    (m, l) => ({ label: 'Rentals', current: 0xdf2 + (m * 2 + l) * 2, best: 0xdfa + (m * 2 + l) * 2 }));
  add('Battle Pike', 'Rooms cleared', 0xe04, 0xe08, [['', 10]]);
  add('Battle Pyramid', 'Floors cleared', 0xe1a, 0xe1e, [['', 12]]);
  return out;
}

/** Every streak the Frontier keeps, in facility order. */
export const STREAK_ROWS: readonly StreakRow[] = rows();

/** One row's numbers as saved. */
export interface Streak { current: number; best: number; active: boolean; extraCurrent: number; extraBest: number }

const u16 = (d: Uint8Array, o: number) => d[o] | (d[o + 1] << 8);
const setU16 = (d: Uint8Array, o: number, v: number) => { d[o] = v & 0xff; d[o + 1] = (v >> 8) & 0xff; };
const u32 = (d: Uint8Array, o: number) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
const cap = (v: number) => Math.max(0, Math.min(STREAK_MAX, Math.floor(v)));

export function readStreaks(sb2: Uint8Array): Streak[] {
  const active = u32(sb2, ACTIVE_FLAGS);
  return STREAK_ROWS.map((r) => ({
    current: u16(sb2, r.current), best: u16(sb2, r.best), active: !!((active >>> r.activeBit) & 1),
    extraCurrent: r.extra?.current !== undefined ? u16(sb2, r.extra.current) : 0,
    extraBest: r.extra ? u16(sb2, r.extra.best) : 0,
  }));
}

/** Writes the rows that differ from `before`. A current streak edited above 0 is made to carry on, as after a won challenge. */
export function writeStreaks(sb2: Uint8Array, now: Streak[], before: Streak[]): void {
  let active = u32(sb2, ACTIVE_FLAGS);
  STREAK_ROWS.forEach((r, i) => {
    const a = now[i], b = before[i];
    if (a.current !== b.current) {
      setU16(sb2, r.current, cap(a.current));
      active = a.current > 0 ? active | (1 << r.activeBit) : active & ~(1 << r.activeBit);
    }
    if (a.best !== b.best) setU16(sb2, r.best, cap(a.best));
    if (r.extra?.current !== undefined && a.extraCurrent !== b.extraCurrent) setU16(sb2, r.extra.current, cap(a.extraCurrent));
    if (r.extra && a.extraBest !== b.extraBest) setU16(sb2, r.extra.best, cap(a.extraBest));
  });
  active >>>= 0;
  sb2[ACTIVE_FLAGS] = active & 0xff; sb2[ACTIVE_FLAGS + 1] = (active >>> 8) & 0xff;
  sb2[ACTIVE_FLAGS + 2] = (active >>> 16) & 0xff; sb2[ACTIVE_FLAGS + 3] = (active >>> 24) & 0xff;
}

export const rowLabel = (r: StreakRow) => `${r.facility}${r.mode ? ` ${r.mode}` : ''}, ${LEVELS[r.level]}`;
