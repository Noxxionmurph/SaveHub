import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DEX_TO_INTERNAL, FRIENDSHIP_EVENTS, REACTIONS, REACTION_ROWS, moodLabel, pikachuReaction, pikachuReactionInfo, pikachuReactionName } from '../src/core/gen1/data.ts';
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

test('Yellow save: editing only the mood changes only the mood byte and the checksum', () => {
  const raw = yellowBytes(226, 0x80);
  const s = new Gen1Save(raw);
  s.pikachuMood = 255;
  const out = s.serialize();
  assert.equal(out[0x271d], 255);
  assert.ok(Gen1Save.checksumValid(out));
  assert.deepEqual([...out.keys()].filter((i) => out[i] !== raw[i]), [0x271d, 0x3523]);
  assert.equal(new Gen1Save(out).pikachuMood, 255);
});

test('mood words: below 128 is upset, 128 neutral, above cheerful', () => {
  assert.deepEqual([0, 127, 128, 129, 255].map(moodLabel), ['Upset', 'Upset', 'Neutral', 'Cheerful', 'Cheerful']);
});

/**
 * The game picks Pikachu's reaction with two tables (pokeyellow: GetPikaPicAnimationScriptIndex). This runs them
 * as they are written there and checks the editor's shorter table gives the same answer for every friendship and mood.
 */
test('the reaction shown matches the game’s own lookup for every friendship and mood', () => {
  const MOODS: [number, number][] = [[40, 1], [127, 2], [128, 3], [210, 4], [255, 5]]; // mood limit, column
  const ROWS: [number, string[]][] = [ // friendship limit, one animation per column
    [50, ['AngryBolt', 'AngryBolt', 'SideBlink', 'Side', 'Side']],
    [100, ['BackTurn', 'BackTurn', 'Sad', 'Bored', 'Bored']],
    [130, ['EarTwitch', 'EarTwitch', 'Blink2', 'Smile', 'Smile']],
    [160, ['EarTwitch', 'EarTwitch', 'Happy', 'FistPump', 'FistPump']],
    [200, ['Mad', 'Mad', 'Jump', 'Excited', 'Excited']],
    [250, ['Mad', 'Mad', 'Heart', 'Joy', 'Joy']],
    [255, ['Mad', 'Mad', '2Hearts', 'Love', 'Love']],
  ];
  const game = (friendship: number, mood: number): string => {
    const col = MOODS.find(([limit]) => limit >= mood)![1];
    return ROWS.find(([limit]) => limit >= friendship)![1][col - 1];
  };
  for (let f = 0; f < 256; f++) for (let m = 0; m < 256; m++) {
    assert.equal(pikachuReactionName(f, m), game(f, m), `friendship ${f}, mood ${m}`);
  }
  assert.equal(pikachuReaction(226, 128), 'shows a heart'); // the real save
  assert.equal(pikachuReaction(226, 20), 'looks mad');
  assert.equal(pikachuReaction(30, 255), 'looks off to the side');
});

test('the reaction chart rows cover friendship 0 to 255 with no gaps, and every reaction has a picture', () => {
  assert.equal(REACTION_ROWS[0].from, 0);
  assert.equal(REACTION_ROWS[REACTION_ROWS.length - 1].upTo, 255);
  REACTION_ROWS.forEach((r, i) => { if (i) assert.equal(r.from, REACTION_ROWS[i - 1].upTo + 1); });
  const used = new Set(REACTION_ROWS.flatMap((r) => [r.below, r.at, r.above]));
  assert.equal(used.size, 18);
  for (const name of used) assert.ok(REACTIONS[name], `${name} has a picture entry`);
  assert.deepEqual(Object.keys(REACTIONS).filter((n) => !used.has(n)), [], 'no unused entries');
  assert.deepEqual(pikachuReactionInfo(226, 128), { name: 'Heart', slug: 'heart', row: 14, text: 'shows a heart', short: 'Heart' });
});

test('the picture sheet has one row per reaction, in the order the cut script writes them', () => {
  const png = readFileSync(new URL('../assets/sprites/pikachu.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 80, 'two 40px frames across');
  assert.equal(png.readUInt32BE(20), 40 * Object.keys(REACTIONS).length, 'one 40px row per reaction');
  const script = readFileSync(new URL('../scripts/extract-pikachu.py', import.meta.url), 'utf8');
  const names = [...script.match(/NAMES = \[([^\]]*)\]/)![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const byRow = Object.values(REACTIONS).sort((a, b) => a.row - b.row);
  assert.deepEqual(byRow.map((r) => r.row), names.map((_, i) => i), 'rows 0, 1, 2 ... with no gaps or repeats');
  assert.deepEqual(byRow.map((r) => r.slug), names);
});

test('the friendship rules list gains and losses with three amounts each', () => {
  assert.equal(FRIENDSHIP_EVENTS.length, 11);
  for (const e of FRIENDSHIP_EVENTS) {
    assert.equal(e.amounts.length, 3);
    assert.ok(e.amounts.every((n) => (e.up ? n >= 0 : n < 0)), e.what);
  }
  // the first row of the game's table: gaining a level is +5 / +3 / +2; being traded away is -10 / -10 / -20
  assert.deepEqual(FRIENDSHIP_EVENTS.find((e) => e.what.includes('levels up'))?.amounts, [5, 3, 2]);
  assert.deepEqual(FRIENDSHIP_EVENTS.find((e) => e.what.includes('trade'))?.amounts, [-10, -10, -20]);
});
