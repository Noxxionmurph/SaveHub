import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEX_TO_INTERNAL } from '../src/core/gen1/data.ts';
import { Gen1Save, PIKACHU_INTERNAL, checksum8, looksLikeYellow, newMon } from '../src/core/gen1/save.ts';
import { blankGen1Save } from '../src/core/gen1/sample.ts';
import pokemonGen1 from '../src/games/pokemon-gen1.ts';

/** A blank save with Yellow's Pikachu block filled in, the way a real Yellow file looks. */
function yellowBytes(friendship = 226, mood = 0x80): Uint8Array {
  const d = blankGen1Save('ASH', 'GARY');
  d[0x271c] = friendship;
  d[0x271d] = mood;
  d[0x271e] = 0xa0;
  d[0x3523] = checksum8(d, 0x2598, 0x3523);
  return d;
}

test('Yellow is recognised by its Pikachu block; Red and Blue leave it empty', () => {
  assert.equal(looksLikeYellow(blankGen1Save()), false);
  assert.equal(looksLikeYellow(yellowBytes()), true);
  assert.equal(looksLikeYellow(new Uint8Array(10)), false);
  assert.deepEqual(pokemonGen1.identify!(yellowBytes()).names, ['Pokémon Yellow']);
  const rb = pokemonGen1.identify!(blankGen1Save());
  assert.deepEqual(rb.names, ['Pokémon Red', 'Pokémon Blue']);
  assert.ok(rb.note);
});

test('Yellow save: friendship and mood read, edit and round-trip', () => {
  const raw = yellowBytes(226, 0x80);
  const s = new Gen1Save(raw);
  assert.equal(s.isYellow, true);
  assert.equal(s.pikachuFriendship, 226);
  assert.equal(s.pikachuMood, 0x80);
  assert.deepEqual(s.serialize(), raw); // untouched => byte-identical

  s.pikachuFriendship = 255;
  const out = s.serialize();
  assert.equal(out[0x271c], 255);
  assert.equal(out[0x271d], 0x80);
  assert.ok(Gen1Save.checksumValid(out));
  const diff = [...out.keys()].filter((i) => out[i] !== raw[i]);
  assert.deepEqual(diff, [0x271c, 0x3523]);
});

test('Red/Blue save: the Pikachu fields are never written', () => {
  const raw = blankGen1Save();
  const s = new Gen1Save(raw);
  assert.equal(s.isYellow, false);
  s.pikachuFriendship = 200; // not shown in the UI for Red/Blue, but must not leak into the file
  assert.deepEqual(s.serialize(), raw);
});

test('the starter Pikachu is the one with your Trainer ID and name as OT', () => {
  const s = new Gen1Save(yellowBytes());
  s.trainerId = 12345;
  const mine = newMon(PIKACHU_INTERNAL, 20);
  mine.otId = 12345; mine.otName = 'ASH';
  const wrongId = newMon(PIKACHU_INTERNAL, 20);
  wrongId.otId = 999; wrongId.otName = 'ASH';
  const wrongName = newMon(PIKACHU_INTERNAL, 20);
  wrongName.otId = 12345; wrongName.otName = 'GARY';
  const notPikachu = newMon(DEX_TO_INTERNAL[26], 20);
  notPikachu.otId = 12345; notPikachu.otName = 'ASH';
  assert.deepEqual([mine, wrongId, wrongName, notPikachu].map((m) => s.isStarterPikachu(m)), [true, false, false, false]);

  // Only the first five characters of the name count, as in the game.
  s.trainerName = 'ALEXANDER';
  const long = newMon(PIKACHU_INTERNAL, 20);
  long.otId = 12345; long.otName = 'ALEXAXXXX';
  assert.equal(s.isStarterPikachu(long), true);

  s.makeStarter(wrongName);
  assert.equal(s.isStarterPikachu(wrongName), true);
  assert.equal(wrongName.otName, 'ALEXANDER');
});

test('a name with the PK symbol shows as {PK} and is still matched byte for byte', () => {
  const raw = yellowBytes();
  raw.set([0x80, 0xb2, 0xa7, 0xab, 0xa4, 0xb8, 0xe1, 0x50, 0x50, 0x50, 0x50], 0x2598); // "Ashley" + PK glyph
  raw[0x3523] = checksum8(raw, 0x2598, 0x3523);
  const s = new Gen1Save(raw);
  assert.equal(s.trainerName, 'Ashley{PK}');
  const pika = newMon(PIKACHU_INTERNAL, 30);
  pika.otId = s.trainerId;
  s.makeStarter(pika);
  assert.equal(s.isStarterPikachu(pika), true);
  s.party = [pika];
  const out = s.serialize();
  assert.deepEqual([...out.slice(0x2598, 0x259f)], [0x80, 0xb2, 0xa7, 0xab, 0xa4, 0xb8, 0xe1]); // glyph kept
});
