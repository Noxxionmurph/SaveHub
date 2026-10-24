import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { ITEM_CHOICES } from '../src/core/gen1/data.ts';
import { itemSpritePath } from '../src/ui/editors/gen1/itemSprites.ts';

// The artwork is a separate repository, checked out as ./assets/ (see README). The checks that read the files are
// skipped when it isn't there, so the code still builds and tests without any artwork.
const sprites = new URL('../assets/sprites/', import.meta.url);
const has = (rel: string) => existsSync(new URL(rel, sprites));
const art = { skip: existsSync(sprites) ? false : 'artwork not checked out (git clone https://github.com/Noxxionmurph/SaveHub-assets assets)' };

test('every Pokédex entry 1-151 has an icon', art, () => {
  for (let dex = 1; dex <= 151; dex++) assert.ok(has(`pokemon/${dex}.png`), `missing pokemon/${dex}.png`);
});

test('every selectable Gen 1 item resolves to an icon file that exists', art, () => {
  for (const { id, name } of ITEM_CHOICES) {
    const path = itemSpritePath(id);
    assert.ok(has(`items/${path}.png`), `${name} (0x${id.toString(16)}) -> missing items/${path}.png`);
  }
});

test('TMs and HMs get a disc coloured by move type', () => {
  assert.equal(itemSpritePath(0xc9 + 23), 'tm/electric'); // TM24 Thunderbolt
  assert.equal(itemSpritePath(0xc9 + 37), 'tm/fire'); // TM38 Fire Blast
  assert.equal(itemSpritePath(0xc9 + 42), 'tm/flying'); // TM43 Sky Attack (Flying in Gen 1 data)
  assert.equal(itemSpritePath(0xc4 + 2), 'hm/water'); // HM03 Surf
});

test('all eight Kanto badges have a sprite', art, () => {
  for (let n = 1; n <= 8; n++) assert.ok(has(`badges/${n}.png`), `missing badges/${n}.png`);
});

test('all 15 Gen 1 types have an icon', art, () => {
  const types = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon'];
  for (const t of types) assert.ok(has(`types/${t}.png`), `missing types/${t}.png`);
});

test('icon offsets match the sprite files (rerun scripts/measure-icons.mjs after refreshing sprites)', art, async () => {
  const { readFile } = await import('node:fs/promises');
  const { centreOffset } = await import('../scripts/lib/png-alpha.mjs');
  const { ICON_OFFSETS, ICON_SIZE } = await import('../src/ui/spriteOffsets.ts');
  assert.equal(ICON_OFFSETS.length, 152);
  for (let dex = 1; dex <= 151; dex++) {
    const o = centreOffset(await readFile(new URL(`../assets/sprites/pokemon/${dex}.png`, import.meta.url)));
    assert.deepEqual([o.width, o.height], [...ICON_SIZE], `icon ${dex} size`);
    assert.deepEqual([...ICON_OFFSETS[dex]], [o.dx, o.dy], `icon ${dex} offset`);
  }
  // The art really does sit low (feet on a common baseline), which is what the shift corrects.
  assert.ok(ICON_OFFSETS.slice(1).every(([, dy]) => dy > 8 && dy < 22));
});
