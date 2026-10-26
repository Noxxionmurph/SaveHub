// A made-up Pokémon Gold save, built in code, for the "Try a sample save" button and for scripts/tests.
// Nothing here comes from a real game: a trainer partway through Johto with four badges, a party that shows off what
// Gen 2 added (a held item, an egg, a shiny Gyarados, an Unown), a couple of boxes, every pocket of the bag and a
// partly filled Pokédex, so every tab of the editor has something to show.

import { MOVE_NAMES, UNOWN, baseStatsFor, expForLevel, growthOf, maxPp } from './data.ts';
import { BOX_COUNT, BOX_NAME_LEN, Gen2Save, SAVE_SIZE, defaultNickname, newMon, recalcPartyStats, sum16, type Gen2Mon } from './save.ts';
import { encodeText } from './text.ts';

/**
 * A brand-new save that passes the game's checks: the default options, the two check bytes, empty pockets, party and
 * boxes, box names BOX1-BOX14, the new-game starting spot, and a backup copy that matches (what the game writes the first time you save).
 */
export function blankGen2Save(trainer = 'GOLD', rival = 'SILVER', hasPokedex = false): Uint8Array {
  const d = new Uint8Array(SAVE_SIZE);
  d.set([0x03, 0x01, 0x00, 0x01, 0x40, 0x01, 0x00, 0x00], 0x2000); // pokegold: DefaultOptions, with "a save exists" set
  d[0x2008] = 99;
  d.set(encodeText(trainer, 11, undefined, 0), 0x200b);
  d.set(encodeText('MOM', 11, undefined, 0), 0x2016);
  d.set(encodeText(rival, 11, undefined, 0), 0x2021);
  d.set(encodeText('RED', 11, undefined, 0), 0x202c);
  d.set(encodeText('GREEN', 11, undefined, 0), 0x2037);
  for (const at of [0x2420, 0x244a, 0x2465, 0x247f, 0x288b]) d[at] = 0xff; // empty pockets, PC items and party
  for (let i = 0; i < BOX_COUNT; i++) d.set(encodeText(`BOX${i + 1}`, BOX_NAME_LEN, undefined, 0), 0x2727 + i * BOX_NAME_LEN);
  // Where Continue puts you: upstairs in your house in New Bark Town, where a new game starts (pokegold:
  // data/maps/spawn_points.asm, SPAWN_HOME), with home as the place you return to after blacking out.
  d[0x2856 + 0x12] = 24; d[0x2856 + 0x13] = 7; // wMapGroup, wMapNumber: PLAYERS_HOUSE_2F
  d[0x2856 + 0x14] = 3; d[0x2856 + 0x15] = 3; // wYCoord, wXCoord
  d[0x2856 + 0x0d] = 24; d[0x2856 + 0x0e] = 7; // wLastSpawnMapGroup, wLastSpawnMapNumber
  // wScreenSave: the 6x5 map blocks on screen around you, which Continue draws the room from. These are the room's
  // blocks (maps/PlayersHouse2F.blk) for that spot, with the map's border block (0) around them.
  d.set([
    0, 0, 0, 0, 0, 0,
    0, 4, 1, 3, 2, 0,
    0, 5, 6, 5, 5, 0,
    0, 5, 5, 7, 5, 0,
    0, 0, 0, 0, 0, 0,
  ], 0x2856 + 0x16);
  // You, standing there (wPlayerStruct and wPlayerObject; Continue draws you from these). Sprite 1 is Gold, movement
  // 0x0B is SPRITEMOVEDATA_PLAYER, and the game counts map coordinates from 4 blocks outside the map, so 3,3 is 7,7.
  const player = new Uint8Array(40);
  player.set([0x01, 0x00, 0x00, 0x0b, 0x02, 0x00, 0x00, 0xff, 0x00, 0x01, 0x00, 0x00, 0x00, 0xff]);
  player.set([7, 7, 7, 7, 7, 7, 0x00, 0x40, 0x40], 16); // map X/Y, last X/Y, start X/Y, radius, sprite X/Y on screen
  d.set(player, 0x2065);
  d.set([0, 1, 7, 7, 0x0b, 0xff, 0xff, 0xff, 0, 0, 0, 0, 0xff, 0xff, 0, 0], 0x22ad);
  if (hasPokedex) d[0x23d9] |= 1; // wStatusFlags bit 0: Professor Oak has given you the Pokédex
  d[0x2d6d] = 0xff; // the open box
  for (let i = 0; i < BOX_COUNT; i++) d[Gen2Save.boxOffset(i) + 1] = 0xff;
  d[0x2d6b] = 127;
  const sum = sum16(d, 0x2009, 0x2d69);
  d[0x2d69] = sum & 0xff; d[0x2d6a] = sum >> 8;
  // The backup copy (see BACKUP in save.ts), so the file is exactly what the game would have written.
  for (const [from, to, at] of [[0x2000, 0x2009, 0x7e30], [0x2009, 0x222f, 0x15c7], [0x222f, 0x23d9, 0x3d96], [0x23d9, 0x2856, 0x0c6b], [0x2856, 0x288a, 0x7e39], [0x288a, 0x2d69, 0x10e8]]) {
    d.set(d.subarray(from, to), at);
  }
  d[0x7e6d] = sum & 0xff; d[0x7e6e] = sum >> 8; d[0x7e6f] = 127;
  return d;
}

const move = (name: string): number => {
  const id = MOVE_NAMES.indexOf(name);
  if (id < 1) throw new Error(`sample: unknown move ${name}`);
  return id;
};

const TRAINER_ID = 24680;

interface Spec { dex: number; level: number; moves: string[]; nickname?: string; item?: number; egg?: boolean; shiny?: boolean; friendship?: number }

