// A made-up Ruby or Emerald save, built in code, for the browser checks and tests (nothing here comes from a real game):
// a trainer halfway through Hoenn with four badges, a party that shows off what Gen 3 has (natures, abilities, a held
// item, a shiny, an egg, Unown's "!"), a box with a gap in it, every pocket of the bag and a partly filled Pokédex.
// Built the way the game writes a first save: the game picks the slot by save counter % 2 and rotates the sectors by
// the counter, so the first save (counter 1) is the second slot with sector 0 one place in. The rest stays blank.

import { MOVE_NAMES, UNOWN, findPid, maxPp, speciesName, type Gen3Game } from './data.ts';
import {
  BOX_COUNT, GEN3_LAYOUTS, Gen3Save, SAVE_SIZE, depositInBox, newMon, recalcPartyStats, sectorChecksum, type Gen3Mon,
} from './save.ts';
import { encodeText } from './text.ts';

const SECTOR_DATA = 3968;

/** A tiny fixed random number generator, so the sample comes out the same every time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1103515245) + 24691) >>> 0; return s / 0x100000000; };
}

/**
 * A brand-new save the game loads: the player standing outside their house in Littleroot Town, default options, an
 * empty party, bag and boxes (named BOX1-BOX14), and Emerald's money key.
 */
