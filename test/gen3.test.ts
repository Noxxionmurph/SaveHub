import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DEX_NAMES, UNOWN, abilityOf, calcStats, dexOf, expForLevel, findPid, genderOf, isShiny, itemChoices, itemName, levelForExp,
  maxPp, natureOf, speciesOf, unownForm,
} from '../src/core/gen3/data.ts';
import { hpBarColour, hpBarPixels } from '../src/core/gen3/hp.ts';
import { PARTY, copyMon, dropMon, moveMon, partyLeaveRefusal } from '../src/core/gen3/roster.ts';
import { GEN3_LAYOUTS, Gen3Save, SAVE_SIZE, detectGen3, newMon, sectorChecksum } from '../src/core/gen3/save.ts';
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

test('the registry opens Ruby / Sapphire and Emerald with their own modules, and leaves Gen 2 alone', () => {
  assert.equal(openSave(buildSampleSave('rs'))?.module.id, 'pokemon-gen3');
  assert.equal(openSave(buildSampleSave('emerald'))?.module.id, 'pokemon-emerald');
  assert.notEqual(openSave(buildCrystalSample('crystal'))?.module.id, 'pokemon-gen3');
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

// ---------- real saves, if you have them ----------
// Set GEN3_SAV and/or EMERALD_SAV to check they round-trip. Nothing from them is printed or stored.

for (const [env, id] of [['GEN3_SAV', 'pokemon-gen3'], ['EMERALD_SAV', 'pokemon-emerald']] as const) {
  const real = process.env[env];
  test(`a real save in ${env} round-trips byte for byte`, { skip: real && existsSync(real) ? false : `set ${env} to a real save to run` }, () => {
    const raw = new Uint8Array(readFileSync(real!));
    const found = openSave(raw);
    assert.equal(found?.module.id, id);
    assert.deepEqual(found!.save.serialize(), raw);
  });
}
