// Crystal's caught data: two bytes in every Pokémon (pokecrystal: MON_CAUGHTDATA, set by SetCaughtData when one is
// caught, hatched or given). Gold and Silver never write them, so a Pokémon traded over from those reads as all zeros.
//
//   byte 1  bits 6-7 time of day (1 morning, 2 day, 3 night, 0 not recorded), bits 0-5 the level it was caught at
//   byte 2  bit 7 the original trainer's gender (set for a girl), bits 0-6 the landmark where it was caught

import { LANDMARK_NAMES } from './crystalTables.ts';

export type CaughtTime = 'morning' | 'day' | 'night' | null;
export interface CaughtData {
  time: CaughtTime;
  /** 0-63. Eggs record level 1 (the level they hatched at). */
  level: number;
  /** A landmark id: see LANDMARK_NAMES, plus LANDMARK_GIFT and LANDMARK_EVENT. */
  location: number;
  otGender: 'boy' | 'girl';
}

export const LANDMARK_GIFT = 0x7e;
export const LANDMARK_EVENT = 0x7f;
export const CAUGHT_LEVEL_MAX = 63;
const TIMES: CaughtTime[] = [null, 'morning', 'day', 'night'];

export function decodeCaught([a, b]: readonly [number, number]): CaughtData {
  return { time: TIMES[a >> 6], level: a & 0x3f, location: b & 0x7f, otGender: b & 0x80 ? 'girl' : 'boy' };
}

export function encodeCaught(c: CaughtData): [number, number] {
  return [(TIMES.indexOf(c.time) << 6) | (Math.max(0, Math.min(CAUGHT_LEVEL_MAX, Math.floor(c.level))) & 0x3f),
    (c.otGender === 'girl' ? 0x80 : 0) | (c.location & 0x7f)];
}

/** The place name for a landmark id, as the editor lists it. */
export function locationName(id: number): string {
  if (id === 0) return 'Not recorded';
  if (id === LANDMARK_GIFT) return 'Gift';
  if (id === LANDMARK_EVENT) return 'Event';
  return LANDMARK_NAMES[id] || `Place 0x${id.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** Every place a picker offers, in the game's order (Johto, then Kanto), with gift and event at the end. */
export const LOCATION_CHOICES: readonly { id: number; name: string }[] = [
  0, ...LANDMARK_NAMES.map((_, i) => i).slice(1), LANDMARK_GIFT, LANDMARK_EVENT,
].map((id) => ({ id, name: locationName(id) }));
