import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DEX_NAMES, UNOWN, abilityOf, calcStats, dexOf, expForLevel, findPid, genderOf, isShiny, itemChoices, itemName, levelForExp,
  maxPp, natureOf, speciesOf, unownForm,
} from '../src/core/gen3/data.ts';
import { hpBarColour, hpBarPixels } from '../src/core/gen3/hp.ts';
import { PARTY, copyMon, dropMon, moveMon, partyLeaveRefusal } from '../src/core/gen3/roster.ts';
import { GEN3_LAYOUTS, Gen3Save, SAVE_SIZE, detectGen3, newMon, recalcPartyStats, sectorChecksum } from '../src/core/gen3/save.ts';
import { blankGen3Save, buildSampleSave } from '../src/core/gen3/sample.ts';
import { decodeText, encodeText, nameProblems } from '../src/core/gen3/text.ts';
import { openSave } from '../src/core/registry.ts';
import { buildSampleSave as buildCrystalSample } from '../src/core/gen2/sample.ts';

const u32 = (d: Uint8Array, o: number) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
const u16 = (d: Uint8Array, o: number) => d[o] | (d[o + 1] << 8);

/** Every sector of the newest slot has a good signature and checksum. */
function sectorsValid(d: Uint8Array, game: 'rs' | 'emerald'): boolean {
  const L = GEN3_LAYOUTS[game];
  const sizes = [L.sb2Size, 3968, 3968, 3968, L.sb1Size - 3 * 3968, ...new Array(8).fill(3968), 2000];
  let best = -1, ok = false;
  for (const slot of [0, 1]) {
    const counter = u32(d, slot * 0xe000 + 0xffc);
    let all = true;
    for (let s = 0; s < 14; s++) {
      const at = slot * 0xe000 + s * 0x1000;
      const id = u16(d, at + 0xff4);
      all &&= u32(d, at + 0xff8) === 0x08012025 && id < 14 && u16(d, at + 0xff6) === sectorChecksum(d, at, sizes[id]);
    }
    if (all && counter > best) { best = counter; ok = true; }
  }
  return ok;
}

// ---------- data ----------

test('the tables cover all 386 Pokémon and map Hoenn\'s internal numbers to the National Dex', () => {
  assert.equal(DEX_NAMES.length, 386);
  assert.equal(DEX_NAMES[251], 'Treecko');
  assert.equal(DEX_NAMES[385], 'Deoxys');
  assert.equal(dexOf(277), 252); // Treecko is internal 277
  assert.equal(dexOf(252), 0); // the unused Unown slots
  assert.equal(speciesOf(386), 410);
  assert.equal(speciesOf(25), 25);
});

test('experience: level 1 is 1 exp on every curve, and the Gen 3 curves top out where the games do', () => {
  assert.equal(expForLevel('Erratic', 100), 600000);
  assert.equal(expForLevel('Fluctuating', 100), 1640000);
  assert.equal(expForLevel('Medium Slow', 100), 1059860);
  for (const g of ['Medium Fast', 'Erratic', 'Fluctuating', 'Medium Slow', 'Fast', 'Slow'] as const) assert.equal(levelForExp(g, 1), 1);
});

test('personality: nature, gender, shininess and Unown\'s form', () => {
  assert.equal(natureOf(3), 3); // Adamant
  assert.equal(natureOf(28), 3);
  assert.equal(genderOf(282, 0x00), 'female'); // Gardevoir 50/50: low byte under 127 is female
  assert.equal(genderOf(282, 0xff), 'male');
  assert.equal(genderOf(81, 0), 'none'); // Magnemite
  assert.ok(isShiny(0, 7));
  assert.ok(!isShiny(0, 8));
  assert.equal(unownForm(0), 'A');
  const forms = new Set<string>();
  for (let p = 0; p < 256; p++) forms.add(unownForm(((p & 3) | ((p & 0xc) << 6) | ((p & 0x30) << 12) | ((p & 0xc0) << 18)) >>> 0));
  assert.equal(forms.size, 28);
});