export function blankGen3Save(game: Gen3Game = 'rs', trainer = 'MAY', female = true, trainerId = 0x1d2a3b4c): Uint8Array {
  const L = GEN3_LAYOUTS[game];
  const sb2 = new Uint8Array(SECTOR_DATA);
  const sb1 = new Uint8Array(SECTOR_DATA * 4);
  const st = new Uint8Array(SECTOR_DATA * 9);
  sb2.set(encodeText(trainer, 8, undefined, 7), 0);
  sb2[8] = female ? 1 : 0;
  sb2.set([trainerId & 0xff, (trainerId >>> 8) & 0xff, (trainerId >>> 16) & 0xff, trainerId >>> 24], 0x0a);
  sb2[0x09] = 1; // Continue warps in (to the continue-game warp below), so the map and the player get set up fresh
  sb2[0x14] = 1; // text speed Mid, frame 1, mono
  if (game === 'emerald') sb2.set([0x4d, 0x3c, 0x2b, 0x1a], 0xac); // the money key
  // Littleroot Town (map group 0, number 9 in both games), just below the door of the player's house, which is also
  // where Continue and blacking out put you.
  const warp = [0, 9, 0xff, 0, 5, 0, 9, 0];
  sb1.set([5, 0, 9, 0], 0x00); // pos
  sb1.set(warp, 0x04); // location
  sb1.set(warp, 0x0c); // continue-game warp
  sb1.set(warp, 0x1c); // last heal location
  const key = game === 'emerald' ? 0x1a2b3c4d : 0;
  const k16 = key & 0xffff;
  // Empty pockets still hold quantity 0 under the key.
  for (const [at, n] of [[L.items, L.itemsMax], [L.keyItems, L.keyItemsMax], [L.balls, L.ballsMax], [L.tmhm, L.tmhmMax], [L.berries, L.berriesMax]]) {
    for (let i = 0; i < n; i++) { sb1[at + i * 4 + 2] = k16 & 0xff; sb1[at + i * 4 + 3] = k16 >> 8; }
  }
  for (let i = 0; i < 4; i++) sb1[0x490 + i] = (key >>> (i * 8)) & 0xff; // ¥0 under the key
  for (let i = 0; i < 2; i++) sb1[0x494 + i] = (k16 >>> (i * 8)) & 0xff; // no coins
  if (game === 'emerald') {
    // Emerald also keys its Berry Powder and its 64 game stats (pokeemerald: ApplyNewEncryptionKeyToAllEncryptedData).
    for (let i = 0; i < 4; i++) sb2[0x1f4 + i] = (key >>> (i * 8)) & 0xff;
    for (let n = 0; n < 64; n++) for (let i = 0; i < 4; i++) sb1[0x159c + n * 4 + i] = (key >>> (i * 8)) & 0xff;
    // A roaming Latios (struct Roamer), as the game makes one after the Hall of Fame: level 40, full HP, roaming.
    const roamer = new DataView(sb1.buffer, sb1.byteOffset + 0x31dc, 0x1c);
    roamer.setUint32(0, 20 | (12 << 5) | (25 << 10) | (9 << 15) | (31 << 20) | (17 << 25), true); // IVs
    roamer.setUint32(4, 0x5eed1234, true); // personality
    roamer.setUint16(8, 408, true); // SPECIES_LATIOS
    roamer.setUint16(10, 122, true); // max HP at level 40 with an HP IV of 20
    roamer.setUint8(12, 40);
    roamer.setUint8(19, 1); // active
  }
  const sys = L.badgeFlag - 7; // SYSTEM_FLAGS: 0x800 in Ruby/Sapphire, 0x860 in Emerald
  for (const n of [sys, sys + 1]) sb1[L.flags + (n >> 3)] |= 1 << (n & 7); // FLAG_SYS_POKEMON_GET and _POKEDEX_GET: the start menu has POKéMON and POKéDEX
  for (let i = 0; i < BOX_COUNT; i++) {
    st.set(encodeText(`BOX${i + 1}`, 9, undefined, 8), 0x8344 + i * 9);
    st[0x83c2 + i] = i % 4; // the game's starting wallpapers
  }
  const d = new Uint8Array(SAVE_SIZE).fill(0xff);
  const sectors = [sb2, ...Array.from({ length: 4 }, (_, i) => sb1.subarray(i * SECTOR_DATA, (i + 1) * SECTOR_DATA)),
    ...Array.from({ length: 9 }, (_, i) => st.subarray(i * SECTOR_DATA, (i + 1) * SECTOR_DATA))];
  const sizes = [L.sb2Size, SECTOR_DATA, SECTOR_DATA, SECTOR_DATA, L.sb1Size - 3 * SECTOR_DATA, ...new Array(8).fill(SECTOR_DATA), 0x83d0 - 8 * SECTOR_DATA];
  sectors.forEach((data, id) => {
    const at = (14 + (id + 1) % 14) * 0x1000;
    d.fill(0, at, at + 0x1000);
    d.set(data.subarray(0, sizes[id]), at);
    const footer = new DataView(d.buffer, at + 0xff4, 12);
    footer.setUint16(0, id, true);
    footer.setUint16(2, sectorChecksum(d, at, sizes[id]), true);
    footer.setUint32(4, 0x08012025, true);
    footer.setUint32(8, 1, true); // the first save
  });
  return d;
}

const move = (name: string): number => {
  const id = MOVE_NAMES.indexOf(name);
  if (id < 1) throw new Error(`sample: unknown move ${name}`);
  return id;
};

