// Moving Pokémon around: between the party and the twelve PC boxes, copying and reordering.
// Pure functions on the save model so the rules are testable without a page.

import { recalcPartyStats, type Gen1Mon, type Gen1Save } from './save.ts';

/** `where` is PARTY or a box index 0-11 (the same numbering the diff uses). */
export const PARTY = -1;
export const PARTY_MAX = 6;
export const BOX_MAX = 20;
export const BOX_TOTAL = 12;

/** Why a change was refused. */
export type Refusal = 'full' | 'last-party' | 'same' | 'missing';

export const listAt = (s: Gen1Save, where: number): Gen1Mon[] => (where === PARTY ? s.party : (s.boxes[where] ??= []));
export const capacityOf = (where: number): number => (where === PARTY ? PARTY_MAX : BOX_MAX);
export const spaceAt = (s: Gen1Save, where: number): number => capacityOf(where) - listAt(s, where).length;
export const placeName = (where: number): string => (where === PARTY ? 'Party' : `Box ${where + 1}`);

/** Every place a Pokémon can live, party first. */
export const ALL_PLACES: readonly number[] = [PARTY, ...Array.from({ length: BOX_TOTAL }, (_, i) => i)];

/** The game can't run with an empty party, so the last Pokémon in it stays. */
const isLastInParty = (s: Gen1Save, where: number) => where === PARTY && s.party.length <= 1;

/** Move one Pokémon to the end of another place. Returns why it couldn't, or null on success. */
export function moveMon(s: Gen1Save, from: number, index: number, to: number): Refusal | null {
  const mon = listAt(s, from)[index];
  if (!mon) return 'missing';
  if (from === to) return 'same';
  if (spaceAt(s, to) <= 0) return 'full';
  if (isLastInParty(s, from)) return 'last-party';
  listAt(s, from).splice(index, 1);
  listAt(s, to).push(mon);
  if (to === PARTY) recalcPartyStats(mon); // boxed Pokémon don't carry battle stats
  return null;
}

export function removeMon(s: Gen1Save, from: number, index: number): Refusal | null {
  if (!listAt(s, from)[index]) return 'missing';
  if (isLastInParty(s, from)) return 'last-party';
  listAt(s, from).splice(index, 1);
  return null;
}

/**
 * Copy a Pokémon. The copy goes right after the original if that place has room, otherwise into the
 * first box with room. Returns where it went, or why it couldn't.
 */
export function copyMon(s: Gen1Save, from: number, index: number): { where: number; index: number } | Refusal {
  const mon = listAt(s, from)[index];
  if (!mon) return 'missing';
  const where = [from, ...ALL_PLACES.filter((w) => w !== PARTY)].find((w) => spaceAt(s, w) > 0);
  if (where === undefined) return 'full';
  const list = listAt(s, where);
  const at = where === from ? index + 1 : list.length;
  list.splice(at, 0, structuredClone(mon));
  return { where, index: at };
}

/** Swap with the neighbour above (-1) or below (+1). */
export function shiftMon(s: Gen1Save, where: number, index: number, delta: -1 | 1): boolean {
  const list = listAt(s, where);
  const other = index + delta;
  if (!list[index] || !list[other]) return false;
  [list[index], list[other]] = [list[other], list[index]];
  return true;
}