test('findPid gives exactly the traits asked for and keeps the rest', () => {
  const otId = 0x1234abcd;
  const pid = findPid(282, otId, 0, { nature: 15, gender: 'female', shiny: true });
  assert.equal(natureOf(pid), 15);
  assert.equal(genderOf(282, pid), 'female');
  assert.ok(isShiny(otId, pid));
  const u = findPid(UNOWN, otId, pid, { unown: '?' });
  assert.equal(unownForm(u), '?');
  assert.ok(isShiny(otId, u), 'shininess kept');
});

test('stat formula with natures, and Shedinja\'s 1 HP', () => {
  const ivs = { hp: 31, atk: 31, def: 31, spe: 31, spa: 31, spd: 31 };
  const evs = { hp: 0, atk: 252, def: 0, spe: 0, spa: 0, spd: 0 };
  const s = calcStats(257, 100, ivs, evs, 3)!; // Adamant Blaziken: Atk up, SpA down
  assert.equal(s.atk, Math.floor((Math.floor((2 * 120 + 31 + 63) * 100 / 100) + 5) * 1.1));
  assert.equal(s.spa, Math.floor((Math.floor((2 * 110 + 31) * 100 / 100) + 5) * 0.9));
  assert.equal(calcStats(292, 50, ivs, evs, 0)!.hp, 1);
  assert.equal(abilityOf(184, 1), abilityOf(184, 1)); // Azumarill's second ability
  assert.equal(maxPp(85, 3), 24); // Thunderbolt 15 PP with 3 PP Ups
});

test("the HP bar is green above 24 of its 48 pixels and red at 9 or fewer, Ruby and Sapphire's way", () => {
  assert.equal(hpBarPixels(1, 300), 1);
  assert.equal(hpBarColour(hpBarPixels(53, 100)), 'green'); // 25 pixels
  assert.equal(hpBarColour(hpBarPixels(52, 100)), 'yellow'); // 24
  assert.equal(hpBarColour(hpBarPixels(20, 100)), 'red');
  assert.equal(hpBarColour(hpBarPixels(21, 100)), 'yellow');
});

test('text: names round-trip, a full-length name has no terminator, and unknown characters are reported', () => {
  assert.equal(decodeText(encodeText('Brendan', 8)), 'Brendan');
  assert.equal(decodeText(encodeText('MR.MIME’S', 10)), 'MR.MIME’S');
  const full = encodeText('ABCDEFGHIJ', 10);
  assert.equal(full.length, 10);
  assert.ok(!full.includes(0xff));
  assert.deepEqual(nameProblems('漢', 10).unsupported, ['漢']);
  assert.equal(nameProblems('ABCDEFGHIJK', 10).extra, 1);
});

test('Emerald offers its two extra key items; Ruby and Sapphire don\'t', () => {
  const rs = itemChoices(['key'], 'rs').map((c) => c.name);
  const em = itemChoices(['key'], 'emerald').map((c) => c.name);
  assert.ok(!rs.includes('Magma Emblem'));
  assert.ok(em.includes('Magma Emblem') && em.includes('Old Sea Map'));
  assert.equal(itemName(68), 'Rare Candy');
});

// ---------- the save ----------

test('blank and sample saves pass every checksum, are told apart, and round-trip', () => {
  for (const game of ['rs', 'emerald'] as const) {
    for (const d of [blankGen3Save(game), buildSampleSave(game)]) {
      assert.equal(d.length, SAVE_SIZE);
      assert.ok(sectorsValid(d, game), `${game} sectors`);
      assert.equal(detectGen3(d), game);
      assert.deepEqual(new Gen3Save(d).serialize(), d);
    }
  }
});

test("the sample has the start menu's POKéMON and POKéDEX: system flags 0x800 in Ruby / Sapphire, 0x860 in Emerald", () => {
  for (const [game, sys, other] of [['rs', 0x800, 0x860], ['emerald', 0x860, 0x800]] as const) {
    const s = new Gen3Save(buildSampleSave(game));
    assert.ok(s['flag'](sys) && s['flag'](sys + 1), game);
    assert.ok(!s['flag'](other) && !s['flag'](other + 1), game);
  }
});

