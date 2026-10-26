// A made-up Pokémon Crystal save, built in code, for the "Try a Crystal sample" button, and the same trainer as a Gold
// save for scripts and tests. Nothing here comes from a real game: a trainer partway through Johto with four badges, a
// party that shows off what Gen 2 added (a held item, an egg, a shiny Gyarados, an Unown), a couple of boxes, every
// pocket of the bag and a partly filled Pokédex, so every tab of the editor has something to show. The Crystal one
// plays as the girl and records where each Pokémon was caught, as Crystal does.

import { MOVE_NAMES, UNOWN, baseStatsFor, expForLevel, growthOf, maxPp } from './data.ts';
import { LANDMARK_GIFT, encodeCaught, type CaughtTime } from './caught.ts';
import {
  BOX_COUNT, BOX_NAME_LEN, GEN2_LAYOUTS, Gen2Save, SAVE_SIZE, defaultNickname, newMon, recalcPartyStats, sum16, type Gen2Game, type Gen2Mon,
} from './save.ts';
import { encodeText } from './text.ts';

/** Where the new-game spot is kept in each layout (wCurMapData, wPlayerStruct, wPlayerObject, wStatusFlags). */
const SPOT = {
  gs: { lastSpawn: 0x2863, map: 0x2868, screenSave: 0x286c, playerStruct: 0x2065, playerObject: 0x22ad, statusFlags: 0x23d9 },
  crystal: { lastSpawn: 0x2840, map: 0x2843, screenSave: 0x2847, playerStruct: 0x2064, playerObject: 0x22ac, statusFlags: 0x23da },
} as const;

/**
 * A brand-new save that passes the game's checks: the default options, the two check bytes, empty pockets, party and
 * boxes, box names BOX1-BOX14, the new-game starting spot, and a backup copy that matches (what the game writes the
 * first time you save). Crystal also gets the player's gender.
 */
