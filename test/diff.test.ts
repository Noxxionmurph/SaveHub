import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEX_TO_INTERNAL } from '../src/core/gen1/data.ts';
import { Gen1Save, SAVE_SIZE, checksum8, newMon, recalcPartyStats } from '../src/core/gen1/save.ts';
import { buildSampleSave } from '../src/core/gen1/sample.ts';
import { encodeText } from '../src/core/gen1/text.ts';

function blank(): Uint8Array {
  const d = new Uint8Array(SAVE_SIZE);
  d.set(encodeText('RED', 11), 0x2598);
  d.set(encodeText('BLUE', 11), 0x25f6);
  d[0x25ca] = 0xff; d[0x27e7] = 0xff; d[0x2f2d] = 0xff; d[0x30c1] = 0xff;
  for (const bank of [0x4000, 0x6000]) {
    for (let i = 0; i < 6; i++) d[bank + i * 0x462 + 1] = 0xff;
    d[bank + 0x1a4c] = checksum8(d, bank, bank + 0x1a4c);
    for (let i = 0; i < 6; i++) d[bank + 0x1a4d + i] = checksum8(d, bank + i * 0x462, bank + (i + 1) * 0x462);
  }
  d[0x3523] = checksum8(d, 0x2598, 0x3523);
  return d;
}

/** A save with a small party and a few boxed Pokémon, round-tripped so "before" is a fresh load. */
function fixture(): { before: Gen1Save; after: Gen1Save } {
  const s = new Gen1Save(blank());
  s.party = [newMon(DEX_TO_INTERNAL[25], 20), newMon(DEX_TO_INTERNAL[16], 12), newMon(DEX_TO_INTERNAL[19], 3)];
  s.boxes[0] = [newMon(DEX_TO_INTERNAL[129], 5), newMon(DEX_TO_INTERNAL[74], 8)];
  s.bag = [{ id: 0x14, count: 5 }];
  const raw = s.serialize();
  return { before: new Gen1Save(raw), after: new Gen1Save(raw) };
}

const diff = (f: { before: Gen1Save; after: Gen1Save }) => f.after.describeChanges(f.before);
const lines = (f: { before: Gen1Save; after: Gen1Save }, title: string) => diff(f).find((g) => g.title === title)?.lines ?? [];

test('an unedited save has nothing to review', () => {
  assert.deepEqual(diff(fixture()), []);
});

test('trainer, items, dex and options changes are described in words', () => {
  const f = fixture();
  f.after.trainerName = 'ASH';
  f.after.money = 999999;
  f.after.badges = 0b0000_0101;
  f.after.bag = [{ id: 0x14, count: 12 }, { id: 0x28, count: 99 }];
  f.after.setOwned(25, true);
  f.after.options.textSpeed = 1;
  f.after.options.battleAnimationsOff = true;
  const out = diff(f);
  assert.deepEqual(out.map((g) => g.title), ['Trainer', 'Bag', 'Pokédex', 'Options']);
  assert.deepEqual(lines(f, 'Trainer'), ['Name: RED → ASH', 'Money: ¥0 → ¥999,999', 'Badges earned: Boulder, Thunder']);
  assert.deepEqual(lines(f, 'Bag'), ['Potion: 5 → 12', 'Added Rare Candy ×99']);
  assert.deepEqual(lines(f, 'Pokédex'), ['Caught: 0 → 1', 'Seen: 0 → 1']);
  assert.deepEqual(lines(f, 'Options'), ['Text speed: Custom (0) → Fast', 'Battle animations: On → Off']);
});

test('Pokémon edits are one line each, with the before and after', () => {
  const f = fixture();
  const pikachu = f.after.party[0];
  pikachu.level = 50;
  pikachu.moves = [84, 98, 86, 0];
  f.after.party[1].nickname = 'BIRDY';
  assert.deepEqual(lines(f, 'Pokémon'), [
    'Pikachu (Party 1): level 20 → 50, moves Tackle → ThunderShock, Quick Attack, Thunder Wave',
    'Pidgey “BIRDY” (Party 2): nickname PIDGEY → BIRDY',
  ]);
});

