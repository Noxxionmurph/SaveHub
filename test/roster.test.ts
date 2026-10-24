import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEX_TO_INTERNAL } from '../src/core/gen1/data.ts';
import { PARTY, copyMon, listAt, moveMon, removeMon, shiftMon, spaceAt } from '../src/core/gen1/roster.ts';
import { Gen1Save, newMon } from '../src/core/gen1/save.ts';
import { blankGen1Save } from '../src/core/gen1/sample.ts';

const mon = (dex: number, level = 10) => newMon(DEX_TO_INTERNAL[dex], level);
function save(): Gen1Save {
  const s = new Gen1Save(blankGen1Save());
  s.party = [mon(25), mon(16)];
  s.boxes[0] = [mon(19), mon(129)];
  return s;
}

test('moving between party and boxes keeps the Pokémon and fixes party stats', () => {
  const s = save();
  const magikarp = s.boxes[0][1];
  magikarp.level = 40; // as if edited in a box, where stats are not stored
  assert.equal(moveMon(s, 0, 1, PARTY), null);
  assert.equal(s.boxes[0].length, 1);
  assert.equal(s.party.at(-1), magikarp);
  assert.equal(magikarp.partyLevel, 40);
  assert.ok(magikarp.maxHp > 20, 'stats recalculated for the new level');
  assert.equal(moveMon(s, PARTY, 2, 5), null);
  assert.equal(s.boxes[5][0], magikarp);
});

test('refuses a full destination, the same place, a bad slot and emptying the party', () => {
  const s = save();
  s.boxes[1] = Array.from({ length: 20 }, () => mon(1));
  assert.equal(moveMon(s, 0, 0, 1), 'full');
  assert.equal(moveMon(s, 0, 0, 0), 'same');
  assert.equal(moveMon(s, 0, 9, 2), 'missing');
  s.party = [s.party[0]];
  assert.equal(moveMon(s, PARTY, 0, 2), 'last-party');
  assert.equal(removeMon(s, PARTY, 0), 'last-party');
  assert.equal(s.party.length, 1);
  assert.equal(removeMon(s, 0, 0), null);
  assert.equal(s.boxes[0].length, 1);
});

test('a full party is full', () => {
  const s = save();
  while (s.party.length < 6) s.party.push(mon(1));
  assert.equal(spaceAt(s, PARTY), 0);
  assert.equal(moveMon(s, 0, 0, PARTY), 'full');
});

test('copy lands next to the original, or in the first box with room', () => {
  const s = save();
  const r = copyMon(s, 0, 0);
  assert.deepEqual(r, { where: 0, index: 1 });
  assert.equal(s.boxes[0].length, 3);
  assert.notEqual(s.boxes[0][1], s.boxes[0][0], 'a real copy, not the same object');
  assert.deepEqual(s.boxes[0][1], s.boxes[0][0]);

  while (s.party.length < 6) s.party.push(mon(1));
  assert.deepEqual(copyMon(s, PARTY, 0), { where: 0, index: 3 }); // party full -> first box with room
  s.boxes[0] = Array.from({ length: 20 }, () => mon(1));
  assert.deepEqual(copyMon(s, PARTY, 0), { where: 1, index: 0 }); // box 1 full too -> box 2
  for (let i = 0; i < 12; i++) s.boxes[i] = Array.from({ length: 20 }, () => mon(1));
  assert.equal(copyMon(s, PARTY, 0), 'full');
});

test('shifting swaps neighbours and stops at the ends', () => {
  const s = save();
  const [a, b] = s.party;
  assert.equal(shiftMon(s, PARTY, 0, -1), false);
  assert.equal(shiftMon(s, PARTY, 0, 1), true);
  assert.deepEqual(s.party, [b, a]);
  assert.equal(shiftMon(s, PARTY, 1, 1), false);
  assert.equal(listAt(s, PARTY).length, 2);
});

test('everything survives serialising after a shuffle', () => {
  const s = save();
  moveMon(s, 0, 0, PARTY);
  copyMon(s, PARTY, 0);
  moveMon(s, PARTY, 3, 7);
  const back = new Gen1Save(s.serialize());
  assert.equal(back.party.length, s.party.length);
  assert.equal(back.boxes[7].length, 1);
  assert.equal(back.boxes[0].length, 1);
});
