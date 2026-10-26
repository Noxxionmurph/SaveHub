// Moving Pokémon around: between the party and the fourteen PC boxes, copying and reordering.
// Pure functions on the save model so the rules are testable without a page. The same rules as Gen 1, plus what
// Gold and Silver do when a Pokémon goes into or comes out of a box (see depositInBox / withdrawFromBox), and Mail:
// the game won't put a Pokémon holding Mail in a box, so neither does the editor.

import { isMail } from './data.ts';
import { BOX_COUNT, BOX_MAX, PARTY_MAX, depositInBox, withdrawFromBox, type Gen2Mon, type Gen2Save } from './save.ts';

/** `where` is PARTY or a box index 0-13. */
export const PARTY = -1;
export { BOX_MAX, PARTY_MAX };
export const BOX_TOTAL = BOX_COUNT;

export type Refusal = 'full' | 'last-party' | 'same' | 'missing' | 'mail' | 'last-healthy';

export const REFUSAL_TEXT: Record<Refusal, string> = {
  full: 'That place is full.',
  'last-party': 'Your party needs at least one Pokémon, so this one stays.',
  same: "It's already there.",
  missing: "That Pokémon isn't there any more.",
  mail: 'It’s holding Mail, and the game won’t put a Pokémon holding Mail in a box. Take the Mail off first (in the editor, change its held item).',
  'last-healthy': 'Your party needs a Pokémon that can battle (not an egg, and not fainted), so this one stays.',
};

export const listAt = (s: Gen2Save, where: number): Gen2Mon[] => (where === PARTY ? s.party : (s.boxes[where] ??= []));
export const capacityOf = (where: number): number => (where === PARTY ? PARTY_MAX : BOX_MAX);
export const spaceAt = (s: Gen2Save, where: number): number => capacityOf(where) - listAt(s, where).length;
export const placeName = (where: number): string => (where === PARTY ? 'Party' : `Box ${where + 1}`);

export const ALL_PLACES: readonly number[] = [PARTY, ...Array.from({ length: BOX_TOTAL }, (_, i) => i)];

const holdsMail = (mon: Gen2Mon) => isMail(mon.item);

/**
 * Would the party be left without a Pokémon that can battle if the one at `index` left (and `incoming`, from a box,
 * took its place)? The game refuses that (pokegold: BillsPC_CheckMail_PreventBlackout), counting eggs as fainted. A
 * Pokémon from a box arrives healed, so it counts unless it is an egg.
 */
function partyBreaks(s: Gen2Save, index: number, incoming?: Gen2Mon): Refusal | null {
  const rest = s.party.filter((_, i) => i !== index);
  if (!rest.length && !incoming) return 'last-party';
  const canBattle = rest.some((m) => !m.isEgg && m.hp > 0) || (incoming !== undefined && !incoming.isEgg);
  return canBattle ? null : 'last-healthy';
}

/** Why the party Pokémon at `index` can't leave the party (to a box, or removed), or null if it can. */
export const partyLeaveRefusal = (s: Gen2Save, index: number): Refusal | null => partyBreaks(s, index);

/** What happens to a Pokémon as it changes place. */
function arrive(mon: Gen2Mon, from: number, to: number): void {
  if (from === to) return;
  if (to === PARTY) withdrawFromBox(mon);
  else if (from === PARTY) depositInBox(mon);
}

export function moveMon(s: Gen2Save, from: number, index: number, to: number): Refusal | null {
  const mon = listAt(s, from)[index];
  if (!mon) return 'missing';
  if (from === to) return 'same';
  if (spaceAt(s, to) <= 0) return 'full';
  if (from === PARTY) {
    const r = partyBreaks(s, index);
    if (r) return r;
  }
  if (to !== PARTY && holdsMail(mon)) return 'mail';
  listAt(s, from).splice(index, 1);
  listAt(s, to).push(mon);
  arrive(mon, from, to);
  return null;
}

export function removeMon(s: Gen2Save, from: number, index: number): Refusal | null {
  if (!listAt(s, from)[index]) return 'missing';
  if (from === PARTY) {
    const r = partyBreaks(s, index);
    if (r) return r;
  }
  listAt(s, from).splice(index, 1);
  return null;
}

/**
 * Copy a Pokémon. The copy goes right after the original if that place has room, otherwise into the first box with
 * room. Returns where it went, or why it couldn't.
 */
export function copyMon(s: Gen2Save, from: number, index: number): { where: number; index: number } | Refusal {
  const mon = listAt(s, from)[index];
  if (!mon) return 'missing';
  const where = [from, ...ALL_PLACES.filter((w) => w !== PARTY)].find((w) => spaceAt(s, w) > 0);
  if (where === undefined) return 'full';
  if (where !== PARTY && holdsMail(mon)) return 'mail';
  const list = listAt(s, where);
  const at = where === from ? index + 1 : list.length;
  const copy = structuredClone(mon);
  list.splice(at, 0, copy);
  arrive(copy, from, where);
  return { where, index: at };
}

export interface Slot { where: number; index: number }

/**
 * Drag-and-drop: put the Pokémon at `from` where `to` is. Onto another Pokémon, the two swap places; onto an empty
 * spot, it goes to the end of that place (boxes are packed; the game has no gaps).
 */
export function dropMon(s: Gen2Save, from: Slot, to: Slot): { kind: 'swap' | 'move' } | Refusal {
  const mon = listAt(s, from.where)[from.index];
  if (!mon) return 'missing';
  const other = listAt(s, to.where)[to.index];

  if (!other) {
    if (from.where === to.where) {
      const list = listAt(s, from.where);
      if (from.index === list.length - 1) return 'same';
      list.push(list.splice(from.index, 1)[0]);
      return { kind: 'move' };
    }
    return moveMon(s, from.where, from.index, to.where) ?? { kind: 'move' };
  }

  if (from.where === to.where && from.index === to.index) return 'same';
  if (from.where !== to.where) {
    if (to.where !== PARTY && holdsMail(mon)) return 'mail';
    if (from.where !== PARTY && holdsMail(other)) return 'mail';
    if (from.where === PARTY) { const r = partyBreaks(s, from.index, other); if (r) return r; }
    if (to.where === PARTY) { const r = partyBreaks(s, to.index, mon); if (r) return r; }
  }
  listAt(s, from.where)[from.index] = other;
  listAt(s, to.where)[to.index] = mon;
  arrive(mon, from.where, to.where);
  arrive(other, to.where, from.where);
  return { kind: 'swap' };
}

/** Swap with the neighbour above (-1) or below (+1). */
export function shiftMon(s: Gen2Save, where: number, index: number, delta: -1 | 1): boolean {
  const list = listAt(s, where);
  const other = index + delta;
  if (!list[index] || !list[other]) return false;
  [list[index], list[other]] = [list[other], list[index]];
  return true;
}