test('moving, duplicating, adding and removing are told apart', () => {
  const f = fixture();
  const { after } = f;
  const [rattata] = after.party.splice(2, 1); // party -> box
  after.boxes[2].push(rattata);
  after.boxes[0].push(structuredClone(after.boxes[0][0])); // duplicate a boxed Magikarp
  after.boxes[0].splice(1, 1); // release the Geodude in box slot 2
  after.party.push(newMon(DEX_TO_INTERNAL[150], 70));
  const got = lines(f, 'Pokémon');
  assert.ok(got.includes('Rattata: Party 3 → Box 3, slot 1'), got.join('\n'));
  assert.ok(got.some((l) => l.startsWith('Added Magikarp Lv 5 to Box 1')), got.join('\n'));
  assert.ok(got.includes('Added Mewtwo Lv 70 to Party 3'), got.join('\n'));
  assert.ok(got.includes('Removed Geodude Lv 8 from Box 1, slot 2'), got.join('\n'));
  assert.ok(!got.some((l) => l.includes('Pikachu')), 'untouched Pokémon must not be listed');
});

test('reordering is reported once, not as a pile of moves', () => {
  const f = fixture();
  f.after.party.reverse();
  assert.deepEqual(lines(f, 'Pokémon'), ['Party order changed']);
});

test('long lists are cut off with a count of what was left out', () => {
  const f = fixture();
  f.after.bag = Array.from({ length: 20 }, (_, i) => ({ id: 0x28 + i, count: 3 }));
  const bag = diff(f).find((g) => g.title === 'Bag')!;
  assert.equal(bag.lines.length, 12);
  assert.ok(bag.more! > 0);
});

test('recalculating stats without changing anything does not invent changes', () => {
  const f = fixture();
  recalcPartyStats(f.after.party[0]); // same values as stored
  assert.deepEqual(diff(f), []);
});

test('changing only the species of a Pokémon reads as an edit, not a swap', () => {
  const f = fixture();
  f.after.party[1].species = DEX_TO_INTERNAL[17]; // Pidgey -> Pidgeotto
  assert.deepEqual(lines(f, 'Pokémon'), ['Pidgeotto “PIDGEY” (Party 2): species Pidgey → Pidgeotto']);
});

test('Yellow: friendship changes are listed, and losing the starter Pikachu is called out', () => {
  const raw = buildSampleSave();
  const f = { before: new Gen1Save(raw), after: new Gen1Save(raw) };
  assert.deepEqual(diff(f), []);

  f.after.pikachuFriendship = 255;
  assert.deepEqual(lines(f, 'Pikachu'), ['Friendship: 160 → 255']);

  f.after.trainerId = 54321; // the starter's OT ID no longer matches
  const got = lines(f, 'Pikachu');
  assert.equal(got.length, 2);
  assert.match(got[1], /starter Pikachu will stop following you/);

  f.after.makeStarter(f.after.party[0]); // fixed again
  assert.deepEqual(lines(f, 'Pikachu'), ['Friendship: 160 → 255']);
});

test('Yellow: a mood change is listed with the mood words and the numbers', () => {
  const raw = buildSampleSave();
  const f = { before: new Gen1Save(raw), after: new Gen1Save(raw) };
  f.after.pikachuMood = 255;
  assert.deepEqual(lines(f, 'Pikachu'), ['Mood: Neutral (128) → Cheerful (255)']);
  f.after.pikachuMood = 20;
  assert.deepEqual(lines(f, 'Pikachu'), ['Mood: Neutral (128) → Upset (20)']);
  f.after.pikachuMood = f.before.pikachuMood;
  assert.deepEqual(diff(f), []);
});

test('Red/Blue saves never get a Pikachu section', () => {
  const f = fixture();
  f.after.pikachuFriendship = 7;
  assert.deepEqual(diff(f), []);
});

test('changing the Trainer ID warns that earlier catches now count as traded', () => {
  const f = fixture();
  for (const m of f.before.party) m.otId = 111;
  for (const m of f.after.party) m.otId = 111;
  f.before.trainerId = 111; f.after.trainerId = 222;
  const got = lines(f, 'Trainer');
  assert.match(got[0], /^Trainer ID: 00111 → 00222$/);
  assert.match(got[1], /^Warning: 3 Pokémon were caught under your old Trainer ID.*count them as traded/);
  // nothing to warn about if no Pokémon carries the old ID
  const g = fixture();
  g.before.trainerId = 111; g.after.trainerId = 222;
  assert.equal(lines(g, 'Trainer').length, 1);
});
