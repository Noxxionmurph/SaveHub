// Turns "what the user edited" into plain sentences for the review dialog shown before Save.
// Compares two models of the same save (as first loaded vs. now). Nothing here touches bytes.

import type { ChangeGroup } from '../types.ts';
import { BADGE_NAMES, MOVE_NAMES, TEXT_SPEEDS, itemName, speciesName } from './data.ts';
import type { BagItem, Gen1Mon, Gen1Save } from './save.ts';

const CAP = 12;

function group(title: string, lines: string[], cap = CAP): ChangeGroup | null {
  if (!lines.length) return null;
  return lines.length > cap
    ? { title, lines: lines.slice(0, cap), more: lines.length - cap }
    : { title, lines };
}

const money = (n: number) => `¥${n.toLocaleString('en-US')}`;
const clock = (s: Gen1Save) => `${s.playHours}:${String(s.playMinutes).padStart(2, '0')}:${String(s.playSeconds).padStart(2, '0')}`;
const textSpeedName = (v: number) => TEXT_SPEEDS.find((t) => t.value === v)?.label ?? `Custom (${v})`;

// ---------- trainer ----------

function trainerLines(b: Gen1Save, a: Gen1Save): string[] {
  const out: string[] = [];
  if (b.trainerName !== a.trainerName) out.push(`Name: ${b.trainerName} → ${a.trainerName}`);
  if (b.rivalName !== a.rivalName) out.push(`Rival: ${b.rivalName} → ${a.rivalName}`);
  if (b.trainerId !== a.trainerId) out.push(`Trainer ID: ${String(b.trainerId).padStart(5, '0')} → ${String(a.trainerId).padStart(5, '0')}`);
  if (b.trainerId !== a.trainerId) {
    // The game decides "traded" by comparing a Pokémon's original trainer ID with the player's, nothing else.
    const orphaned = slots(a).filter((s) => s.mon.otId === b.trainerId).length;
    if (orphaned) {
      out.push(`Warning: ${orphaned} ${orphaned === 1 ? 'Pokémon was' : 'Pokémon were'} caught under your old Trainer ID, so the game will now count ${orphaned === 1 ? 'it' : 'them'} as traded. ${orphaned === 1 ? 'It earns' : 'They earn'} extra experience, and may ignore your orders until you have more badges.`);
    }
  }
  if (b.money !== a.money) out.push(`Money: ${money(b.money)} → ${money(a.money)}`);
  if (b.coins !== a.coins) out.push(`Coins: ${b.coins.toLocaleString('en-US')} → ${a.coins.toLocaleString('en-US')}`);
  if (clock(b) !== clock(a)) out.push(`Play time: ${clock(b)} → ${clock(a)}`);
  const gained = BADGE_NAMES.filter((_, i) => !((b.badges >> i) & 1) && (a.badges >> i) & 1);
  const lost = BADGE_NAMES.filter((_, i) => ((b.badges >> i) & 1) && !((a.badges >> i) & 1));
  if (gained.length) out.push(`Badges earned: ${gained.join(', ')}`);
  if (lost.length) out.push(`Badges removed: ${lost.join(', ')}`);
  return out;
}

// ---------- items ----------

function itemLines(before: BagItem[], after: BagItem[]): string[] {
  const total = (list: BagItem[]) => {
    const m = new Map<number, number>();
    for (const it of list) m.set(it.id, (m.get(it.id) ?? 0) + it.count);
    return m;
  };
  const b = total(before), a = total(after);
  const out: string[] = [];
  for (const [id, n] of a) {
    const was = b.get(id);
    if (was === undefined) out.push(`Added ${itemName(id)} ×${n}`);
    else if (was !== n) out.push(`${itemName(id)}: ${was} → ${n}`);
  }
  for (const id of b.keys()) if (!a.has(id)) out.push(`Removed ${itemName(id)}`);
  return out;
}

// ---------- Pokédex ----------

function dexLines(b: Gen1Save, a: Gen1Save): string[] {
  const count = (s: Gen1Save, f: (dex: number) => number) => { let n = 0; for (let d = 1; d <= 151; d++) n += f(d); return n; };
  const out: string[] = [];
  const bo = count(b, b.isOwned), ao = count(a, a.isOwned);
  const bs = count(b, b.isSeen), as = count(a, a.isSeen);
  if (bo !== ao) out.push(`Owned: ${bo} → ${ao}`);
  if (bs !== as) out.push(`Seen: ${bs} → ${as}`);
  const same = (x: Uint8Array, y: Uint8Array) => x.length === y.length && x.every((v, i) => v === y[i]);
  if (bo === ao && bs === as && (!same(b.dexOwned, a.dexOwned) || !same(b.dexSeen, a.dexSeen))) out.push('Some entries changed');
  return out;
}

