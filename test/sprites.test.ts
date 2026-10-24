import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { ITEM_CHOICES } from '../src/core/gen1/data.ts';
import { itemSpritePath } from '../src/ui/editors/gen1/itemSprites.ts';

const sprites = new URL('../assets/sprites/', import.meta.url);
const has = (rel: string) => existsSync(new URL(rel, sprites));

test('every Pokédex entry 1-151 has an icon', () => {
  for (let dex = 1; dex <= 151; dex++) assert.ok(has(`pokemon/${dex}.png`), `missing pokemon/${dex}.png`);
});

test('every selectable Gen 1 item resolves to an icon file that exists', () => {
  for (const { id, name } of ITEM_CHOICES) {
    const path = itemSpritePath(id);
    assert.ok(has(`items/${path}.png`), `${name} (0x${id.toString(16)}) -> missing items/${path}.png`);
  }
});

test('TMs and HMs get a disc coloured by move type', () => {
  assert.equal(itemSpritePath(0xc9 + 23), 'tm/electric'); // TM24 Thunderbolt
  assert.equal(itemSpritePath(0xc9 + 37), 'tm/fire'); // TM38 Fire Blast
  assert.equal(itemSpritePath(0xc4 + 2), 'hm/water'); // HM03 Surf
});

test('all eight Kanto badges have a sprite', () => {
  for (let n = 1; n <= 8; n++) assert.ok(has(`badges/${n}.png`), `missing badges/${n}.png`);
});
