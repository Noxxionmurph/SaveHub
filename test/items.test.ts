import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEM_CHOICES, isBagItem, itemName, tmhmMoveName } from '../src/core/gen1/data.ts';

const offered = (name: string) => ITEM_CHOICES.some((c) => c.name === name);

test('the item picker leaves out things you cannot hold in the bag', () => {
  for (const name of ['BoulderBadge', 'CascadeBadge', 'ThunderBadge', 'RainbowBadge', 'SoulBadge', 'MarshBadge', 'VolcanoBadge', 'EarthBadge']) {
    assert.equal(offered(name), false, `${name} should not be pickable`);
  }
  assert.equal(offered('?????'), false);
  for (const name of ['Pokédex', 'Coin', 'Safari Ball']) assert.equal(offered(name), false, name);
});

test('the item picker keeps real items, TMs and HMs, and lists PP Up once', () => {
  for (const name of ['Potion', 'Master Ball', 'Rare Candy', 'Bicycle', 'Itemfinder', 'Exp. All', 'HM01', 'HM05', 'TM01', 'TM50']) {
    assert.equal(offered(name), true, `${name} should be pickable`);
  }
  assert.equal(ITEM_CHOICES.filter((c) => c.name === 'PP Up').length, 1);
  assert.equal(ITEM_CHOICES.length, 138 - 14); // 138 table entries minus the 14 non-bag ones
});

test('items already in a save are still named even when the picker would not offer them', () => {
  assert.equal(isBagItem(0x15), false);
  assert.equal(itemName(0x15), 'BoulderBadge');
});

test('TMs and HMs name the move they teach', () => {
  assert.equal(tmhmMoveName(0xc4), 'Cut');           // HM01
  assert.equal(tmhmMoveName(0xc8), 'Flash');         // HM05
  assert.equal(tmhmMoveName(0xc9), 'Mega Punch');    // TM01
  assert.equal(tmhmMoveName(0xe0), 'Thunderbolt');   // TM24
  assert.equal(tmhmMoveName(0xfa), 'Substitute');    // TM50
  assert.equal(tmhmMoveName(0x28), null);            // Rare Candy
});
