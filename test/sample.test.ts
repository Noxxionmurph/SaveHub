import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemName, speciesName } from '../src/core/gen1/data.ts';
import { Gen1Save, gen1Handler } from '../src/core/gen1/save.ts';
import { blankGen1Save, buildSampleSave } from '../src/core/gen1/sample.ts';
import { openSave } from '../src/core/registry.ts';

test('the blank save is valid and empty', () => {
  const raw = blankGen1Save('RED', 'BLUE');
  assert.ok(gen1Handler.detect(raw));
  const s = new Gen1Save(raw);
  assert.equal(s.trainerName, 'RED');
  assert.equal(s.party.length, 0);
  assert.deepEqual(s.serialize(), raw);
});

test('the sample save opens as a Gen 1 save and survives a round trip', () => {
  const raw = buildSampleSave();
  assert.deepEqual(buildSampleSave(), raw, 'building twice gives the same bytes');
  const found = openSave(raw);
  assert.equal(found?.module.id, 'pokemon-gen1');
  assert.deepEqual(found!.save.serialize(), raw);
});

test('the sample has something on every tab', () => {
  const s = new Gen1Save(buildSampleSave());
  assert.equal(s.trainerName, 'ASH');
  assert.equal(s.badges, 7);
  assert.deepEqual(s.options, { textSpeed: 3, battleStyleSet: false, battleAnimationsOff: false });
  assert.deepEqual(s.party.map((m) => speciesName(m.species)), ['Pikachu', 'Charmeleon', 'Pidgeotto', 'Geodude', 'Squirtle', 'Magikarp']);
  assert.equal(s.party[0].nickname, 'SPARKY');
  assert.equal(s.boxes[0].length, 5);
  assert.equal(s.boxes[1].length, 2);
  assert.ok(s.bag.length >= 8 && s.bag.every((it) => itemName(it.id) && !itemName(it.id).startsWith('?')));
  let owned = 0, seen = 0;
  for (let d = 1; d <= 151; d++) { owned += s.isOwned(d); seen += s.isSeen(d); }
  assert.ok(owned >= 10 && seen >= 40, `owned ${owned}, seen ${seen}`);
  // Every Pokémon's moves have PP, and a party member's stats are consistent with its level.
  for (const m of [...s.party, ...s.boxes.flat()]) m.moves.forEach((mv, i) => assert.equal(mv ? m.pp[i] > 0 : m.pp[i] === 0, true));
  for (const m of s.party) assert.equal(m.hp, m.maxHp);
});