test('the registry opens Ruby / Sapphire and Emerald with their own modules, and leaves Gen 2 alone', async () => {
  assert.equal((await openSave(buildSampleSave('rs')))?.module.id, 'pokemon-gen3');
  assert.equal((await openSave(buildSampleSave('emerald')))?.module.id, 'pokemon-emerald');
  assert.notEqual((await openSave(buildCrystalSample('crystal')))?.module.id, 'pokemon-gen3');
});

test('the sample reads back as built: party, box gap, bag and Pokédex', () => {
  const s = new Gen3Save(buildSampleSave('emerald'));
  assert.equal(s.game, 'emerald');
  assert.equal(s.trainerName, 'MAY');
  assert.equal(s.money, 12345);
  assert.equal(s.coins, 50);
  assert.deepEqual(s.party.map((m) => m.species), [257, 282, 277, 360, 201]);
  assert.equal(s.party[0].nickname, 'BLAZE');
  assert.equal(natureOf(s.party[0].pid), 3);
  assert.ok(isShiny(s.party[1].otId, s.party[1].pid));
  assert.ok(s.party[3].isEgg);
  assert.ok(s.party[3].hp > 0 && s.party[3].hp === s.party[3].maxHp); // a 0 HP egg shows FNT on Emerald's party screen
  assert.equal(unownForm(s.party[4].pid), '!');
  assert.equal(s.boxes[0][2], null);
  assert.equal(s.boxes[0][3]?.species, 184);
  assert.equal(s.boxNames[1], 'FRIENDS');
  assert.deepEqual(s.pockets.berry, [{ id: 139, count: 12 }, { id: 142, count: 3 }]);
  assert.ok(s.isOwned(257) && s.isSeen(300) && !s.isSeen(301));
});

test('Emerald keeps money, coins and bag counts under its key; edits survive a round trip', () => {
  const s = new Gen3Save(buildSampleSave('emerald'));
  s.money = 999999;
  s.coins = 9999;
  s.pockets.item[0].count = 99;
  s.trainerName = 'BRENDAN';
  s.gender = 'male';
  s.badges = 0xff;
  s.nationalDex = true;
  const out = s.serialize();
  assert.ok(sectorsValid(out, 'emerald'));
  const t = new Gen3Save(out);
  assert.equal(t.money, 999999);
  assert.equal(t.coins, 9999);
  assert.equal(t.pockets.item[0].count, 99);
  assert.equal(t.trainerName, 'BRENDAN');
  assert.equal(t.gender, 'male');
  assert.equal(t.badges, 0xff);
  assert.ok(t.nationalDex);
});

test('a Pokémon\'s edits are encrypted and checksummed so it reads back the same', () => {
  const s = new Gen3Save(buildSampleSave('rs'));
  const m = s.party[0];
  m.ivs = { hp: 31, atk: 31, def: 31, spe: 31, spa: 31, spd: 31 };
  m.evs.atk = 252;
  m.moves[3] = 14; // Swords Dance
  m.pid = findPid(m.species, m.otId, m.pid, { nature: 13 });
  const t = new Gen3Save(s.serialize());
  const r = t.party[0];
  assert.ok(!r.bad);
  assert.deepEqual(r.ivs, m.ivs);
  assert.equal(r.evs.atk, 252);
  assert.equal(r.moves[3], 14);
  assert.equal(natureOf(r.pid), 13);
});

test('boxes keep their gaps; an emptied spot is cleared', () => {
  const s = new Gen3Save(buildSampleSave('rs'));
  s.boxes[0][0] = null;
  s.boxes[5][29] = newMon(25, 10, { name: 'MAY', id: 1, gender: 'female' }, 'rs', 1234, 'Pikachu');
  const t = new Gen3Save(s.serialize());
  assert.equal(t.boxes[0][0], null);
  assert.equal(t.boxes[0][1]?.species, 270);
  assert.equal(t.boxes[5][29]?.species, 25);
  assert.equal(t.boxes[5][28], null);
});

test('a smaller party empties the slots past its end', () => {
  const s = new Gen3Save(buildSampleSave('rs'));
  s.party = s.party.slice(0, 2);
  const t = new Gen3Save(s.serialize());
  assert.equal(t.party.length, 2);
});

// ---------- moving Pokémon around ----------

