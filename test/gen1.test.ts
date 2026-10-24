import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_STATS, DEX_NAMES, DEX_TO_INTERNAL, GROWTH_BY_DEX, INTERNAL_TO_DEX, MOVE_NAMES, expForLevel, growthOf, guessGrowth, speciesName,
} from '../src/core/gen1/data.ts';
import { decodeText, encodeText, isEncodable, nameProblems } from '../src/core/gen1/text.ts';
import { nameWarning } from '../src/ui/editors/gen1/nameField.ts';
import {
  Gen1Save, SAVE_SIZE, calcStats, checksum8, gen1Handler, newMon, recalcPartyStats,
} from '../src/core/gen1/save.ts';
import { openSave } from '../src/core/registry.ts';
import { blankGen1Save } from '../src/core/gen1/sample.ts';

/** Build a minimal valid-looking blank save with a proper checksum. */
function blankSave(): Uint8Array {
  const d = new Uint8Array(SAVE_SIZE);
  d.set(encodeText('RED', 11), 0x2598);
  d.set(encodeText('BLUE', 11), 0x25f6);
  d[0x25c9] = 0; d[0x25ca] = 0xff;
  d[0x27e6] = 0; d[0x27e7] = 0xff;
  d[0x2f2c] = 0; d[0x2f2d] = 0xff;
  d[0x284c] = 0;
  // Empty box lists carry a 0xFF terminator, like a fresh game: current box + 12 stored boxes.
  d[0x30c1] = 0xff;
  for (const bank of [0x4000, 0x6000]) {
    for (let i = 0; i < 6; i++) d[bank + i * 0x462 + 1] = 0xff;
    d[bank + 0x1a4c] = checksum8(d, bank, bank + 0x1a4c);
    for (let i = 0; i < 6; i++) d[bank + 0x1a4d + i] = checksum8(d, bank + i * 0x462, bank + (i + 1) * 0x462);
  }
  d[0x3523] = checksum8(d, 0x2598, 0x3523);
  return d;
}

test('data tables are complete and consistent', () => {
  assert.equal(DEX_NAMES.length, 151);
  assert.equal(BASE_STATS.length, 151);
  assert.equal(MOVE_NAMES.length, 166); // 0 + 165 moves
  // Every dex number has exactly one internal index and round-trips.
  const seen = new Set<number>();
  INTERNAL_TO_DEX.forEach((dex) => { if (dex) { assert.ok(!seen.has(dex), `dup dex ${dex}`); seen.add(dex); } });
  assert.equal(seen.size, 151);
  for (let dex = 1; dex <= 151; dex++) assert.equal(INTERNAL_TO_DEX[DEX_TO_INTERNAL[dex]], dex);
  // Well-known internal indices.
  assert.equal(speciesName(0x54), 'Pikachu');
  assert.equal(speciesName(0x99), 'Bulbasaur');
  assert.equal(speciesName(0xb0), 'Charmander');
  assert.equal(speciesName(0x15), 'Mew');
  assert.equal(speciesName(0x83), 'Mewtwo');
  assert.equal(speciesName(0x01), 'Rhydon');
  assert.equal(BASE_STATS[24].hp, 35); // Pikachu
});

test('text encoding round-trips and keeps unknown bytes intact', () => {
  const enc = encodeText('Ash♂ Jr.', 11);
  assert.equal(decodeText(enc), 'Ash♂ Jr.');
  const weird = new Uint8Array([0x80, 0x01, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50]);
  assert.deepEqual(encodeText(decodeText(weird), 11, weird), weird);
});

test('the PK and MN symbols show as {PK} and {MN} and encode back to the same bytes', () => {
  // "Ashley" followed by the PK symbol: the trainer name in a real Yellow save
  const real = new Uint8Array([0x80, 0xb2, 0xa7, 0xab, 0xa4, 0xb8, 0xe1, 0x50, 0x00, 0x00, 0x00]);
  assert.equal(decodeText(real), 'Ashley{PK}');
  assert.equal(decodeText(encodeText('Ashley{PK}', 11)), 'Ashley{PK}');
  assert.deepEqual(encodeText('Ashley{PK}', 11).slice(0, 8), real.slice(0, 8));
  assert.deepEqual(encodeText('{MN}', 11).slice(0, 2), new Uint8Array([0xe2, 0x50]));
  // the letters P and K are different bytes from the symbol
  assert.deepEqual(encodeText('PK', 11).slice(0, 3), new Uint8Array([0x8f, 0x8a, 0x50]));
  // a symbol counts as one character toward the length limit
  assert.equal(decodeText(encodeText('{PK}{PK}{PK}{PK}{PK}{PK}{PK}{PK}', 8)), '{PK}{PK}{PK}{PK}{PK}{PK}{PK}');
  // untouched names keep their exact bytes
  assert.deepEqual(encodeText(decodeText(real), 11, real), real);
});