export function blankGen2Save(game: Gen2Game = 'gs', trainer = 'GOLD', rival = 'SILVER', hasPokedex = false, girl = false): Uint8Array {
  const L = GEN2_LAYOUTS[game];
  const at = SPOT[game];
  const d = new Uint8Array(SAVE_SIZE);
  d.set([0x03, 0x01, 0x00, 0x01, 0x40, 0x01, 0x00, 0x00], L.options); // DefaultOptions (the same in both), with "a save exists" set
  d[L.checkValue1] = 99;
  d.set(encodeText(trainer, 11, undefined, 0), L.playerName);
  d.set(encodeText('MOM', 11, undefined, 0), L.momName);
  d.set(encodeText(rival, 11, undefined, 0), L.rivalName);
  d.set(encodeText('RED', 11, undefined, 0), L.rivalName + 11);
  d.set(encodeText('GREEN', 11, undefined, 0), L.rivalName + 22);
  for (const list of [L.items, L.keyItems, L.balls, L.pcItems, L.party]) d[list + 1] = 0xff; // empty pockets, PC items and party
  for (let i = 0; i < BOX_COUNT; i++) d.set(encodeText(`BOX${i + 1}`, BOX_NAME_LEN, undefined, 0), L.boxNames + i * BOX_NAME_LEN);
  // Where Continue puts you: upstairs in your house in New Bark Town, where a new game starts (data/maps/spawn_points.asm,
  // SPAWN_HOME; the same map number in both games), with home as the place you return to after blacking out.
  d[at.map] = 24; d[at.map + 1] = 7; // wMapGroup, wMapNumber: PLAYERS_HOUSE_2F
  d[at.map + 2] = 3; d[at.map + 3] = 3; // wYCoord, wXCoord
  d[at.lastSpawn] = 24; d[at.lastSpawn + 1] = 7; // wLastSpawnMapGroup, wLastSpawnMapNumber
  // wScreenSave: the 6x5 map blocks on screen around you, which Continue draws the room from. These are the room's
  // blocks (maps/PlayersHouse2F.blk, the same in both games) for that spot, with the map's border block (0) around them.
  d.set([
    0, 0, 0, 0, 0, 0,
    0, 4, 1, 3, 2, 0,
    0, 5, 6, 5, 5, 0,
    0, 5, 5, 7, 5, 0,
    0, 0, 0, 0, 0, 0,
  ], at.screenSave);
  // You, standing there (wPlayerStruct and wPlayerObject; Continue draws you from these). Sprite 1 is the player (Crystal
  // swaps in the girl's sprite itself), movement 0x0B is SPRITEMOVEDATA_PLAYER, and the game counts map coordinates
  // from 4 blocks outside the map, so 3,3 is 7,7.
  const player = new Uint8Array(40);
  player.set([0x01, 0x00, 0x00, 0x0b, 0x02, 0x00, 0x00, 0xff, 0x00, 0x01, 0x00, 0x00, 0x00, 0xff]);
  player.set([7, 7, 7, 7, 7, 7, 0x00, 0x40, 0x40], 16); // map X/Y, last X/Y, start X/Y, radius, sprite X/Y on screen
  d.set(player, at.playerStruct);
  d.set([0, 1, 7, 7, 0x0b, 0xff, 0xff, 0xff, 0, 0, 0, 0, 0xff, 0xff, 0, 0], at.playerObject);
  if (hasPokedex) d[at.statusFlags] |= 1; // wStatusFlags bit 0: Professor Oak has given you the Pokédex
  d[L.currentBox + 1] = 0xff; // the open box
  for (let i = 0; i < BOX_COUNT; i++) d[Gen2Save.boxOffset(i) + 1] = 0xff;
  if (L.playerGender !== undefined) d[L.playerGender] = girl ? 1 : 0;
  d[L.checkValue2] = 127;
  const sum = sum16(d, L.gameData, L.gameDataEnd);
  d[L.checksum] = sum & 0xff; d[L.checksum + 1] = sum >> 8;
  // The backup copy, so the file is exactly what the game would have written.
  for (const [from, to, copy] of L.backup) d.set(d.subarray(from, to), copy);
  d[L.backupChecksum] = sum & 0xff; d[L.backupChecksum + 1] = sum >> 8; d[L.backupCheckValue2] = 127;
  return d;
}

const move = (name: string): number => {
  const id = MOVE_NAMES.indexOf(name);
  if (id < 1) throw new Error(`sample: unknown move ${name}`);
  return id;
};

const TRAINER_ID = 24680;

interface Spec {
  dex: number; level: number; moves: string[]; nickname?: string; item?: number; egg?: boolean; shiny?: boolean; friendship?: number;
  /** Crystal's caught data: landmark id (constants/landmark_constants.asm), level, time of day. */
  met?: [place: number, level: number, time: CaughtTime];
}

function make(spec: Spec, seed: number, ot: string, girl: boolean | null): Gen2Mon {
  const mon = newMon(spec.dex, spec.level);
  mon.moves = [0, 0, 0, 0];
  spec.moves.slice(0, 4).forEach((m, i) => { mon.moves[i] = move(m); });
  mon.pp = mon.moves.map((m) => maxPp(m, 0)) as Gen2Mon['pp'];
  mon.exp = expForLevel(growthOf(spec.dex), spec.level);
  mon.otName = ot;
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
  // Crystal (girl is null for Gold) writes down where it was caught; an egg gets that when it hatches.
  if (girl !== null && spec.met) mon.caught = encodeCaught({ location: spec.met[0], level: spec.met[1], time: spec.met[2], otGender: girl ? 'girl' : 'boy' });
  recalcPartyStats(mon, true);
  return mon;
}

