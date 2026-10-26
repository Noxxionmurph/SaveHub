// Turns "what the user edited" into plain sentences for the review dialog shown before Save.
// Compares two models of the same save (as first loaded vs. now). Nothing here touches bytes.

import type { ChangeGroup } from '../types.ts';
import {
  DEX_COUNT, JOHTO_BADGES, KANTO_BADGES, MOVE_NAMES, PRINT_SHADES, TEXT_SPEEDS, TMHM_LABELS, TMHM_MOVES, genderOf, isShiny, itemName as nameOf,
  speciesName, UNOWN, unownLetter, type ItemSet,
} from './data.ts';
import type { BagItem, Gen2Mon, Gen2Save } from './save.ts';

const CAP = 12;

function group(title: string, lines: string[], cap = CAP): ChangeGroup | null {
  if (!lines.length) return null;
  return lines.length > cap ? { title, lines: lines.slice(0, cap), more: lines.length - cap } : { title, lines };
}

const money = (n: number) => `¥${n.toLocaleString('en-US')}`;
const clock = (s: Gen2Save) => `${s.playHours}:${String(s.playMinutes).padStart(2, '0')}:${String(s.playSeconds).padStart(2, '0')}`;
const textSpeedName = (v: number) => TEXT_SPEEDS.find((t) => t.value === v)?.label ?? `Custom (${v})`;
const shadeName = (v: number) => PRINT_SHADES.find((t) => t.value === v)?.label ?? `Custom (${v})`;

// ---------- trainer ----------

function badgeLines(names: readonly string[], b: number, a: number): string[] {
  const gained = names.filter((_, i) => !((b >> i) & 1) && (a >> i) & 1);
  const lost = names.filter((_, i) => (b >> i) & 1 && !((a >> i) & 1));
  return [
    ...(gained.length ? [`Badges earned: ${gained.join(', ')}`] : []),
    ...(lost.length ? [`Badges removed: ${lost.join(', ')}`] : []),
  ];
}

function trainerLines(b: Gen2Save, a: Gen2Save): string[] {
  const out: string[] = [];
  if (b.trainerName !== a.trainerName) out.push(`Name: ${b.trainerName} → ${a.trainerName}`);
  if (b.playerGender !== a.playerGender) out.push(`Plays as: ${b.playerGender === 'girl' ? 'girl' : 'boy'} → ${a.playerGender === 'girl' ? 'girl' : 'boy'}`);
  if (b.rivalName !== a.rivalName) out.push(`Rival: ${b.rivalName} → ${a.rivalName}`);
  if (b.momName !== a.momName) out.push(`Mom: ${b.momName} → ${a.momName}`);
  if (b.trainerId !== a.trainerId) {
    out.push(`Trainer ID: ${String(b.trainerId).padStart(5, '0')} → ${String(a.trainerId).padStart(5, '0')}`);
    // The game decides "traded" by comparing a Pokémon's original trainer ID with the player's.
    const orphaned = slots(a).filter((s) => !s.mon.isEgg && s.mon.otId === b.trainerId).length;
    if (orphaned) {
      out.push(`Warning: ${orphaned} ${orphaned === 1 ? 'Pokémon was' : 'Pokémon were'} caught under your old Trainer ID, so the game will now count ${orphaned === 1 ? 'it' : 'them'} as traded. ${orphaned === 1 ? 'It earns' : 'They earn'} extra experience, and may ignore your orders until you have more badges.`);
    }
  }
  if (b.money !== a.money) out.push(`Money: ${money(b.money)} → ${money(a.money)}`);
  if (b.momsMoney !== a.momsMoney) out.push(`Mom’s savings: ${money(b.momsMoney)} → ${money(a.momsMoney)}`);
  if (b.coins !== a.coins) out.push(`Coins: ${b.coins.toLocaleString('en-US')} → ${a.coins.toLocaleString('en-US')}`);
  if (clock(b) !== clock(a)) out.push(`Play time: ${clock(b)} → ${clock(a)}`);
  out.push(...badgeLines(JOHTO_BADGES, b.johtoBadges, a.johtoBadges), ...badgeLines(KANTO_BADGES, b.kantoBadges, a.kantoBadges));
  return out;
}