test('dropping on an empty box spot puts it right there; a box Pokémon joining the party is healed', () => {
  const s = new Gen3Save(buildSampleSave('rs'));
  const mon = s.party[2];
  assert.deepEqual(dropMon(s, { where: PARTY, index: 2 }, { where: 0, index: 2 }), { kind: 'move' });
  assert.equal(s.boxes[0][2], mon);
  const boxed = s.boxes[0][0]!;
  assert.equal(moveMon(s, 0, 0, PARTY), null);
  assert.equal(s.party.at(-1), boxed);
  assert.equal(boxed.hp, boxed.maxHp);
});

test('Mail stays out of the boxes, and the party keeps one Pokémon that can battle', () => {
  const s = new Gen3Save(buildSampleSave('rs'));
  s.party[0].item = 121; // Orange Mail
  assert.equal(moveMon(s, PARTY, 0, 1), 'mail');
  s.party = [s.party[3]]; // just the egg... not allowed to leave alone
  assert.equal(partyLeaveRefusal(s, 0), 'last-party');
  const r = copyMon(s, 0, 1);
  assert.equal(typeof r, 'object');
});

test('a Pokémon holding a letter is not copied, so two never share it', () => {
  const s = new Gen3Save(buildSampleSave('rs'));
  s.party = s.party.slice(0, 2);
  s.party[0].item = 121; // Orange Mail
  s.party[0].mail = 0;
  assert.equal(copyMon(s, PARTY, 0), 'copy-mail');
  assert.equal(s.party.length, 2);
  s.party[0].mail = 0xff; // Mail with no letter written is just an item
  assert.equal(typeof copyMon(s, PARTY, 0), 'object');
});

// ---------- real saves, if you have them ----------
// Set GEN3_SAV and/or EMERALD_SAV to check they round-trip. Nothing from them is printed or stored.

for (const [env, id] of [['GEN3_SAV', 'pokemon-gen3'], ['EMERALD_SAV', 'pokemon-emerald']] as const) {
  const real = process.env[env];
  test(`a real save in ${env} round-trips byte for byte`, { skip: real && existsSync(real) ? false : `set ${env} to a real save to run` }, async () => {
    const raw = new Uint8Array(readFileSync(real!));
    const found = await openSave(raw);
    assert.equal(found?.module.id, id);
    assert.deepEqual(found!.save.serialize(), raw);
  });
}

test('an egg keeps full HP when its stats are worked out again, as the game makes it', () => {
  const egg = newMon(360, 5, { name: 'MAY', id: 1, gender: 'female' }, 'emerald', 1234, 'Wynaut');
  egg.isEgg = true; egg.hp = 0;
  recalcPartyStats(egg);
  assert.ok(egg.maxHp > 0);
  assert.equal(egg.hp, egg.maxHp);
});

test("Emerald's Battle Points, Berry Powder and Frontier symbols read back as edited; Ruby and Sapphire have none", () => {
  assert.equal(new Gen3Save(buildSampleSave('rs')).frontier, null);
  const s = new Gen3Save(buildSampleSave('emerald'));
  assert.deepEqual({ ...s.frontier, streaks: undefined }, { battlePoints: 0, battlePointsWon: 0, berryPowder: 0, symbols: [0, 0, 0, 0, 0, 0, 0], streaks: undefined });
  s.frontier!.battlePoints = 1234;
  s.frontier!.berryPowder = 50000;
  s.frontier!.symbols = [2, 1, 0, 0, 0, 0, 2];
  const t = new Gen3Save(s.serialize());
  assert.deepEqual({ ...t.frontier, streaks: undefined }, { battlePoints: 1234, battlePointsWon: 0, berryPowder: 50000, symbols: [2, 1, 0, 0, 0, 0, 2], streaks: undefined });
  // Gold sets both of the facility's flags, as the game has them once it gives the gold symbol.
  for (const n of [0x8c4, 0x8c5, 0x8c6, 0x8d0, 0x8d1]) assert.ok(t['flag'](n), n.toString(16));
  assert.ok(!t['flag'](0x8c7));
  const lines = s.describeChanges(new Gen3Save(buildSampleSave('emerald'))).flatMap((g) => g.lines);
  for (const want of ['Battle Points: 0 → 1,234', 'Berry Powder: 0 → 50,000', 'Battle Tower symbol: none → gold', 'Battle Dome symbol: none → silver']) {
    assert.ok(lines.includes(want), want);
  }
});

