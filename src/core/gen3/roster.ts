// Moving Pokémon around in Ruby, Sapphire and Emerald: between the party and the fourteen PC boxes, copying and
// reordering. Pure functions on the save model so the rules are testable without a page.
// Unlike Gen 1 and 2, a Gen 3 box is 30 fixed spots and can have gaps, so a Pokémon dropped on an empty spot goes to
// that spot. The party is still a packed list of up to six. The game's PC rules apply: a Pokémon holding Mail can't go
// in a box, the party keeps one Pokémon that can battle, a Pokémon taken out of a box is healed and one put in has its
// PP restored.

import { isMail } from './data.ts';
import { BOX_COUNT, BOX_SLOTS, PARTY_MAX, depositInBox, withdrawFromBox, type Gen3Mon, type Gen3Save } from './save.ts';

/** `where` is PARTY or a box index 0-13. */
export const PARTY = -1;
export { BOX_SLOTS, PARTY_MAX };
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

export interface Slot { where: number; index: number }

export const monAt = (s: Gen3Save, where: number, index: number): Gen3Mon | null =>
  (where === PARTY ? s.party[index] : s.boxes[where]?.[index]) ?? null;
export const capacityOf = (where: number): number => (where === PARTY ? PARTY_MAX : BOX_SLOTS);
export const countAt = (s: Gen3Save, where: number): number =>
  (where === PARTY ? s.party.length : s.boxes[where].filter(Boolean).length);
export const spaceAt = (s: Gen3Save, where: number): number => capacityOf(where) - countAt(s, where);
export const placeName = (where: number): string => (where === PARTY ? 'Party' : `Box ${where + 1}`);
export const ALL_PLACES: readonly number[] = [PARTY, ...Array.from({ length: BOX_TOTAL }, (_, i) => i)];

const holdsMail = (mon: Gen3Mon) => isMail(mon.item);
const firstGap = (s: Gen3Save, box: number) => s.boxes[box].findIndex((m) => !m);

/**
 * Would the party be left without a Pokémon that can battle if the one at `index` left (and `incoming`, from a box,
 * took its place)? The game refuses that, counting eggs as unable. A Pokémon from a box arrives healed.
 */
function partyBreaks(s: Gen3Save, index: number, incoming?: Gen3Mon): Refusal | null {
  const rest = s.party.filter((_, i) => i !== index);
  if (!rest.length && !incoming) return 'last-party';
  const canBattle = rest.some((m) => !m.isEgg && !m.bad && m.hp > 0) || (incoming !== undefined && !incoming.isEgg && !incoming.bad);
  return canBattle ? null : 'last-healthy';
}

export const partyLeaveRefusal = (s: Gen3Save, index: number): Refusal | null => partyBreaks(s, index);

function arrive(mon: Gen3Mon, from: number, to: number): void {
  if (from === to || mon.bad) return;
  if (to === PARTY) withdrawFromBox(mon);
  else if (from === PARTY) depositInBox(mon);
}

function take(s: Gen3Save, where: number, index: number): void {
  if (where === PARTY) s.party.splice(index, 1);
  else s.boxes[where][index] = null;
}

/** Put a Pokémon at the end of the party, or the first gap of a box. Returns where it went. */
function put(s: Gen3Save, where: number, mon: Gen3Mon): number {
  if (where === PARTY) { s.party.push(mon); return s.party.length - 1; }
  const i = firstGap(s, where);
  s.boxes[where][i] = mon;
  return i;
}

/** Move to another place (the end of the party, or a box's first empty spot). */
export function moveMon(s: Gen3Save, from: number, index: number, to: number): Refusal | null {
  const mon = monAt(s, from, index);
  if (!mon) return 'missing';
  if (from === to) return 'same';
  if (spaceAt(s, to) <= 0) return 'full';
  if (from === PARTY) { const r = partyBreaks(s, index); if (r) return r; }
  if (to !== PARTY && holdsMail(mon)) return 'mail';
  take(s, from, index);
  put(s, to, mon);
  arrive(mon, from, to);
  return null;
}