// ---------- items ----------

function itemLines(before: BagItem[], after: BagItem[], set: ItemSet): string[] {
  const itemName = (id: number) => nameOf(id, set);
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

const asItems = (ids: number[]): BagItem[] => ids.map((id) => ({ id, count: 1 }));

function tmLines(b: number[], a: number[]): string[] {
  const out: string[] = [];
  a.forEach((n, i) => {
    if (n === b[i]) return;
    const what = `${TMHM_LABELS[i]} ${MOVE_NAMES[TMHM_MOVES[i]] ?? ''}`.trim();
    if (!b[i]) out.push(`Added ${what}${n > 1 ? ` ×${n}` : ''}`);
    else if (!n) out.push(`Removed ${what}`);
    else out.push(`${what}: ${b[i]} → ${n}`);
  });
  return out;
}

// ---------- Pokédex ----------

function dexLines(b: Gen2Save, a: Gen2Save): string[] {
  const count = (f: (dex: number) => number) => { let n = 0; for (let d = 1; d <= DEX_COUNT; d++) n += f(d); return n; };
  const out: string[] = [];
  const bo = count(b.isOwned), ao = count(a.isOwned), bs = count(b.isSeen), as = count(a.isSeen);
  if (bo !== ao) out.push(`Caught: ${bo} → ${ao}`);
  if (bs !== as) out.push(`Seen: ${bs} → ${as}`);
  const same = (x: Uint8Array, y: Uint8Array) => x.every((v, i) => v === y[i]);
  if (bo === ao && bs === as && (!same(b.dexCaught, a.dexCaught) || !same(b.dexSeen, a.dexSeen))) out.push('Some entries changed');
  return out;
}

// ---------- options ----------

function optionLines(b: Gen2Save, a: Gen2Save): string[] {
  const out: string[] = [];
  const o = b.options, n = a.options;
  const onOff = (v: boolean) => (v ? 'On' : 'Off');
  if (o.textSpeed !== n.textSpeed) out.push(`Text speed: ${textSpeedName(o.textSpeed)} → ${textSpeedName(n.textSpeed)}`);
  if (o.battleSceneOff !== n.battleSceneOff) out.push(`Battle scene: ${onOff(!o.battleSceneOff)} → ${onOff(!n.battleSceneOff)}`);
  if (o.battleStyleSet !== n.battleStyleSet) out.push(`Battle style: ${o.battleStyleSet ? 'Set' : 'Shift'} → ${n.battleStyleSet ? 'Set' : 'Shift'}`);
  if (o.stereo !== n.stereo) out.push(`Sound: ${o.stereo ? 'Stereo' : 'Mono'} → ${n.stereo ? 'Stereo' : 'Mono'}`);
  if (o.printShade !== n.printShade) out.push(`Print: ${shadeName(o.printShade)} → ${shadeName(n.printShade)}`);
  if (o.menuAccount !== n.menuAccount) out.push(`Menu account: ${onOff(o.menuAccount)} → ${onOff(n.menuAccount)}`);
  if (o.frame !== n.frame) out.push(`Frame: Type ${o.frame + 1} → Type ${n.frame + 1}`);
  return out;
}

function boxNameLines(b: Gen2Save, a: Gen2Save): string[] {
  return a.boxNames.flatMap((name, i) => (name === b.boxNames[i] ? [] : [`Box ${i + 1} name: ${b.boxNames[i]} → ${name}`]));
}

// ---------- Pokémon ----------

interface Slot { mon: Gen2Mon; box: number; index: number }
interface Pair { b: Slot; a: Slot }

const place = (s: { box: number; index: number }) => (s.box < 0 ? `Party ${s.index + 1}` : `Box ${s.box + 1}, slot ${s.index + 1}`);
const containerName = (box: number) => (box < 0 ? 'Party' : `Box ${box + 1}`);

function label(m: Gen2Mon): string {
  if (m.isEgg) return `Egg (${speciesName(m.species)})`;
  const species = speciesName(m.species);
  return m.nickname && m.nickname.toUpperCase() !== species.toUpperCase() ? `${species} “${m.nickname}”` : species;
}

/** Everything that identifies one Pokémon wherever it is. Party-only numbers are left out, since a move to a box drops them. */
const signature = (m: Gen2Mon) => JSON.stringify([
  m.species, m.isEgg, m.item, m.level, m.exp, m.moves, m.ppUps, m.otId, m.otName, m.nickname, m.dvs, m.evs, m.friendship, m.pokerus,
]);

function slots(save: Gen2Save): Slot[] {
  const out: Slot[] = save.party.map((mon, index) => ({ mon, box: -1, index }));
  save.boxes.forEach((list, box) => list.forEach((mon, index) => out.push({ mon, box, index })));
  return out;
}

function pairUp(before: Slot[], after: Slot[]): { pairs: Pair[]; removed: Slot[]; added: Slot[] } {
  const pairs: Pair[] = [];
  let restB = before, restA = after;
  const sameSpot = (x: Slot, y: Slot) => x.box === y.box && x.index === y.index;
  const pass = (key: (s: Slot) => string) => {
    const pool = new Map<string, Slot[]>();
    for (const b of restB) { const k = key(b); (pool.get(k) ?? pool.set(k, []).get(k)!).push(b); }
    const unmatched: Slot[] = [];
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
  const who = (m: Gen2Mon) => `${m.species}|${m.otId}|${m.otName}|${m.dvs.atk}${m.dvs.def}${m.dvs.spe}${m.dvs.spc}`;
  pass((s) => signature(s.mon)); // untouched (it may just have moved)
  pass((s) => `${who(s.mon)}|${s.box}|${s.index}`); // edited in place
  pass((s) => `${s.mon.species}|${s.mon.otId}|${s.mon.otName}|${s.box}|${s.index}`); // edited in place, DVs too
  pass((s) => who(s.mon)); // edited and moved
  pass((s) => `${s.box}|${s.index}`); // something else in the same slot
  const kept = pairs.filter((p) => p.b.mon.species === p.a.mon.species || p.b.mon.level === p.a.mon.level);
  const split = pairs.filter((p) => !kept.includes(p));
  return { pairs: kept, removed: [...restB, ...split.map((p) => p.b)], added: [...restA, ...split.map((p) => p.a)] };
}

const moveList = (m: Gen2Mon) => m.moves.filter(Boolean).map((id) => MOVE_NAMES[id] ?? `#${id}`).join(', ') || 'none';
const same4 = (x: readonly number[], y: readonly number[]) => x.every((v, i) => v === y[i]);
const sameDvs = (x: Gen2Mon['dvs'], y: Gen2Mon['dvs']) => x.atk === y.atk && x.def === y.def && x.spe === y.spe && x.spc === y.spc;

function monChanges(b: Gen2Mon, a: Gen2Mon, set: ItemSet): string[] {
  const itemName = (id: number) => nameOf(id, set);
  const out: string[] = [];
  if (b.isEgg !== a.isEgg) out.push(a.isEgg ? 'made an egg' : 'hatched');
  if (b.species !== a.species) out.push(`species ${speciesName(b.species)} → ${speciesName(a.species)}`);
  if (b.nickname !== a.nickname) out.push(`nickname ${b.nickname || '(none)'} → ${a.nickname || '(none)'}`);
  if (b.level !== a.level) out.push(`level ${b.level} → ${a.level}`);
  else if (b.exp !== a.exp) out.push('experience changed');
  if (b.item !== a.item) out.push(a.item ? `holds ${itemName(a.item)}${b.item ? ` (was ${itemName(b.item)})` : ''}` : `no longer holds ${itemName(b.item)}`);
  if (b.hp !== a.hp) out.push(`HP ${b.hp} → ${a.hp}`);
  if (b.status !== a.status) out.push(a.status === 0 ? 'status cleared' : 'status changed');
  if (!same4(b.moves, a.moves)) out.push(`moves ${moveList(b)} → ${moveList(a)}`);
  else if (!same4(b.pp, a.pp) || !same4(b.ppUps, a.ppUps)) out.push('PP changed');
  if (!sameDvs(b.dvs, a.dvs)) {
    const extra: string[] = [];
    if (isShiny(b.dvs) !== isShiny(a.dvs)) extra.push(isShiny(a.dvs) ? 'now shiny' : 'no longer shiny');
    const gb = genderOf(b.species, b.dvs), ga = genderOf(a.species, a.dvs);
    if (b.species === a.species && gb !== ga) extra.push(`now ${ga}`);
    if (a.species === UNOWN && b.species === UNOWN && unownLetter(b.dvs) !== unownLetter(a.dvs)) extra.push(`now letter ${unownLetter(a.dvs)}`);
    out.push(`DVs changed${extra.length ? ` (${extra.join(', ')})` : ''}`);
  }
  if (JSON.stringify(b.evs) !== JSON.stringify(a.evs)) out.push('stat experience changed');
  if (b.friendship !== a.friendship) out.push(a.isEgg ? `steps to hatch changed` : `friendship ${b.friendship} → ${a.friendship}`);
  if (b.pokerus !== a.pokerus) out.push(a.pokerus ? 'Pokérus changed' : 'Pokérus removed');
  if (b.otName !== a.otName) out.push(`OT ${b.otName || '(none)'} → ${a.otName || '(none)'}`);
  if (b.otId !== a.otId) out.push('OT ID changed');
  if (b.caught[0] !== a.caught[0] || b.caught[1] !== a.caught[1]) out.push('where it was caught changed');
  return out;
}

function pokemonLines(b: Gen2Save, a: Gen2Save): string[] {
  const { pairs, removed, added } = pairUp(slots(b), slots(a));
  const order = (x: Slot, y: Slot) => x.box - y.box || x.index - y.index;
  const lines: string[] = [];
  for (const { b: sb, a: sa } of [...pairs].sort((p, q) => order(p.a, q.a))) {
    const crossed = sb.box !== sa.box;
    // Moving between the party and a box heals the Pokémon or refills its PP, as the game does; that isn't an edit.
    const edits = monChanges(sb.mon, sa.mon, a.game).filter((e) => !crossed || !/^(HP |status |PP changed)/.test(e));
    if (!crossed && !edits.length) continue;
    lines.push(crossed
      ? `${label(sa.mon)}: ${[`${place(sb)} → ${place(sa)}`, ...edits].join(', ')}`
      : `${label(sa.mon)} (${place(sa)}): ${edits.join(', ')}`);
  }
  const containers = new Set(pairs.filter((p) => p.b.box === p.a.box).map((p) => p.a.box));
  for (const c of [...containers].sort((x, y) => x - y)) {
    const inside = pairs.filter((p) => p.b.box === c && p.a.box === c).sort((x, y) => x.b.index - y.b.index);
    if (inside.some((p, i) => i > 0 && p.a.index < inside[i - 1].a.index)) lines.push(`${containerName(c)} order changed`);
  }
  for (const s of [...added].sort(order)) lines.push(`Added ${label(s.mon)}${s.mon.isEgg ? '' : ` Lv ${s.mon.level}`} to ${place(s)}`);
  for (const s of [...removed].sort(order)) lines.push(`Removed ${label(s.mon)}${s.mon.isEgg ? '' : ` Lv ${s.mon.level}`} from ${place(s)}`);
  return lines;
}

export function describeGen2Changes(before: Gen2Save, after: Gen2Save): ChangeGroup[] {
  return [
    group('Trainer', trainerLines(before, after)),
    group('Items pocket', itemLines(before.items, after.items, after.game)),
    group('Balls pocket', itemLines(before.balls, after.balls, after.game)),
    group('Key items', itemLines(asItems(before.keyItems), asItems(after.keyItems), after.game)),
    group('TMs and HMs', tmLines(before.tmhm, after.tmhm)),
    group('PC items', itemLines(before.pcItems, after.pcItems, after.game)),
    group('Pokémon', pokemonLines(before, after), 14),
    group('Box names', boxNameLines(before, after)),
    group('Pokédex', dexLines(before, after)),
    group('Options', optionLines(before, after)),
  ].filter((g): g is ChangeGroup => g !== null);
}