/** The sample: blank save, then filled in through the editor's own model (so its writer is what makes the file). */
export function buildSampleSave(game: Gen3Game = 'rs'): Uint8Array {
  const trainerId = 0x1d2a3b4c;
  const s = new Gen3Save(blankGen3Save(game, 'MAY', true, trainerId), game);
  const random = seeded(386);
  const trainer = { name: 'MAY', id: trainerId, gender: 'female' as const };
  const mon = (dex: number, level: number, moves: string[], wish: Parameters<typeof findPid>[3] = {}): Gen3Mon => {
    const pid = findPid(dex, trainerId, Math.floor(random() * 0x100000000), wish, random);
    const m = newMon(dex, level, trainer, game, pid, speciesName(dex));
    m.moves = [0, 1, 2, 3].map((i) => (moves[i] ? move(moves[i]) : 0)) as Gen3Mon['moves'];
    m.pp = m.moves.map((id) => maxPp(id, 0)) as Gen3Mon['pp'];
    m.ivs = { hp: Math.floor(random() * 32), atk: Math.floor(random() * 32), def: Math.floor(random() * 32), spe: Math.floor(random() * 32), spa: Math.floor(random() * 32), spd: Math.floor(random() * 32) };
    m.metLocation = 0x10 + Math.floor(random() * 20);
    recalcPartyStats(m, true);
    return m;
  };

  s.money = 12345;
  s.coins = 50;
  s.playHours = 21; s.playMinutes = 9; s.playSeconds = 30;
  s.badges = 0b1111;

  const blaziken = mon(257, 36, ['Blaze Kick', 'Sky Uppercut', 'Slash', 'Bulk Up'], { nature: 3 }); // Adamant
  blaziken.item = 215; // Charcoal
  blaziken.nickname = 'BLAZE';
  blaziken.metLocation = 0; blaziken.metLevel = 5; // the starter, from Littleroot Town
  const gardevoir = mon(282, 32, ['Psychic', 'Calm Mind', 'Double Team', 'Thunderbolt'], { nature: 15, shiny: true }); // Modest
  const swellow = mon(277, 30, ['Aerial Ace', 'Quick Attack', 'Endeavor', 'Double Team'], { gender: 'female' });
  swellow.abilityBit = 0;
  const egg = mon(360, 5, ['Splash', 'Charm', 'Encore'], {}); // Wynaut
  egg.isEgg = true; egg.nickname = 'EGG'; egg.friendship = 20; egg.metLevel = 0;
  const unown = mon(UNOWN, 25, ['Hidden Power'], { unown: '!' });
  unown.metLocation = 0x52; // Desert Ruins
  const azumarill = mon(184, 28, ['Surf', 'Rollout', 'Defense Curl'], {});
  azumarill.abilityBit = 1; // Huge Power
  s.party = [blaziken, gardevoir, swellow, egg, unown];

  const box = (dex: number, level: number, moves: string[]) => { const m = mon(dex, level, moves); depositInBox(m); return m; };
  s.boxes[0][0] = box(263, 6, ['Tackle', 'Growl']);
  s.boxes[0][1] = box(270, 9, ['Astonish', 'Growl']);
  s.boxes[0][3] = azumarill; // a gap at spot 3, as the game allows
  depositInBox(azumarill);
  s.boxes[0][4] = box(304, 18, ['Tackle', 'Harden', 'Mud-Slap']);
  s.boxes[1][0] = box(25, 15, ['ThunderShock', 'Quick Attack']);
  s.currentBoxIndex = 0;
  s.boxNames[1] = 'FRIENDS';

  s.pockets.item = [{ id: 13, count: 5 }, { id: 22, count: 3 }, { id: 68, count: 2 }, { id: 86, count: 1 }];
  s.pockets.ball = [{ id: 4, count: 10 }, { id: 3, count: 4 }];
  s.pockets.key = [{ id: 259, count: 1 }, { id: 262, count: 1 }, { id: 268, count: 1 }, { id: 273, count: 1 }];
  s.setTmCounts([...new Array(39).fill(0), 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0]);
  s.pockets.berry = [{ id: 139, count: 12 }, { id: 142, count: 3 }];
  s.pcItems = [{ id: 13, count: 1 }];
  s.pokeblocks = [
    { color: 1, spicy: 21, dry: 0, sweet: 0, bitter: 0, sour: 0, feel: 23 },
    { color: 5, spicy: 0, dry: 0, sweet: 0, bitter: 0, sour: 18, feel: 20 },
  ];
  for (let dex = 252; dex <= 300; dex++) s.setSeen(dex, true);
  for (const dex of [257, 282, 277, 263, 270, 304, 25, 184, 201, 360, 255, 256, 280, 281, 276]) s.setOwned(dex, true);
  return s.serialize();
}