// ---------- options ----------

function optionLines(b: Gen1Save, a: Gen1Save): string[] {
  const out: string[] = [];
  if (b.options.textSpeed !== a.options.textSpeed) out.push(`Text speed: ${textSpeedName(b.options.textSpeed)} → ${textSpeedName(a.options.textSpeed)}`);
  if (b.options.battleStyleSet !== a.options.battleStyleSet) out.push(`Battle style: ${b.options.battleStyleSet ? 'Set' : 'Shift'} → ${a.options.battleStyleSet ? 'Set' : 'Shift'}`);
  if (b.options.battleAnimationsOff !== a.options.battleAnimationsOff) out.push(`Battle animations: ${b.options.battleAnimationsOff ? 'Off' : 'On'} → ${a.options.battleAnimationsOff ? 'Off' : 'On'}`);
  return out;
}

// ---------- Pokémon ----------

/** Where a Pokémon sits: box -1 is the party. */
interface Slot { mon: Gen1Mon; box: number; index: number }
interface Pair { b: Slot; a: Slot }

const place = (s: { box: number; index: number }) => (s.box < 0 ? `Party ${s.index + 1}` : `Box ${s.box + 1}, slot ${s.index + 1}`);
const containerName = (box: number) => (box < 0 ? 'Party' : `Box ${box + 1}`);

function label(m: Gen1Mon): string {
  const species = speciesName(m.species);
  return m.nickname && m.nickname.toUpperCase() !== species.toUpperCase() ? `${species} “${m.nickname}”` : species;
}

/** Everything that identifies one Pokémon, ignoring where it is (party-only stats are derived anyway). */
const signature = (m: Gen1Mon) => JSON.stringify([
  m.species, m.level, m.exp, m.hp, m.status, m.type1, m.type2, m.catchRate, m.moves, m.pp, m.ppUps,
  m.otId, m.otName, m.nickname, m.dvs, m.evs,
]);

function slots(save: Gen1Save): Slot[] {
  const out: Slot[] = save.party.map((mon, index) => ({ mon, box: -1, index }));
  save.boxes.forEach((list, box) => list.forEach((mon, index) => out.push({ mon, box, index })));
  return out;
}

/** Pair up Pokémon from before and after, strictest match first, so each real edit shows up as one line. */
function pairUp(before: Slot[], after: Slot[]): { pairs: Pair[]; removed: Slot[]; added: Slot[] } {
  const pairs: Pair[] = [];
  let restB = before, restA = after;
  const sameSpot = (x: Slot, y: Slot) => x.box === y.box && x.index === y.index;
  const pass = (key: (s: Slot) => string) => {
    const pool = new Map<string, Slot[]>();
    for (const b of restB) { const k = key(b); (pool.get(k) ?? pool.set(k, []).get(k)!).push(b); }
    const unmatched: Slot[] = [];
    // Same spot first, so a duplicate (an extra identical copy) is the one that counts as new.
    const leftA: Slot[] = [];
    for (const a of restA) {
      const c = pool.get(key(a));
      const i = c ? c.findIndex((b) => sameSpot(b, a)) : -1;
      if (c && i >= 0) pairs.push({ b: c.splice(i, 1)[0], a }); else leftA.push(a);
    }
    for (const a of leftA) {
      const c = pool.get(key(a));
      if (c?.length) pairs.push({ b: c.shift()!, a }); else unmatched.push(a);
    }
    restB = [...pool.values()].flat();
    restA = unmatched;
  };
  const who = (m: Gen1Mon) => `${m.species}|${m.otId}|${m.otName}`;
  pass((s) => signature(s.mon)); // untouched (it may just have moved)
  pass((s) => `${who(s.mon)}|${s.box}|${s.index}`); // edited in place
  pass((s) => who(s.mon)); // edited and moved
  pass((s) => `${s.box}|${s.index}`); // something else in the same slot
  // A different species at a different level is a replacement, not an edit; say "removed" and "added".
  const kept = pairs.filter((p) => p.b.mon.species === p.a.mon.species || p.b.mon.level === p.a.mon.level);
  const split = pairs.filter((p) => !kept.includes(p));
  return { pairs: kept, removed: [...restB, ...split.map((p) => p.b)], added: [...restA, ...split.map((p) => p.a)] };
}

const moveList = (m: Gen1Mon) => m.moves.filter(Boolean).map((id) => MOVE_NAMES[id] ?? `#${id}`).join(', ') || 'none';
const same4 = (x: readonly number[], y: readonly number[]) => x.every((v, i) => v === y[i]);