export function removeMon(s: Gen3Save, from: number, index: number): Refusal | null {
  if (!monAt(s, from, index)) return 'missing';
  if (from === PARTY) { const r = partyBreaks(s, index); if (r) return r; }
  take(s, from, index);
  return null;
}

/** Copy a Pokémon: right after the original if there's room there, otherwise into the first box with room. */
export function copyMon(s: Gen3Save, from: number, index: number): Slot | Refusal {
  const mon = monAt(s, from, index);
  if (!mon) return 'missing';
  const where = [from, ...ALL_PLACES.filter((w) => w !== PARTY)].find((w) => spaceAt(s, w) > 0);
  if (where === undefined) return 'full';
  if (where !== PARTY && holdsMail(mon)) return 'mail';
  const copy = structuredClone(mon);
  let at: number;
  if (where === PARTY) { at = index + 1; s.party.splice(at, 0, copy); }
  else if (where === from && !s.boxes[where][index + 1]) { at = index + 1; s.boxes[where][at] = copy; }
  else at = put(s, where, copy);
  arrive(copy, from, where);
  return { where, index: at };
}

/**
 * Drag-and-drop: put the Pokémon at `from` where `to` is. Onto another Pokémon, the two swap places. Onto an empty spot
 * in a box it goes to that spot; onto an empty spot in the party it goes to the end (the party has no gaps).
 */
export function dropMon(s: Gen3Save, from: Slot, to: Slot): { kind: 'swap' | 'move' } | Refusal {
  const mon = monAt(s, from.where, from.index);
  if (!mon) return 'missing';
  const other = monAt(s, to.where, to.index);
  if (from.where === to.where && from.index === to.index) return 'same';

  if (!other) {
    if (to.where === PARTY) {
      if (from.where === PARTY) {
        if (from.index === s.party.length - 1) return 'same';
        s.party.push(s.party.splice(from.index, 1)[0]);
        return { kind: 'move' };
      }
      return moveMon(s, from.where, from.index, PARTY) ?? { kind: 'move' };
    }
    if (holdsMail(mon) && from.where === PARTY) return 'mail';
    if (from.where === PARTY) { const r = partyBreaks(s, from.index); if (r) return r; }
    take(s, from.where, from.index);
    s.boxes[to.where][to.index] = mon;
    arrive(mon, from.where, to.where);
    return { kind: 'move' };
  }

  if (from.where !== to.where) {
    if (to.where !== PARTY && holdsMail(mon)) return 'mail';
    if (from.where !== PARTY && holdsMail(other)) return 'mail';
    if (from.where === PARTY) { const r = partyBreaks(s, from.index, other); if (r) return r; }
    if (to.where === PARTY) { const r = partyBreaks(s, to.index, mon); if (r) return r; }
  }
  const set = (slot: Slot, m: Gen3Mon) => { if (slot.where === PARTY) s.party[slot.index] = m; else s.boxes[slot.where][slot.index] = m; };
  set(from, other);
  set(to, mon);
  arrive(mon, from.where, to.where);
  arrive(other, to.where, from.where);
  return { kind: 'swap' };
}

/** Swap with the neighbour above (-1) or below (+1); in a box, an empty neighbour spot works too. */
export function shiftMon(s: Gen3Save, where: number, index: number, delta: -1 | 1): boolean {
  const other = index + delta;
  if (where === PARTY) {
    if (!s.party[index] || !s.party[other]) return false;
    [s.party[index], s.party[other]] = [s.party[other], s.party[index]];
    return true;
  }
  const box = s.boxes[where];
  if (!box[index] || other < 0 || other >= BOX_SLOTS) return false;
  [box[index], box[other]] = [box[other], box[index]];
  return true;
}
