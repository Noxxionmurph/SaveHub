import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOVE_NAMES } from '../src/core/gen1/data.ts';
import { maxPp, moveInfo } from '../src/core/gen1/moves.ts';

const idOf = (name: string) => MOVE_NAMES.indexOf(name);

test('move data lines up with the move names', () => {
  for (let id = 1; id < MOVE_NAMES.length; id++) assert.ok(moveInfo(id), `no data for #${id} ${MOVE_NAMES[id]}`);
  assert.equal(moveInfo(0), null);
  assert.equal(moveInfo(MOVE_NAMES.length), null);
  assert.deepEqual(moveInfo(idOf('Thunderbolt')), { type: 'Electric', power: 95, accuracy: 100, pp: 15 });
  assert.deepEqual(moveInfo(idOf('Surf')), { type: 'Water', power: 95, accuracy: 100, pp: 15 });
});

test('max PP follows the game: +1/5 of base per PP Up, at most +7 each', () => {
  const t = idOf('Thunderbolt'); // base 15
  assert.equal(maxPp(t, 0), 15);
  assert.equal(maxPp(t, 3), 24);
  assert.equal(maxPp(idOf('Growl'), 3), 61); // base 40: bonus capped at 7 -> 40 + 21
  assert.equal(maxPp(idOf('Hyper Beam'), 3), 8); // base 5
  assert.equal(maxPp(0, 3), 0);
});