test('ribbons: contest ranks, one-bit ribbons and the count the game shows; other bits are left alone', async () => {
  const r = await import('../src/core/gen3/ribbons.ts');
  let v = (1 << 31) >>> 0; // the fateful-encounter bit, not a ribbon
  v = r.setContestRank(v, 0, 2); // Cool Super (so Normal too)
  v = r.setContestRank(v, 4, 4); // Tough Master
  v = r.setRibbon(v, 15, true); // Champion
  assert.equal(r.contestRank(v, 0), 2);
  assert.equal(r.contestRank(v, 4), 4);
  assert.equal(r.ribbonCount(v), 7);
  assert.deepEqual(r.ribbonNames(v), ['Cool Super', 'Tough Master', 'Champion']);
  assert.equal(v >>> 31, 1);
  assert.equal(r.contestRibbonId(4, 4), 20);
});

test("giving a Pokémon a ribbon opens the PokéNav's RIBBONS menu (FLAG_SYS_RIBBON_GET), and the review names it", () => {
  for (const [game, flag] of [['rs', 0x83b], ['emerald', 0x89b]] as const) {
    const s = new Gen3Save(buildSampleSave(game));
    assert.ok(!s['flag'](flag));
    s.party[0].ribbons = (s.party[0].ribbons | (1 << 15) | 3) >>> 0; // Champion, Cool Hyper
    const t = new Gen3Save(s.serialize());
    assert.ok(t['flag'](flag), game);
    assert.equal(t.party[0].ribbons & 0x8007, 0x8003);
    const lines = s.describeChanges(new Gen3Save(buildSampleSave(game))).flatMap((g) => g.lines).join('\n');
    assert.match(lines, /ribbons added: Cool Hyper, Champion/);
  }
});

test('game stats read back as edited, under the key in Emerald and plain in Ruby and Sapphire', async () => {
  const { gameStatGroups, packHofTime } = await import('../src/core/gen3/stats.ts');
  for (const [game, count, at] of [['rs', 50, 0x1540], ['emerald', 52, 0x159c]] as const) {
    // Every counter the game uses has a field, apart from the Hall of Fame time (its own fields) and the two unused ones.
    const shown = gameStatGroups(game).flatMap((g) => g.stats.map((x) => x.index)).sort((a, b) => a - b);
    assert.deepEqual(shown, Array.from({ length: count }, (_, i) => i).filter((i) => ![1, 22, 31].includes(i)), game);
    const s = new Gen3Save(buildSampleSave(game));
    assert.equal(s.gameStats.length, count);
    assert.ok(s.gameStats.every((v) => v === 0), game);
    s.gameStats[5] = 123456;
    s.gameStats[1] = packHofTime({ hours: 12, minutes: 34, seconds: 56 });
    s.gameStats[11] = 1 << 30; // more than the game counts to
    const t = new Gen3Save(s.serialize());
    assert.equal(t.gameStats[5], 123456);
    assert.equal(t.gameStats[1], (12 << 16) | (34 << 8) | 56);
    assert.equal(t.gameStats[11], 0xffffff);
    const raw = t['sb1'] as Uint8Array, key = game === 'emerald' ? (t['key'] as number) : 0;
    assert.equal(((raw[at + 20] | (raw[at + 21] << 8) | (raw[at + 22] << 16) | (raw[at + 23] << 24)) ^ key) >>> 0, 123456);
    const lines = s.describeChanges(new Gen3Save(buildSampleSave(game))).flatMap((g) => g.lines);
    for (const want of ['Steps: 0 → 123,456', 'First Hall of Fame time: none → 12:34:56']) assert.ok(lines.includes(want), want);
  }
});

