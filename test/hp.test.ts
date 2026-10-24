import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hpBarColour, hpBarPixels } from '../src/core/gen1/hp.ts';

test('the bar is 48 pixels long, rounded down, and never empty while there is HP', () => {
  assert.equal(hpBarPixels(62, 62), 48);
  assert.equal(hpBarPixels(31, 62), 24);
  assert.equal(hpBarPixels(1, 200), 1, 'a sliver of HP still shows a pixel');
  assert.equal(hpBarPixels(0, 62), 0);
  assert.equal(hpBarPixels(100, 62), 48, 'more HP than the maximum fills the bar and no more');
  assert.equal(hpBarPixels(5, 0), 0, 'no known maximum, nothing to draw');
});

test('green from 27 pixels, yellow from 10, red below (the game\'s own cut-offs)', () => {
  assert.equal(hpBarColour(48), 'green');
  assert.equal(hpBarColour(27), 'green');
  assert.equal(hpBarColour(26), 'yellow');
  assert.equal(hpBarColour(10), 'yellow');
  assert.equal(hpBarColour(9), 'red');
  assert.equal(hpBarColour(0), 'red');
});

test('the cut-offs land where the game puts them for a real Pokémon (62 max HP)', () => {
  const at = (hp: number) => hpBarColour(hpBarPixels(hp, 62));
  assert.equal(at(35), 'green');   // 35 * 48 / 62 = 27.09 -> 27 pixels
  assert.equal(at(34), 'yellow');  // 26.3 -> 26
  assert.equal(at(13), 'yellow');  // 10.06 -> 10
  assert.equal(at(12), 'red');     // 9.29 -> 9
});