function monChanges(b: Gen1Mon, a: Gen1Mon): string[] {
  const out: string[] = [];
  if (b.species !== a.species) out.push(`species ${speciesName(b.species)} → ${speciesName(a.species)}`);
  if (b.nickname !== a.nickname) out.push(`nickname ${b.nickname || '(none)'} → ${a.nickname || '(none)'}`);
  if (b.level !== a.level) out.push(`level ${b.level} → ${a.level}`);
  else if (b.exp !== a.exp) out.push('experience changed');
  if (b.hp !== a.hp) out.push(`HP ${b.hp} → ${a.hp}`);
  if (b.status !== a.status) out.push(a.status === 0 ? 'status cleared' : 'status changed');
  if (!same4(b.moves, a.moves)) out.push(`moves ${moveList(b)} → ${moveList(a)}`);
  else if (!same4(b.pp, a.pp) || !same4(b.ppUps, a.ppUps)) out.push('PP changed');
  if (JSON.stringify(b.dvs) !== JSON.stringify(a.dvs)) out.push('DVs changed');
  if (JSON.stringify(b.evs) !== JSON.stringify(a.evs)) out.push('stat experience changed');
  if (b.otName !== a.otName) out.push(`OT ${b.otName || '(none)'} → ${a.otName || '(none)'}`);
  if (b.otId !== a.otId) out.push('OT ID changed');
  if (b.species === a.species && (b.type1 !== a.type1 || b.type2 !== a.type2)) out.push('types changed');
  return out;
}

function pokemonLines(b: Gen1Save, a: Gen1Save): string[] {
  const { pairs, removed, added } = pairUp(slots(b), slots(a));
  const order = (x: Slot, y: Slot) => x.box - y.box || x.index - y.index;
  const lines: string[] = [];

  for (const { b: sb, a: sa } of [...pairs].sort((p, q) => order(p.a, q.a))) {
    const crossed = sb.box !== sa.box; // moved between party and boxes, or between boxes
    const edits = monChanges(sb.mon, sa.mon);
    // Moving within one container only reorders; the order check below covers that.
    if (!crossed && !edits.length) continue;
    lines.push(crossed
      ? `${label(sa.mon)}: ${[`${place(sb)} → ${place(sa)}`, ...edits].join(', ')}`
      : `${label(sa.mon)} (${place(sa)}): ${edits.join(', ')}`);
  }

  // Order changes inside one container: the Pokémon that stayed put no longer appear in the same sequence.
  const containers = new Set(pairs.filter((p) => p.b.box === p.a.box).map((p) => p.a.box));
  for (const c of [...containers].sort((x, y) => x - y)) {
    const inside = pairs.filter((p) => p.b.box === c && p.a.box === c).sort((x, y) => x.b.index - y.b.index);
    if (inside.some((p, i) => i > 0 && p.a.index < inside[i - 1].a.index)) lines.push(`${containerName(c)} order changed`);
  }

  for (const s of [...added].sort(order)) lines.push(`Added ${label(s.mon)} Lv ${s.mon.level} to ${place(s)}`);
  for (const s of [...removed].sort(order)) lines.push(`Removed ${label(s.mon)} Lv ${s.mon.level} from ${place(s)}`);
  return lines;
}

// ---------- Yellow: the starter Pikachu ----------

function pikachuLines(b: Gen1Save, a: Gen1Save): string[] {
  if (!a.isYellow) return [];
  const out: string[] = [];
  if (b.pikachuFriendship !== a.pikachuFriendship) out.push(`Friendship: ${b.pikachuFriendship} → ${a.pikachuFriendship}`);
  // The game finds your Pikachu by its original trainer, so editing your name or ID (or moving it out of the
  // party) quietly stops it following you.
  if (b.party.some((m) => b.isStarterPikachu(m)) && !a.party.some((m) => a.isStarterPikachu(m))) {
    out.push("Warning: your starter Pikachu will stop following you, because it has left your party or its original trainer no longer matches your name and Trainer ID. The Trainer tab has a button to fix this.");
  }
  return out;
}

// ---------- everything ----------

export function describeGen1Changes(before: Gen1Save, after: Gen1Save): ChangeGroup[] {
  return [
    group('Trainer', trainerLines(before, after)),
    group('Bag', itemLines(before.bag, after.bag)),
    group('PC items', itemLines(before.pcItems, after.pcItems)),
    group('Pokémon', pokemonLines(before, after), 14),
    group('Pokédex', dexLines(before, after)),
    group('Pikachu', pikachuLines(before, after)),
    group('Options', optionLines(before, after)),
  ].filter((g): g is ChangeGroup => g !== null);
}