const PARTY: Spec[] = [
  { dex: 156, level: 27, moves: ['Ember', 'SmokeScreen', 'Quick Attack', 'Flame Wheel'], nickname: 'BLAZE', item: 0x8a, friendship: 182, met: [0x01, 5, 'morning'] }, // Quilava, Charcoal, from Elm's lab
  { dex: 130, level: 30, moves: ['Bite', 'Dragon Rage', 'Leer', 'Thrash'], shiny: true, met: [0x26, 30, 'night'] }, // the red Gyarados, Lake of Rage
  { dex: 181, level: 25, moves: ['ThunderShock', 'Thunder Wave', 'Cotton Spore', 'Tackle'], item: 0x92, met: [0x08, 6, 'day'] }, // Ampharos, Leftovers, caught as a Mareep on Route 32
  { dex: 207, level: 24, moves: ['Poison Sting', 'Sand-Attack', 'Harden', 'Quick Attack'] }, // Gligar: nothing recorded, like one traded from Gold
  { dex: UNOWN, level: 14, moves: ['Hidden Power'], met: [0x09, 14, 'day'] }, // Ruins of Alph
  { dex: 175, level: 5, moves: ['Growl', 'Charm'], egg: true }, // Togepi, still an egg
];

const BOX_1: Spec[] = [
  { dex: 161, level: 6, moves: ['Scratch', 'Defense Curl'], met: [0x02, 6, 'morning'] },
  { dex: 163, level: 7, moves: ['Tackle', 'Growl', 'Foresight'], met: [0x02, 7, 'night'] },
  { dex: 187, level: 8, moves: ['Splash', 'Synthesis', 'Tail Whip'], met: [0x04, 8, 'day'] },
  { dex: 179, level: 9, moves: ['Tackle', 'Growl'], met: [0x08, 9, 'morning'] },
  { dex: 194, level: 10, moves: ['Water Gun', 'Tail Whip'], met: [0x08, 10, 'night'] },
];

const BOX_2: Spec[] = [
  { dex: 147, level: 15, moves: ['Wrap', 'Leer', 'Thunder Wave', 'Twister'], met: [LANDMARK_GIFT, 0, null] }, // a Game Corner prize
  { dex: 133, level: 20, moves: ['Tackle', 'Sand-Attack', 'Quick Attack', 'Bite'], item: 0x70, met: [LANDMARK_GIFT, 0, null] }, // Bill's Eevee, with an Everstone
];

/** The sample save's bytes: a valid file that opens in the editor and in the real game. */
export function buildSampleSave(game: Gen2Game = 'crystal'): Uint8Array {
  const crystal = game === 'crystal';
  const trainer = crystal ? 'KRIS' : 'GOLD';
  const save = new Gen2Save(blankGen2Save(game, trainer, 'SILVER', true, crystal), game);
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
  if (crystal) save.keyItems.push(0x74); // Blue Card, for Buena's radio show (Crystal only)
  save.tmhm[11] = 1; // TM12 Sweet Scent
  save.tmhm[30] = 1; // TM31 Mud-Slap
  save.tmhm[49] = 1; // TM50 Nightmare
  save.tmhm[50] = 1; // HM01 Cut
  save.tmhm[51] = 1; // HM02 Fly
  save.tmhm[54] = 1; // HM05 Flash
  save.pcItems = [{ id: 0x12, count: 1 }];

  const girl = crystal ? true : null;
  save.party = PARTY.map((s, i) => make(s, i + 1, trainer, girl));
  save.boxes[0] = BOX_1.map((s, i) => make(s, i + 20, trainer, girl));
  save.boxes[1] = BOX_2.map((s, i) => make(s, i + 40, trainer, girl));
  save.boxNames[0] = 'JOHTO';

  // Everything hatched in the party and boxes is caught; the Johto dex from Chikorita to Togepi is at least seen.
  for (const m of [...save.party, ...save.boxes.flat()]) if (!m.isEgg) save.setOwned(m.species, true);
  for (let dex = 152; dex <= 175; dex++) save.setSeen(dex, true);
  return save.serialize();
}
