// Turns "what the user edited" into plain sentences for the review dialog shown before Save (Ruby, Sapphire, Emerald).
// Compares two models of the same save (as first loaded vs. now). Nothing here touches bytes.

import type { ChangeGroup } from '../types.ts';
import {
  ABILITY_NAMES, BUTTON_MODES, DEX_COUNT, HOENN_BADGES, MOVE_NAMES, NATURE_NAMES, TEXT_SPEEDS, TMHM_LABELS, TMHM_MOVES, UNOWN,
  genderOf, isShiny, itemName, natureOf, speciesName, unownForm,
} from './data.ts';
import { BOX_NAME_LEN, FRONTIER_FACILITIES, NICKNAME_MAX, PLAYER_NAME_MAX, monAbility, type BagItem, type Gen3Mon, type Gen3Save } from './save.ts';
import { DECOR_CATEGORIES, decorName } from './decorations.ts';
import { STREAK_ROWS, rowLabel } from './frontier.ts';
import { pokeblockLevel, pokeblockName, type Pokeblock } from './pokeblocks.ts';
import { REMATCH_TRAINERS } from './rematches.ts';
import { ribbonNames } from './ribbons.ts';
import { HOF_TIME_STAT, gameStatGroups, unpackHofTime } from './stats.ts';
import { asSaved } from './text.ts';

const CAP = 12;

function group(title: string, lines: string[], cap = CAP): ChangeGroup | null {
  if (!lines.length) return null;
  return lines.length > cap ? { title, lines: lines.slice(0, cap), more: lines.length - cap } : { title, lines };
}

const money = (n: number) => `¥${n.toLocaleString('en-US')}`;
const clock = (s: Gen3Save) => `${s.playHours}:${String(s.playMinutes).padStart(2, '0')}:${String(s.playSeconds).padStart(2, '0')}`;
const nm = (text: string, max = NICKNAME_MAX) => asSaved(text, max);
const pn = (text: string) => asSaved(text, PLAYER_NAME_MAX);
const id5 = (n: number) => String(n).padStart(5, '0');
const labelOf = (list: readonly { value: number; label: string }[], v: number) => list.find((t) => t.value === v)?.label ?? `Custom (${v})`;

// ---------- trainer ----------