test('isEncodable says which names the game can show', () => {
  assert.equal(isEncodable('Ash♂ Jr.'), true);
  assert.equal(isEncodable('Ashley{PK}'), true);
  assert.equal(isEncodable('Zoë'), false);
  assert.equal(isEncodable('😀'), false);
  assert.equal(isEncodable('{PKX}'), false);
});

test('stat formula matches known Gen 1 values', () => {
  // Level 100 Mewtwo with max DVs and max stat exp: the well-known 415 HP / 406 Special.
  const s = calcStats(0x83, 100, { atk: 15, def: 15, spe: 15, spc: 15 }, { hp: 65535, atk: 65535, def: 65535, spe: 65535, spc: 65535 })!;
  assert.equal(s.hp, 415);
  assert.equal(s.spc, 406);
  // Level 5 Pikachu, DV 8 across, no EVs.
  const p = calcStats(0x54, 5, { atk: 8, def: 8, spe: 8, spc: 8 }, { hp: 0, atk: 0, def: 0, spe: 0, spc: 0 })!;
  assert.equal(p.hp, 18); // floor((35*2)*5/100) + 5 + 10
});

test('experience curves', () => {
  assert.equal(expForLevel('Medium Fast', 50), 125000);
  assert.equal(expForLevel('Fast', 100), 800000);
  assert.equal(expForLevel('Slow', 100), 1250000);
  assert.equal(expForLevel('Medium Slow', 100), 1059860);
  assert.equal(guessGrowth(100, 1059860), 'Medium Slow');
});

test('blank save detects, loads and serializes identically', () => {
  const raw = blankSave();
  assert.ok(gen1Handler.detect(raw));
  const found = openSave(raw);
  assert.ok(found);
  assert.equal(found.module.id, 'pokemon-gen1');
  const out = found.save.serialize();
  assert.deepEqual(out, raw); // an unedited save must round-trip byte-for-byte
});

test('edit everything, serialize, reload and compare', () => {
  const save = new Gen1Save(blankSave());
  save.trainerName = 'ASH';
  save.rivalName = 'GARY';
  save.trainerId = 0xbeef;
  save.money = 987654;
  save.coins = 9999;
  save.badges = 0xff;
  save.playHours = 123; save.playMinutes = 45; save.playSeconds = 12;
  save.bag = [{ id: 0x28, count: 99 }, { id: 0x14, count: 5 }];
  save.pcItems = [{ id: 0x01, count: 1 }];
  save.setOwned(25, true);
  save.setSeen(150, true);

  const pika = newMon(0x54, 25);
  pika.nickname = 'SPARKY';
  pika.otName = 'ASH';
  pika.otId = 0xbeef;
  pika.moves = [84, 98, 86, 97];
  pika.pp = [30, 30, 20, 30];
  pika.ppUps = [3, 0, 0, 0];
  pika.dvs = { atk: 15, def: 14, spe: 13, spc: 12 };
  pika.evs = { hp: 100, atk: 200, def: 300, spe: 400, spc: 500 };
  pika.exp = expForLevel('Medium Fast', 25);
  recalcPartyStats(pika, true);
  save.party = [pika];

  const mew = newMon(0x15, 30);
  mew.nickname = 'MEW';
  save.boxes[0] = [mew];
  save.boxes[8] = [newMon(0x83, 70), newMon(0x99, 5)];
  save.currentBoxIndex = 8;

  const bytes = save.serialize();
  assert.equal(bytes[0x3523], checksum8(bytes, 0x2598, 0x3523));
  assert.ok(gen1Handler.detect(bytes));

  const back = new Gen1Save(bytes);
  assert.equal(back.trainerName, 'ASH');
  assert.equal(back.rivalName, 'GARY');
  assert.equal(back.trainerId, 0xbeef);
  assert.equal(back.money, 987654);
  assert.equal(back.coins, 9999);
  assert.equal(back.badges, 0xff);
  assert.deepEqual([back.playHours, back.playMinutes, back.playSeconds], [123, 45, 12]);
  assert.deepEqual(back.bag, save.bag);
  assert.deepEqual(back.pcItems, save.pcItems);
  assert.equal(back.isOwned(25), 1);
  assert.equal(back.isSeen(25), 1);
  assert.equal(back.isSeen(150), 1);
  assert.equal(back.isOwned(150), 0);

  assert.equal(back.party.length, 1);
  const p = back.party[0];
  assert.equal(p.nickname, 'SPARKY');
  assert.equal(p.otName, 'ASH');
  assert.deepEqual(p.moves, [84, 98, 86, 97]);
  assert.deepEqual(p.pp, [30, 30, 20, 30]);
  assert.deepEqual(p.ppUps, [3, 0, 0, 0]);
  assert.deepEqual(p.dvs, pika.dvs);
  assert.deepEqual(p.evs, pika.evs);
  assert.equal(p.exp, pika.exp);
  assert.equal(p.maxHp, pika.maxHp);
  assert.equal(p.hp, pika.maxHp);

  assert.equal(back.currentBoxIndex, 8);
  assert.equal(back.boxes[0].length, 1);
  assert.equal(back.boxes[0][0].nickname, 'MEW');
  assert.equal(back.boxes[8].length, 2);
  assert.equal(speciesName(back.boxes[8][0].species), 'Mewtwo');
  assert.equal(speciesName(back.boxes[8][1].species), 'Bulbasaur');

  // Party species list and terminator are kept in sync.
  assert.equal(bytes[0x2f2c], 1);
  assert.equal(bytes[0x2f2d], 0x54);
  assert.equal(bytes[0x2f2e], 0xff);

  // Bank 2 (boxes 1-6) was edited, so its checksums are refreshed; bank 3 is untouched and left alone.
  const bank = 0x4000;
  assert.equal(bytes[bank + 0x1a4c], checksum8(bytes, bank, bank + 0x1a4c));
  for (let i = 0; i < 6; i++) {
    assert.equal(bytes[bank + 0x1a4d + i], checksum8(bytes, bank + i * 0x462, bank + (i + 1) * 0x462));
  }
  assert.deepEqual(bytes.slice(0x6000, 0x8000), blankSave().slice(0x6000, 0x8000));

  // Idempotent: loading and re-serializing yields the same bytes.
  assert.deepEqual(back.serialize(), bytes);
});