test("Emerald's Frontier streaks: current and record per mode and level, and a current streak carries on", async () => {
  const { STREAK_ROWS, rowLabel } = await import('../src/core/gen3/frontier.ts');
  assert.equal(STREAK_ROWS.length, 8 + 4 + 4 + 2 + 4 + 2 + 2);
  const s = new Gen3Save(buildSampleSave('emerald'));
  const f = s.frontier!;
  assert.ok(f.streaks.every((x) => !x.current && !x.best && !x.active));
  const tower = STREAK_ROWS.findIndex((r) => rowLabel(r) === 'Battle Tower Doubles, Open Level');
  const factory = STREAK_ROWS.findIndex((r) => rowLabel(r) === 'Battle Factory Singles, Lv. 50');
  const pike = STREAK_ROWS.findIndex((r) => rowLabel(r) === 'Battle Pike, Open Level');
  f.streaks[tower].current = 48; f.streaks[tower].best = 70;
  f.streaks[factory].extraBest = 12;
  f.streaks[pike].best = 20000; // more than the game counts to
  f.battlePointsWon = 4321;
  const t = new Gen3Save(s.serialize());
  const sb2 = t['sb2'] as Uint8Array;
  const u16 = (o: number) => sb2[o] | (sb2[o + 1] << 8);
  assert.equal(u16(0xce0 + 3 * 2), 48); // towerWinStreaks[1][1]
  assert.equal(u16(0xcf0 + 3 * 2), 70);
  assert.equal(u16(0xdfa), 12); // factoryRecordRentsCount[0][0]
  assert.equal(u16(0xe08 + 2), 9999);
  assert.equal(u16(0xeba), 4321);
  assert.equal(sb2[0xcdc + 1], 0x80); // STREAK_TOWER_DOUBLES_OPEN, bit 15
  assert.ok(t.frontier!.streaks[tower].active);
  const lines = s.describeChanges(new Gen3Save(buildSampleSave('emerald'))).flatMap((g) => g.lines);
  for (const want of ['Battle Tower Doubles, Open Level: current 0 → 48, record 0 → 70', 'Battle Factory Singles, Lv. 50: record rentals 0 → 12',
    'Battle Points won: 0 → 4,321']) assert.ok(lines.includes(want), want);
});

test('the Pokéblock case: 8-byte slots, filled ones listed in order, rewritten packed to the front', () => {
  for (const [game, at] of [['rs', 0x7f8], ['emerald', 0x848]] as const) {
    const s = new Gen3Save(buildSampleSave(game));
    assert.equal(s.pokeblocks.length, 2);
    s.pokeblocks = [];
    s.pokeblocks.push({ color: 14, spicy: 1, dry: 2, sweet: 3, bitter: 4, sour: 5, feel: 6 });
    s.pokeblocks.push({ color: 1, spicy: 300, dry: 0, sweet: 0, bitter: 0, sour: 0, feel: 20 });
    const t = new Gen3Save(s.serialize());
    assert.deepEqual(t.pokeblocks, [
      { color: 14, spicy: 1, dry: 2, sweet: 3, bitter: 4, sour: 5, feel: 6 },
      { color: 1, spicy: 255, dry: 0, sweet: 0, bitter: 0, sour: 0, feel: 20 },
    ]);
    const raw = t['sb1'] as Uint8Array;
    assert.deepEqual([...raw.subarray(at, at + 16)], [14, 1, 2, 3, 4, 5, 6, 0, 1, 255, 0, 0, 0, 0, 20, 0]);
    const lines = s.describeChanges(new Gen3Save(buildSampleSave(game))).flatMap((g) => g.lines);
    assert.ok(lines.includes('Added Gold Pokéblock (Lv. 5, feel 6)'), lines.join('\n'));
  }
});

