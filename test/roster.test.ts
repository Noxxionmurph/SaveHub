import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEX_TO_INTERNAL } from '../src/core/gen1/data.ts';
import { PARTY, copyMon, dropMon, listAt, moveMon, removeMon, shiftMon, spaceAt } from '../src/core/gen1/roster.ts';
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

test('dropping onto a Pokémon swaps them, in a box or across places', () => {
  const s = save();
  s.boxes[0].push(mon(1), mon(4));
  const [a, b, c, d] = s.boxes[0];
  assert.deepEqual(dropMon(s, { where: 0, index: 0 }, { where: 0, index: 3 }), { kind: 'swap' });
  assert.deepEqual(s.boxes[0], [d, b, c, a]);

  // box -> party: each lands in the other's slot, and the one entering the party gets battle stats
  const [pikachu] = s.party;
  d.level = 50;
  assert.deepEqual(dropMon(s, { where: 0, index: 0 }, { where: PARTY, index: 0 }), { kind: 'swap' });
  assert.equal(s.party[0], d);
  assert.equal(s.boxes[0][0], pikachu);
  assert.equal(d.partyLevel, 50);
  assert.ok(d.maxHp > 50, 'stats recalculated for the new level');
  assert.equal(s.party.length, 2);
  assert.equal(s.boxes[0].length, 4);
});

test('swapping works when both places are full and when the party has one member', () => {
  const s = save();
  while (s.party.length < 6) s.party.push(mon(1));
  s.boxes[1] = Array.from({ length: 20 }, () => mon(2));
  assert.equal(moveMon(s, 1, 0, PARTY), 'full');
  assert.deepEqual(dropMon(s, { where: 1, index: 7 }, { where: PARTY, index: 5 }), { kind: 'swap' });
  assert.equal(s.party.length, 6);
  assert.equal(s.boxes[1].length, 20);

  s.party = [s.party[0]];
  assert.deepEqual(dropMon(s, { where: PARTY, index: 0 }, { where: 0, index: 1 }), { kind: 'swap' });
  assert.equal(s.party.length, 1);
});

test('dropping onto an empty spot moves to the end of that place', () => {
  const s = save();
  const [first, second] = s.boxes[0];
  // same box: to the end of the list
  assert.deepEqual(dropMon(s, { where: 0, index: 0 }, { where: 0, index: 9 }), { kind: 'move' });
  assert.deepEqual(s.boxes[0], [second, first]);
  assert.equal(dropMon(s, { where: 0, index: 1 }, { where: 0, index: 5 }), 'same', 'already last');
  // another box
  assert.deepEqual(dropMon(s, { where: 0, index: 0 }, { where: 3, index: 0 }), { kind: 'move' });
  assert.deepEqual(s.boxes[3], [second]);
  assert.equal(s.boxes[0].length, 1);
});

test('drops that cannot happen say why and change nothing', () => {
  const s = save();
  s.boxes[2] = Array.from({ length: 20 }, () => mon(1));
  s.party = [s.party[0]];
  const before = JSON.stringify([s.party, s.boxes]);
  assert.equal(dropMon(s, { where: 0, index: 0 }, { where: 0, index: 0 }), 'same');
  assert.equal(dropMon(s, { where: 0, index: 7 }, { where: 1, index: 0 }), 'missing');
  assert.equal(dropMon(s, { where: 0, index: 0 }, { where: 2, index: 20 }), 'full');
  assert.equal(dropMon(s, { where: PARTY, index: 0 }, { where: 5, index: 0 }), 'last-party');
  assert.equal(JSON.stringify([s.party, s.boxes]), before);
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