test('bad checksum is rejected by detection', () => {
  const raw = blankSave();
  raw[0x3523] ^= 0xff;
  assert.equal(gen1Handler.detect(raw), false);
  assert.equal(openSave(raw), null);
});

test('in-game options read and write the right bits and nothing else', () => {
  const raw = blankSave();
  raw[0x2601] = 0b1100_0011; // medium text, Set battle style, animations off
  raw[0x3523] = checksum8(raw, 0x2598, 0x3523);
  const s = new Gen1Save(raw);
  assert.deepEqual(s.options, { textSpeed: 3, battleStyleSet: true, battleAnimationsOff: true });
  assert.deepEqual(s.serialize(), raw); // untouched => byte-identical

  s.options.textSpeed = 1;
  s.options.battleAnimationsOff = false;
  const out = s.serialize();
  assert.equal(out[0x2601], 0b0100_0001);
  assert.ok(Gen1Save.checksumValid(out));
  const back = new Gen1Save(out);
  assert.deepEqual(back.options, { textSpeed: 1, battleStyleSet: true, battleAnimationsOff: false });
  // Only the options byte (and the checksum) differ from the original.
  const diff = [...out.keys()].filter((i) => out[i] !== raw[i]);
  assert.deepEqual(diff, [0x2601, 0x3523]);

  // A text-speed value the menu doesn't offer is kept as the game left it.
  raw[0x2601] = 0b0000_0111;
  raw[0x3523] = checksum8(raw, 0x2598, 0x3523);
  assert.equal(new Gen1Save(raw).serialize()[0x2601], 7);
});

test('nameProblems and nameWarning say what the game would change in a typed name', () => {
  assert.deepEqual(nameProblems('Ashley{PK}', 10), { unsupported: [], extra: 0 });
  assert.deepEqual(nameProblems('Zoë@@ ✓', 10), { unsupported: ['ë', '@', '✓'], extra: 0 });
  assert.deepEqual(nameProblems('ABCDEFGHIJKL', 10), { unsupported: [], extra: 2 });
  assert.deepEqual(nameProblems('{PK}{PK}{PK}{PK}{PK}{PK}', 10), { unsupported: [], extra: 0 }, 'a symbol is one character');
  assert.equal(nameWarning('Ashley{PK}'), '');
  assert.equal(nameWarning('Zoë'), 'The game can’t show “ë”. It is saved as “?”.');
  assert.equal(nameWarning('Zoë@'), 'The game can’t show “ë” “@”. They are saved as “?”.');
  assert.equal(nameWarning('ABCDEFGHIJKL'), 'Only the first 10 characters are kept.');
  assert.match(nameWarning('é#$%&*+=<>'), /saved as/);
  assert.equal(nameWarning('é'), '', 'é is in the game’s character set');
});