test('decorations: one list per category, packed; removing one still set out in the room warns', () => {
  for (const [game, at] of [['rs', 0x26a0], ['emerald', 0x2734]] as const) {
    const s = new Gen3Save(buildSampleSave(game));
    assert.equal(s.decorations.length, 8);
    s.decorations[0] = [3, 9]; // Heavy Desk, Hard Desk
    s.decorations[6] = [77, 77]; // Pikachu Doll x2
    const t = new Gen3Save(s.serialize());
    assert.deepEqual(t.decorations[0], [3, 9]);
    assert.deepEqual(t.decorations[6], [77, 77]);
    const raw = t['sb1'] as Uint8Array;
    assert.deepEqual([...raw.subarray(at, at + 3)], [3, 9, 0]);
    assert.deepEqual([...raw.subarray(at + 10 + 10 + 10 + 30 + 30 + 10, at + 100 + 2)], [77, 77]); // dolls after posters
    const lines = s.describeChanges(new Gen3Save(buildSampleSave(game))).flatMap((g) => g.lines);
    for (const want of ['Added Heavy Desk', 'Added Pikachu Doll ×2']) assert.ok(lines.includes(want), want);
    // A decoration in the bedroom is matched by id; taking the last one out of the PC leaves it standing there.
    const u = new Gen3Save(t.serialize());
    (u as unknown as { placedDecorations: number[] }).placedDecorations.push(3);
    u.decorations[0] = [9];
    assert.ok(u.describeChanges(t).flatMap((g) => g.lines).some((l) => l.startsWith('Warning: Heavy Desk is still set out')));
  }
});

test('the roaming Latios: IVs, personality, level and roaming read back as edited; Ruby and Sapphire have none yet', async () => {
  const { findPid, isShiny } = await import('../src/core/gen3/data.ts');
  assert.equal(new Gen3Save(buildSampleSave('rs')).roamer, null);
  const s = new Gen3Save(buildSampleSave('emerald'));
  const r = s.roamer!;
  assert.deepEqual({ species: r.species, level: r.level, hp: r.hp, active: r.active }, { species: 381, level: 40, hp: 122, active: true });
  const otId = ((s.secretId << 16) | s.trainerId) >>> 0;
  r.ivs = { hp: 31, atk: 31, def: 31, spe: 31, spa: 31, spd: 31 };
  r.pid = findPid(381, otId, r.pid, { shiny: true });
  r.species = 380; r.level = 50; r.active = false;
  const t = new Gen3Save(s.serialize());
  assert.deepEqual(t.roamer, r);
  assert.ok(isShiny(otId, t.roamer!.pid));
  const raw = t['sb1'] as Uint8Array;
  assert.equal(raw[0x31dc + 8] | (raw[0x31dc + 9] << 8), 407); // SPECIES_LATIAS, the game's own number
  const lines = s.describeChanges(new Gen3Save(buildSampleSave('emerald'))).flatMap((g) => g.lines);
  for (const want of ['Roaming Pokémon: Latios → Latias', 'Latias is now shiny', 'Latias no longer roams', "Latias's level: 40 → 50"]) {
    assert.ok(lines.includes(want), want);
  }
});

test("Emerald's rematches: asking trainers get the team the game would pick; Ruby and Sapphire have none here", async () => {
  const { REMATCH_TRAINERS, nextRematchTeam } = await import('../src/core/gen3/rematches.ts');
  assert.equal(REMATCH_TRAINERS.length, 73);
  assert.equal(new Gen3Save(buildSampleSave('rs')).rematches, null);
  // Beaten teams 1 and 2 (trainer flags set) → the third team is next; all beaten → the fifth.
  assert.equal(nextRematchTeam(0, [37, 40, 41, 42, 43], (id) => id === 37 || id === 40), 2);
  assert.equal(nextRematchTeam(0, [37, 40, 41, 42, 43], () => true), 5);
  assert.equal(nextRematchTeam(65, [265, 770, 771, 772, 773], (id) => id === 265), 1); // Roxanne: her second team
  const s = new Gen3Save(buildSampleSave('emerald'));
  const m = s.rematches!;
  assert.deepEqual(m.slice(0, 4).map((x) => x.available), [true, true, true, false]);
  assert.ok(!m[65].available); // gym leaders only once the game is cleared
  m[2].team = m[2].next;
  const t = new Gen3Save(s.serialize());
  assert.equal((t['sb1'] as Uint8Array)[0x9ca + 2], 1);
  assert.equal(t.rematches![2].team, 1);
  const lines = s.describeChanges(new Gen3Save(buildSampleSave('emerald'))).flatMap((g) => g.lines);
  assert.ok(lines.includes('Want a rematch: Dusty'), lines.join('\n'));
});
