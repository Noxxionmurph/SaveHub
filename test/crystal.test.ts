import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeCaught, encodeCaught, locationName, LANDMARK_GIFT, LOCATION_CHOICES } from '../src/core/gen2/caught.ts';
import { itemChoices, itemName } from '../src/core/gen2/data.ts';
import { GEN2_LAYOUTS, Gen2Save, SAVE_SIZE, sum16 } from '../src/core/gen2/save.ts';
import { blankGen2Save, buildSampleSave } from '../src/core/gen2/sample.ts';
import { openSave } from '../src/core/registry.ts';

const C = GEN2_LAYOUTS.crystal;
const mainSum = (d: Uint8Array) => d[0x2d0d] | (d[0x2d0e] << 8);
const backupSum = (d: Uint8Array) => d[0x1f0d] | (d[0x1f0e] << 8);

test('the Crystal layout follows pokecrystal: game data 0x2009-0x2B83, checksum at 0x2D0D, backup in bank 0', () => {
  assert.equal(C.gameDataEnd - C.gameData, 0xb7a); // wPlayerData + wCurMapData + wPokemonData
  assert.equal(C.party - C.gameData, 0x82a + 0x32); // party count comes right after the player and map data
  assert.equal(C.dexCaught - C.party, GEN2_LAYOUTS.gs.dexCaught - GEN2_LAYOUTS.gs.party); // Pokémon data is the same shape
  assert.deepEqual(C.backup, [[0x2000, 0x2009, 0x1200], [0x2009, 0x2b83, 0x1209]]);
});

test('a blank Crystal save passes both checksums and round-trips', () => {
  const raw = blankGen2Save('crystal', 'CHRIS', 'SILVER');
  assert.ok(Gen2Save.mainValid(raw, 'crystal'));
  assert.ok(!Gen2Save.mainValid(raw, 'gs'));
  assert.equal(mainSum(raw), sum16(raw, 0x2009, 0x2b83));
  assert.equal(backupSum(raw), mainSum(raw));
  const s = new Gen2Save(raw);
  assert.equal(s.game, 'crystal');
  assert.equal(s.trainerName, 'CHRIS');
  assert.equal(s.playerGender, 'boy');
  assert.deepEqual(s.serialize(), raw);
});

test('Gold, Silver and Crystal saves each open with their own module', async () => {
  assert.equal((await openSave(buildSampleSave('crystal')))?.module.id, 'pokemon-crystal');
  assert.equal((await openSave(buildSampleSave('gs')))?.module.id, 'pokemon-gen2');
  assert.equal(Gen2Save.detectGame(new Uint8Array(SAVE_SIZE)), null);
});

test('the Crystal sample plays as the girl, records where things were caught, and round-trips', () => {
  const raw = buildSampleSave('crystal');
  assert.deepEqual(buildSampleSave('crystal'), raw, 'building twice gives the same bytes');
  const s = new Gen2Save(raw);
  assert.equal(s.trainerName, 'KRIS');
  assert.equal(s.playerGender, 'girl');
  assert.equal(raw[0x3e3d], 1);
  assert.ok(s.keyItems.includes(0x74)); // Blue Card
  assert.deepEqual(decodeCaught(s.party[1].caught), { time: 'night', level: 30, location: 0x26, otGender: 'girl' });
  assert.equal(locationName(s.party[1].caught[1] & 0x7f), 'Lake of Rage');
  assert.deepEqual(s.party[5].caught, [0, 0]); // the egg
  assert.deepEqual(s.serialize(), raw);
});

test('Crystal edits rewrite the checksum and the one-piece backup; the gender byte is kept outside it', () => {
  const s = new Gen2Save(buildSampleSave('crystal'));
  s.money = 123456;
  s.playerGender = 'boy';
  s.party[0].caught = encodeCaught({ time: 'day', level: 9, location: LANDMARK_GIFT, otGender: 'boy' });
  const out = s.serialize();
  assert.ok(Gen2Save.mainValid(out, 'crystal'));
  assert.equal(backupSum(out), mainSum(out));
  assert.equal(out[0x1f0f], 127);
  assert.deepEqual(out.subarray(0x1209, 0x1d83), out.subarray(0x2009, 0x2b83));
  assert.deepEqual(out.subarray(0x1200, 0x1209), out.subarray(0x2000, 0x2009));
  assert.equal((out[0x23dc] << 16) | (out[0x23dd] << 8) | out[0x23de], 123456);
  assert.equal(out[0x3e3d], 0);
  const again = new Gen2Save(out);
  assert.equal(again.playerGender, 'boy');
  assert.deepEqual(decodeCaught(again.party[0].caught), { time: 'day', level: 9, location: LANDMARK_GIFT, otGender: 'boy' });
  const text = again.describeChanges(new Gen2Save(buildSampleSave('crystal'))).flatMap((g) => g.lines).join('\n');
  for (const want of ['Plays as: girl → boy', 'where it was caught changed', 'Money']) assert.ok(text.includes(want), `${want}\n${text}`);
});

test('caught data packs time, level, place and the trainer’s gender as Crystal does', () => {
  // SetCaughtData: (time of day + 1) in bits 6-7 with the level, then the landmark with the gender in bit 7.
  assert.deepEqual(encodeCaught({ time: 'night', level: 5, location: 1, otGender: 'boy' }), [0xc5, 0x01]);
  assert.deepEqual(encodeCaught({ time: 'morning', level: 63, location: 0x2e, otGender: 'girl' }), [0x7f, 0xae]);
  assert.deepEqual(decodeCaught([0, 0]), { time: null, level: 0, location: 0, otGender: 'boy' });
  assert.equal(locationName(0), 'Not recorded');
  assert.equal(locationName(0x09), 'Ruins of Alph');
  assert.equal(locationName(0x5f), 'Fast Ship');
  assert.equal(LOCATION_CHOICES.length, 0x60 + 2);
});

test('Crystal names its four new key items; Gold and Silver leave those ids unused', () => {
  assert.equal(itemName(0x73, 'crystal'), 'GS Ball');
  assert.equal(itemName(0x46, 'crystal'), 'Clear Bell');
  assert.equal(itemName(0x73), 'Item 0x73');
  const crystalKeys = itemChoices(['key'], 'crystal').map((c) => c.name);
  for (const name of ['Clear Bell', 'GS Ball', 'Blue Card', 'Egg Ticket']) assert.ok(crystalKeys.includes(name), name);
  assert.equal(crystalKeys.length, itemChoices(['key']).length + 4);
});

// ---------- a real save, if you have one ----------
// Set CRYSTAL_SAV=/path/to/your.sav to check it round-trips. Nothing from it is printed or stored.

const real = process.env.CRYSTAL_SAV;
test('a real Crystal save round-trips byte for byte, and an edit keeps both copies valid', { skip: real && existsSync(real) ? false : 'set CRYSTAL_SAV to a real save to run' }, async () => {
  const raw = new Uint8Array(readFileSync(real!));
  const found = await openSave(raw);
  assert.equal(found?.module.id, 'pokemon-crystal');
  assert.deepEqual(found!.save.serialize().subarray(0, SAVE_SIZE), raw.subarray(0, SAVE_SIZE));
  const s = found!.save as Gen2Save;
  s.coins = (s.coins + 1) % 10000;
  const out = s.serialize();
  assert.ok(Gen2Save.mainValid(out, 'crystal'));
  assert.equal(backupSum(out), mainSum(out));
});