function trainerLines(b: Gen3Save, a: Gen3Save): string[] {
  const out: string[] = [];
  if (pn(b.trainerName) !== pn(a.trainerName)) out.push(`Name: ${pn(b.trainerName)} → ${pn(a.trainerName)}`);
  if (!a.trainerName.trim()) out.push('Warning: your name is blank, so the game will show nothing where it should be.');
  if (b.gender !== a.gender) out.push(`Plays as: ${b.gender === 'female' ? 'girl' : 'boy'} → ${a.gender === 'female' ? 'girl' : 'boy'}`);
  const oldId = (b.secretId << 16) | b.trainerId, newId = (a.secretId << 16) | a.trainerId;
  if (b.trainerId !== a.trainerId) out.push(`Trainer ID: ${id5(b.trainerId)} → ${id5(a.trainerId)}`);
  if (b.secretId !== a.secretId) out.push(`Secret ID: ${id5(b.secretId)} → ${id5(a.secretId)}`);
  if (oldId !== newId) {
    // The game decides "traded" by comparing a Pokémon's original trainer ID and secret ID with the player's.
    const orphaned = slots(a).filter((s) => !s.mon.isEgg && s.mon.otId >>> 0 === oldId >>> 0).length;
    if (orphaned) {
      out.push(`Warning: ${orphaned} ${orphaned === 1 ? 'Pokémon was' : 'Pokémon were'} caught under your old IDs, so the game will now count ${orphaned === 1 ? 'it' : 'them'} as traded. ${orphaned === 1 ? 'It earns' : 'They earn'} extra experience, may ignore your orders until you have more badges, and ${orphaned === 1 ? 'its' : 'their'} shininess is worked out from the new IDs.`);
    }
  }
  if (b.money !== a.money) out.push(`Money: ${money(b.money)} → ${money(a.money)}`);
  if (b.coins !== a.coins) out.push(`Coins: ${b.coins.toLocaleString('en-US')} → ${a.coins.toLocaleString('en-US')}`);
  if (clock(b) !== clock(a)) out.push(`Play time: ${clock(b)} → ${clock(a)}`);
  const gained = HOENN_BADGES.filter((_, i) => !((b.badges >> i) & 1) && (a.badges >> i) & 1);
  const lost = HOENN_BADGES.filter((_, i) => (b.badges >> i) & 1 && !((a.badges >> i) & 1));
  if (gained.length) out.push(`Badges earned: ${gained.join(', ')}`);
  if (lost.length) out.push(`Badges removed: ${lost.join(', ')}`);
  if (b.nationalDex !== a.nationalDex) out.push(a.nationalDex ? 'National Pokédex unlocked' : 'National Pokédex locked again');
  if (b.frontier && a.frontier) {
    const bf = b.frontier, af = a.frontier;
    if (bf.battlePoints !== af.battlePoints) out.push(`Battle Points: ${bf.battlePoints.toLocaleString('en-US')} → ${af.battlePoints.toLocaleString('en-US')}`);
    if (bf.berryPowder !== af.berryPowder) out.push(`Berry Powder: ${bf.berryPowder.toLocaleString('en-US')} → ${af.berryPowder.toLocaleString('en-US')}`);
    if (bf.battlePointsWon !== af.battlePointsWon) out.push(`Battle Points won: ${bf.battlePointsWon.toLocaleString('en-US')} → ${af.battlePointsWon.toLocaleString('en-US')}`);
    STREAK_ROWS.forEach((r, i) => {
      const x = bf.streaks[i], y = af.streaks[i], parts: string[] = [];
      const label = r.extra?.label.toLowerCase();
      if (x.current !== y.current) parts.push(`current ${x.current} → ${y.current}`);
      if (x.best !== y.best) parts.push(`record ${x.best} → ${y.best}`);
      if (x.extraCurrent !== y.extraCurrent) parts.push(`current ${label} ${x.extraCurrent} → ${y.extraCurrent}`);
      if (x.extraBest !== y.extraBest) parts.push(`${r.extra?.current === undefined ? '' : 'record '}${label} ${x.extraBest} → ${y.extraBest}`);
      if (parts.length) out.push(`${rowLabel(r)}: ${parts.join(', ')}`);
    });
    const sym = ['none', 'silver', 'gold'];
    FRONTIER_FACILITIES.forEach((name, i) => {
      if (bf.symbols[i] !== af.symbols[i]) out.push(`${name} symbol: ${sym[bf.symbols[i]]} → ${sym[af.symbols[i]]}`);
    });
  }
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

// ---------- Pokédex and options ----------

function dexLines(b: Gen3Save, a: Gen3Save): string[] {
  const count = (f: (dex: number) => number) => { let n = 0; for (let d = 1; d <= DEX_COUNT; d++) n += f(d); return n; };
  const out: string[] = [];
  const bo = count(b.isOwned), ao = count(a.isOwned), bs = count(b.isSeen), as = count(a.isSeen);
  if (bo !== ao) out.push(`Caught: ${bo} → ${ao}`);
  if (bs !== as) out.push(`Seen: ${bs} → ${as}`);
  const same = (x: Uint8Array, y: Uint8Array) => x.every((v, i) => v === y[i]);
  if (bo === ao && bs === as && (!same(b.dexOwned, a.dexOwned) || !same(b.dexSeen, a.dexSeen))) out.push('Some entries changed');
  return out;
}

function optionLines(b: Gen3Save, a: Gen3Save): string[] {
  const out: string[] = [];
  const o = b.options, n = a.options;
  const onOff = (v: boolean) => (v ? 'On' : 'Off');
  if (o.textSpeed !== n.textSpeed) out.push(`Text speed: ${labelOf(TEXT_SPEEDS, o.textSpeed)} → ${labelOf(TEXT_SPEEDS, n.textSpeed)}`);
  if (o.battleSceneOff !== n.battleSceneOff) out.push(`Battle scene: ${onOff(!o.battleSceneOff)} → ${onOff(!n.battleSceneOff)}`);
  if (o.battleStyleSet !== n.battleStyleSet) out.push(`Battle style: ${o.battleStyleSet ? 'Set' : 'Shift'} → ${n.battleStyleSet ? 'Set' : 'Shift'}`);
  if (o.stereo !== n.stereo) out.push(`Sound: ${o.stereo ? 'Stereo' : 'Mono'} → ${n.stereo ? 'Stereo' : 'Mono'}`);
  if (o.buttonMode !== n.buttonMode) out.push(`Button mode: ${labelOf(BUTTON_MODES, o.buttonMode)} → ${labelOf(BUTTON_MODES, n.buttonMode)}`);
  if (o.frame !== n.frame) out.push(`Frame: Type ${o.frame + 1} → Type ${n.frame + 1}`);
  return out;
}

function boxNameLines(b: Gen3Save, a: Gen3Save): string[] {
  const box = (name: string) => nm(name, BOX_NAME_LEN);
  return a.boxNames.flatMap((name, i) => (box(name) === box(b.boxNames[i]) ? [] : [`Box ${i + 1} name: ${box(b.boxNames[i])} → ${box(name)}`]));
}

// ---------- Pokémon ----------

interface Slot { mon: Gen3Mon; box: number; index: number }
interface Pair { b: Slot; a: Slot }

const place = (s: { box: number; index: number }) => (s.box < 0 ? `Party ${s.index + 1}` : `Box ${s.box + 1}, slot ${s.index + 1}`);

function label(m: Gen3Mon): string {
  if (m.bad) return 'Bad Egg';
  if (m.isEgg) return `Egg (${speciesName(m.species)})`;
  const species = speciesName(m.species);
  const nick = nm(m.nickname);
  return nick && nick.toUpperCase() !== species.toUpperCase() ? `${species} “${nick}”` : species;
}

/** Everything that identifies one Pokémon wherever it is (party-only numbers left out, since a box drops them). */
const signature = (m: Gen3Mon) => JSON.stringify([
  m.pid, m.otId, m.species, m.isEgg, m.item, m.exp, m.moves, m.ppUps, m.otName, m.nickname, m.ivs, m.evs, m.friendship,
  m.pokerus, m.abilityBit, m.ball, m.metLocation, m.metLevel, m.metGame, m.otGender, m.language, m.contest, m.ribbons,
]);

function slots(save: Gen3Save): Slot[] {
  const out: Slot[] = save.party.map((mon, index) => ({ mon, box: -1, index }));
  save.boxes.forEach((list, box) => list.forEach((mon, index) => { if (mon) out.push({ mon, box, index }); }));
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
  pass((s) => signature(s.mon)); // untouched (it may just have moved)
  pass((s) => `${s.mon.pid}|${s.mon.otId}|${s.box}|${s.index}`); // edited in place
  pass((s) => `${s.mon.species}|${s.mon.otId}|${s.box}|${s.index}`); // edited in place, personality too
  pass((s) => `${s.mon.pid}|${s.mon.otId}`); // edited and moved
  pass((s) => `${s.box}|${s.index}`); // something else in the same slot
  const kept = pairs.filter((p) => p.b.mon.species === p.a.mon.species || p.b.mon.level === p.a.mon.level);
  const split = pairs.filter((p) => !kept.includes(p));
  return { pairs: kept, removed: [...restB, ...split.map((p) => p.b)], added: [...restA, ...split.map((p) => p.a)] };
}

const moveList = (m: Gen3Mon) => m.moves.filter(Boolean).map((id) => MOVE_NAMES[id] ?? `#${id}`).join(', ') || 'none';
const same = (x: readonly number[], y: readonly number[]) => x.every((v, i) => v === y[i]);
const sameStats = (x: Gen3Mon['ivs'], y: Gen3Mon['ivs']) => x.hp === y.hp && x.atk === y.atk && x.def === y.def && x.spe === y.spe && x.spa === y.spa && x.spd === y.spd;

function monChanges(b: Gen3Mon, a: Gen3Mon, party: boolean): string[] {
  const out: string[] = [];
  if (b.isEgg !== a.isEgg) out.push(a.isEgg ? 'made an egg' : 'hatched');
  if (b.species !== a.species) out.push(`species ${speciesName(b.species)} → ${speciesName(a.species)}`);
  if (nm(b.nickname) !== nm(a.nickname)) out.push(`nickname ${nm(b.nickname) || '(none)'} → ${nm(a.nickname) || '(none)'}`);
  if (b.level !== a.level) out.push(`level ${b.level} → ${a.level}`);
  else if (b.exp !== a.exp) out.push('experience changed');
  if (b.item !== a.item) out.push(a.item ? `holds ${itemName(a.item)}${b.item ? ` (was ${itemName(b.item)})` : ''}` : `no longer holds ${itemName(b.item)}`);
  if (b.pid !== a.pid) {
    const extra: string[] = [];
    if (natureOf(b.pid) !== natureOf(a.pid)) extra.push(`nature ${NATURE_NAMES[natureOf(b.pid)]} → ${NATURE_NAMES[natureOf(a.pid)]}`);
    const gb = genderOf(b.species, b.pid), ga = genderOf(a.species, a.pid);
    if (b.species === a.species && gb !== ga) extra.push(`now ${ga}`);
    if (isShiny(b.otId, b.pid) !== isShiny(a.otId, a.pid)) extra.push(isShiny(a.otId, a.pid) ? 'now shiny' : 'no longer shiny');
    if (a.species === UNOWN && b.species === UNOWN && unownForm(b.pid) !== unownForm(a.pid)) extra.push(`now form ${unownForm(a.pid)}`);
    out.push(extra.length ? extra.join(', ') : 'personality value changed');
  }
  if (b.abilityBit !== a.abilityBit && b.species === a.species && monAbility(b) !== monAbility(a)) {
    out.push(`ability ${ABILITY_NAMES[monAbility(b)]} → ${ABILITY_NAMES[monAbility(a)]}`);
  }
  if (b.hp !== a.hp) out.push(`HP ${b.hp} → ${a.hp}`);
  if (party && !a.isEgg) {
    const stats = ([['Max HP', 'maxHp'], ['Atk', 'atk'], ['Def', 'def'], ['SpA', 'spa'], ['SpD', 'spd'], ['Spe', 'spe']] as const)
      .filter(([, k]) => b[k] !== a[k]).map(([name, k]) => `${name} ${b[k]} → ${a[k]}`);
    if (stats.length) out.push(`stats ${stats.join(', ')}`);
  }
  if (b.status !== a.status) out.push(a.status === 0 ? 'status cleared' : 'status changed');
  if (!same(b.moves, a.moves)) out.push(`moves ${moveList(b)} → ${moveList(a)}`);
  else if (!same(b.pp, a.pp) || !same(b.ppUps, a.ppUps)) out.push('PP changed');
  if (!sameStats(b.ivs, a.ivs)) out.push('IVs changed');
  if (!sameStats(b.evs, a.evs)) out.push('EVs changed');
  if (!same(b.contest, a.contest)) out.push('contest stats changed');
  if (b.ribbons !== a.ribbons) {
    const was = ribbonNames(b.ribbons), now = ribbonNames(a.ribbons);
    const added = now.filter((r) => !was.includes(r)), removed = was.filter((r) => !now.includes(r));
    // A contest rank shows as its new top rank, so "Cool Super" replacing "Cool Normal" reads as one change.
    if (added.length) out.push(`ribbons added: ${added.join(', ')}`);
    if (removed.length) out.push(`ribbons removed: ${removed.join(', ')}`);
    if (!added.length && !removed.length) out.push('ribbons changed');
  }
  if (b.friendship !== a.friendship) out.push(a.isEgg ? 'steps to hatch changed' : `friendship ${b.friendship} → ${a.friendship}`);
  if (b.pokerus !== a.pokerus) out.push(a.pokerus ? 'Pokérus changed' : 'Pokérus removed');
  if (pn(b.otName) !== pn(a.otName)) out.push(`OT ${pn(b.otName) || '(none)'} → ${pn(a.otName) || '(none)'}`);
  if (b.otId !== a.otId) out.push('OT ID changed');
  if (b.otGender !== a.otGender) out.push(`OT gender ${b.otGender} → ${a.otGender}`);
  if (b.ball !== a.ball) out.push(`Poké Ball ${itemName(b.ball)} → ${itemName(a.ball)}`);
  if (b.metLocation !== a.metLocation || b.metLevel !== a.metLevel || b.metGame !== a.metGame) out.push('where it was met changed');
  if (b.language !== a.language) out.push('language changed');
  return out;
}

function pokemonLines(b: Gen3Save, a: Gen3Save): string[] {
  const { pairs, removed, added } = pairUp(slots(b), slots(a));
  const order = (x: Slot, y: Slot) => x.box - y.box || x.index - y.index;
  const lines: string[] = [];
  for (const { b: sb, a: sa } of [...pairs].sort((p, q) => order(p.a, q.a))) {
    const moved = sb.box !== sa.box || sb.index !== sa.index;
    const crossed = sb.box !== sa.box;
    // Moving between the party and a box heals the Pokémon or refills its PP, as the game does; that isn't an edit.
    const edits = monChanges(sb.mon, sa.mon, sb.box < 0 && sa.box < 0).filter((e) => !crossed || !/^(HP |status |PP changed|stats )/.test(e));
    if (!moved && !edits.length) continue;
    lines.push(moved
      ? `${label(sa.mon)}: ${[`${place(sb)} → ${place(sa)}`, ...edits].join(', ')}`
      : `${label(sa.mon)} (${place(sa)}): ${edits.join(', ')}`);
  }
  for (const s of [...added].sort(order)) lines.push(`Added ${label(s.mon)}${s.mon.isEgg ? '' : ` Lv ${s.mon.level}`} to ${place(s)}`);
  for (const s of [...removed].sort(order)) lines.push(`Removed ${label(s.mon)}${s.mon.isEgg ? '' : ` Lv ${s.mon.level}`} from ${place(s)}`);
  return lines;
}

// ---------- rematches ----------

function rematchLines(b: Gen3Save, a: Gen3Save): string[] {
  if (!b.rematches || !a.rematches) return [];
  const on: string[] = [], off: string[] = [];
  a.rematches.forEach((m, i) => {
    const was = b.rematches![i].team > 0, now = m.team > 0;
    if (now && !was) on.push(REMATCH_TRAINERS[i][0]);
    if (was && !now) off.push(REMATCH_TRAINERS[i][0]);
  });
  return [on.length ? `Want a rematch: ${on.join(', ')}` : '', off.length ? `No longer want a rematch: ${off.join(', ')}` : ''].filter(Boolean);
}

// ---------- the roamer ----------

function roamerLines(b: Gen3Save, a: Gen3Save): string[] {
  const x = b.roamer, y = a.roamer;
  if (!x || !y) return [];
  const out: string[] = [], name = speciesName(y.species);
  const otId = (s: Gen3Save) => ((s.secretId << 16) | s.trainerId) >>> 0;
  if (x.species !== y.species) out.push(`Roaming Pokémon: ${speciesName(x.species)} → ${name}`);
  if (x.level !== y.level) out.push(`${name}'s level: ${x.level} → ${y.level}`);
  const ivs = (v: typeof y.ivs) => [v.hp, v.atk, v.def, v.spa, v.spd, v.spe].join('/');
  if (ivs(x.ivs) !== ivs(y.ivs)) out.push(`${name}'s IVs: ${ivs(x.ivs)} → ${ivs(y.ivs)}`);
  const sx = isShiny(otId(b), x.pid), sy = isShiny(otId(a), y.pid);
  if (sx !== sy) out.push(sy ? `${name} is now shiny` : `${name} is no longer shiny`);
  if (natureOf(x.pid) !== natureOf(y.pid)) out.push(`${name}'s nature: ${NATURE_NAMES[natureOf(x.pid)]} → ${NATURE_NAMES[natureOf(y.pid)]}`);
  if (x.hp !== y.hp && x.level === y.level && ivs(x.ivs) === ivs(y.ivs)) out.push(`${name}'s HP: ${x.hp} → ${y.hp}`);
  if (x.active !== y.active) out.push(y.active ? `${name} is roaming Hoenn again` : `${name} no longer roams`);
  return out;
}

// ---------- decorations ----------

function decorationLines(b: Gen3Save, a: Gen3Save): string[] {
  const out: string[] = [], gone: number[] = [];
  const times = (n: number) => (n > 1 ? ` ×${n}` : '');
  DECOR_CATEGORIES.forEach((_, c) => {
    const count = (list: number[]) => list.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map<number, number>());
    const x = count(b.decorations[c]), y = count(a.decorations[c]);
    for (const [id, n] of y) if (n > (x.get(id) ?? 0)) out.push(`Added ${decorName(id)}${times(n - (x.get(id) ?? 0))}`);
    for (const [id, n] of x) {
      if (n > (y.get(id) ?? 0)) { out.push(`Removed ${decorName(id)}${times(n - (y.get(id) ?? 0))}`); if (!y.has(id)) gone.push(id); }
    }
  });
  const placed = gone.filter((id) => a.placedDecorations.includes(id));
  if (placed.length) {
    out.push(`Warning: ${placed.map(decorName).join(', ')} ${placed.length === 1 ? 'is' : 'are'} still set out in your room or secret base, so ${placed.length === 1 ? 'it stays' : 'they stay'} there although the PC no longer has ${placed.length === 1 ? 'it' : 'them'}.`);
  }
  return out;
}