function make(spec: Spec, seed: number): Gen2Mon {
  const mon = newMon(spec.dex, spec.level);
  mon.moves = [0, 0, 0, 0];
  spec.moves.slice(0, 4).forEach((m, i) => { mon.moves[i] = move(m); });
  mon.pp = mon.moves.map((m) => maxPp(m, 0)) as Gen2Mon['pp'];
  mon.exp = expForLevel(growthOf(spec.dex), spec.level);
  mon.otName = 'GOLD';
  mon.otId = TRAINER_ID;
  mon.item = spec.item ?? 0;
  mon.friendship = spec.friendship ?? 70;
  if (spec.nickname) mon.nickname = spec.nickname;
  // A spread of DVs that doesn't look uniform, but is the same every time.
  const r = (n: number) => ((seed * 2654435761 + n * 40503) >>> 7) & 0xf;
  mon.dvs = spec.shiny ? { atk: 14, def: 10, spe: 10, spc: 10 } : { atk: r(1), def: r(2), spe: r(3), spc: r(4) };
  if (spec.egg) {
    // An egg is listed as EGG, named EGG, and counts down its hatching in the friendship byte.
    mon.isEgg = true;
    mon.nickname = defaultNickname(spec.dex, true);
    mon.friendship = baseStatsFor(spec.dex)?.eggCycles ?? 20;
  }
  recalcPartyStats(mon, true);
  return mon;
}

const PARTY: Spec[] = [
  { dex: 156, level: 27, moves: ['Ember', 'SmokeScreen', 'Quick Attack', 'Flame Wheel'], nickname: 'BLAZE', item: 0x8a, friendship: 182 }, // Quilava, Charcoal
  { dex: 130, level: 30, moves: ['Bite', 'Dragon Rage', 'Leer', 'Thrash'], shiny: true }, // the red Gyarados
  { dex: 181, level: 25, moves: ['ThunderShock', 'Thunder Wave', 'Cotton Spore', 'Tackle'], item: 0x92 }, // Ampharos, Leftovers
  { dex: 207, level: 24, moves: ['Poison Sting', 'Sand-Attack', 'Harden', 'Quick Attack'] },
  { dex: UNOWN, level: 14, moves: ['Hidden Power'] },
  { dex: 175, level: 5, moves: ['Growl', 'Charm'], egg: true }, // Togepi, still an egg
];

const BOX_1: Spec[] = [
  { dex: 161, level: 6, moves: ['Scratch', 'Defense Curl'] },
  { dex: 163, level: 7, moves: ['Tackle', 'Growl', 'Foresight'] },
  { dex: 187, level: 8, moves: ['Splash', 'Synthesis', 'Tail Whip'] },
  { dex: 179, level: 9, moves: ['Tackle', 'Growl'] },
  { dex: 194, level: 10, moves: ['Water Gun', 'Tail Whip'] },
];

const BOX_2: Spec[] = [
  { dex: 147, level: 15, moves: ['Wrap', 'Leer', 'Thunder Wave', 'Twister'] },
  { dex: 133, level: 20, moves: ['Tackle', 'Sand-Attack', 'Quick Attack', 'Bite'], item: 0x70 }, // Everstone
];

/** The sample save's bytes: a valid file that opens in the editor and in the real game. */
export function buildSampleSave(): Uint8Array {
  const save = new Gen2Save(blankGen2Save('GOLD', 'SILVER', true));
  save.trainerId = TRAINER_ID;
  save.money = 24680;
  save.momsMoney = 3500;
  save.coins = 420;
  save.johtoBadges = 0b0000_1111; // Zephyr, Hive, Plain, Fog
  save.playHours = 18; save.playMinutes = 42; save.playSeconds = 7;
  save.options = { ...save.options, textSpeed: 3, battleSceneOff: false, battleStyleSet: false, stereo: false };

  save.items = [
    { id: 0x12, count: 6 }, // Potion
    { id: 0x11, count: 3 }, // Super Potion
    { id: 0x09, count: 2 }, // Antidote
    { id: 0x13, count: 1 }, // Escape Rope
    { id: 0x14, count: 4 }, // Repel
    { id: 0x48, count: 2 }, // MooMoo Milk
    { id: 0xad, count: 5 }, // Berry
  ];
  save.balls = [{ id: 0x05, count: 12 }, { id: 0x04, count: 4 }, { id: 0xa4, count: 1 }]; // Poké, Great, Friend Ball
  save.keyItems = [0x07, 0x3a, 0x3b, 0x36, 0xaf]; // Bicycle, Old Rod, Good Rod, Coin Case, SquirtBottle
  save.tmhm[11] = 1; // TM12 Sweet Scent
  save.tmhm[30] = 1; // TM31 Mud-Slap
  save.tmhm[49] = 1; // TM50 Nightmare
  save.tmhm[50] = 1; // HM01 Cut
  save.tmhm[51] = 1; // HM02 Fly
  save.tmhm[54] = 1; // HM05 Flash
  save.pcItems = [{ id: 0x12, count: 1 }];

  save.party = PARTY.map((s, i) => make(s, i + 1));
  save.boxes[0] = BOX_1.map((s, i) => make(s, i + 20));
  save.boxes[1] = BOX_2.map((s, i) => make(s, i + 40));
  save.boxNames[0] = 'JOHTO';

  // Everything hatched in the party and boxes is caught; the Johto dex from Chikorita to Togepi is at least seen.
  for (const m of [...save.party, ...save.boxes.flat()]) if (!m.isEgg) save.setOwned(m.species, true);
  for (let dex = 152; dex <= 175; dex++) save.setSeen(dex, true);
  return save.serialize();
}