test('the TRAINER text used as an original trainer shows as {TRAINER} and encodes back to the same byte', () => {
  const bytes = Uint8Array.of(0x5d, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50);
  assert.equal(decodeText(bytes), '{TRAINER}');
  assert.deepEqual([...encodeText('{TRAINER}', 11)], [...bytes]);
  assert.equal(isEncodable('{TRAINER}'), true);
  assert.deepEqual(nameProblems('{TRAINER}', 10), { unsupported: [], extra: 0 });
});

// A real Blue save from an emulator: every party Pokémon has 0 in the "box level" byte (+3) but its real level in the
// stats block (+0x21). The level the game uses is the second one.
const PARTY_AT = 0x2f2c + 8; // first party Pokémon: after the count and the 7-byte species list

function partyOfTwo(): Uint8Array {
  const raw = blankGen1Save('ASH', 'GARY');
  const s = new Gen1Save(raw);
  s.party = [newMon(DEX_TO_INTERNAL[16], 12), newMon(DEX_TO_INTERNAL[19], 5)];
  const d = s.serialize();
  d[PARTY_AT + 3] = 0; // box level left at 0, as in the real save
  d[0x3523] = checksum8(d, 0x2598, 0x3523);
  return d;
}

test('a party Pokémon’s level comes from its stats block, not the box-level byte', () => {
  const raw = partyOfTwo();
  const s = new Gen1Save(raw);
  assert.deepEqual(s.party.map((m) => m.level), [12, 5]);
  assert.deepEqual(s.serialize(), raw); // untouched => byte-identical, the 0 stays
});

test('changing a party Pokémon’s level updates both level bytes; moving it to a box stores its level there', () => {
  const raw = partyOfTwo();
  const s = new Gen1Save(raw);
  s.party[0].level = 30;
  recalcPartyStats(s.party[0]);
  let out = s.serialize();
  assert.equal(out[PARTY_AT + 3], 30);
  assert.equal(out[PARTY_AT + 33], 30);
  assert.equal(new Gen1Save(out).party[0].level, 30);

  const s2 = new Gen1Save(raw); // the second one is edited elsewhere; the first keeps its 0
  s2.party[1].level = 6;
  out = s2.serialize();
  assert.equal(out[PARTY_AT + 3], 0, 'untouched Pokémon keep their box-level byte');
  assert.equal(out[PARTY_AT + 44 + 3], 6);

  const s3 = new Gen1Save(raw);
  s3.boxes[0] = [s3.party.shift()!]; // deposited: boxes only have the one level byte
  out = s3.serialize();
  assert.equal(new Gen1Save(out).boxes[0][0].level, 12);
});

test('bytes after the 32 KB save (an emulator’s clock footer) are kept', () => {
  const raw = partyOfTwo();
  const footer = Uint8Array.from({ length: 44 }, (_, i) => i * 3 + 1);
  const withFooter = new Uint8Array(raw.length + footer.length);
  withFooter.set(raw); withFooter.set(footer, raw.length);
  assert.equal(Gen1Save.checksumValid(withFooter), true);
  const s = new Gen1Save(withFooter);
  assert.deepEqual(s.serialize(), withFooter);
  s.money = 1234;
  const out = s.serialize();
  assert.equal(out.length, withFooter.length);
  assert.deepEqual(out.slice(raw.length), footer);
  assert.equal(Gen1Save.checksumValid(out), true);
});

test('every species has its game-fixed growth curve, and the experience follows it', () => {
  assert.equal(GROWTH_BY_DEX.length, 151);
  const count = (g: string) => GROWTH_BY_DEX.filter((x) => x === g).length;
  assert.deepEqual(['Medium Fast', 'Fast', 'Medium Slow', 'Slow'].map(count), [80, 5, 40, 26]);
  const growth = (dex: number) => GROWTH_BY_DEX[dex - 1];
  assert.deepEqual([16, 19, 25, 4, 35, 129, 149, 151].map(growth),
    ['Medium Slow', 'Medium Fast', 'Medium Fast', 'Medium Slow', 'Fast', 'Slow', 'Slow', 'Medium Slow']);
  // the real case that exposed the guess: a level-3 Pidgey with 57 exp fits two curves; Pidgey is Medium Slow
  assert.equal(growthOf(DEX_TO_INTERNAL[16]), 'Medium Slow');
  assert.equal(guessGrowth(3, 57), 'Medium Fast');
  assert.equal(expForLevel(growthOf(DEX_TO_INTERNAL[16]), 3), 57);
  assert.equal(expForLevel(growthOf(DEX_TO_INTERNAL[16]), 10), 560);
  assert.equal(growthOf(0xff, 'Slow'), 'Slow'); // a glitch species falls back to what the caller guessed
});