// ---------- Pokéblocks ----------

function pokeblockLines(before: Pokeblock[], after: Pokeblock[]): string[] {
  const key = (p: Pokeblock) => `${pokeblockName(p)} (Lv. ${pokeblockLevel(p)}, feel ${p.feel})`;
  const count = (list: Pokeblock[]) => {
    const m = new Map<string, number>();
    for (const p of list) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    return m;
  };
  const b = count(before), a = count(after), out: string[] = [];
  const times = (n: number) => (n > 1 ? ` ×${n}` : '');
  for (const [k, n] of a) if (n > (b.get(k) ?? 0)) out.push(`Added ${k}${times(n - (b.get(k) ?? 0))}`);
  for (const [k, n] of b) if (n > (a.get(k) ?? 0)) out.push(`Removed ${k}${times(n - (a.get(k) ?? 0))}`);
  return out;
}

// ---------- game stats ----------

function statLines(b: Gen3Save, a: Gen3Save): string[] {
  const out: string[] = [];
  const hof = (v: number) => {
    const t = unpackHofTime(v);
    return v ? `${t.hours}:${String(t.minutes).padStart(2, '0')}:${String(t.seconds).padStart(2, '0')}` : 'none';
  };
  if (b.gameStats[HOF_TIME_STAT] !== a.gameStats[HOF_TIME_STAT]) {
    out.push(`First Hall of Fame time: ${hof(b.gameStats[HOF_TIME_STAT])} → ${hof(a.gameStats[HOF_TIME_STAT])}`);
  }
  for (const g of gameStatGroups(a.game)) {
    for (const st of g.stats) {
      const x = b.gameStats[st.index], y = a.gameStats[st.index];
      if (x !== y) out.push(`${st.name}: ${x.toLocaleString('en-US')} → ${y.toLocaleString('en-US')}`);
    }
  }
  return out;
}

export function describeGen3Changes(before: Gen3Save, after: Gen3Save): ChangeGroup[] {
  return [
    group('Trainer', trainerLines(before, after)),
    group('Items pocket', itemLines(before.pockets.item, after.pockets.item)),
    group('Poké Balls pocket', itemLines(before.pockets.ball, after.pockets.ball)),
    group('Key Items pocket', itemLines(before.pockets.key, after.pockets.key)),
    group('TMs and HMs', tmLines(before.tmCounts(), after.tmCounts())),
    group('Berries pocket', itemLines(before.pockets.berry, after.pockets.berry)),
    group('PC items', itemLines(before.pcItems, after.pcItems)),
    group('Roaming Pokémon', roamerLines(before, after)),
    group('Trainer rematches', rematchLines(before, after)),
    group('Decorations', decorationLines(before, after)),
    group('Pokéblock case', pokeblockLines(before.pokeblocks, after.pokeblocks)),
    group('Pokémon', pokemonLines(before, after), 14),
    group('Box names', boxNameLines(before, after)),
    group('Pokédex', dexLines(before, after)),
    group('Game stats', statLines(before, after)),
    group('Options', optionLines(before, after)),
  ].filter((g): g is ChangeGroup => g !== null);
}
