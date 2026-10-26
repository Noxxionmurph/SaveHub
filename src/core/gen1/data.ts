// Gen 1 static data: species, base stats, types, moves, items.
// Species are listed in National Dex order; the save stores *internal* indices,
// which are mapped to dex numbers via INTERNAL_INDEX below.

export const DEX_NAMES: string[] = [
  'Bulbasaur', 'Ivysaur', 'Venusaur', 'Charmander', 'Charmeleon', 'Charizard', 'Squirtle', 'Wartortle', 'Blastoise',
  'Caterpie', 'Metapod', 'Butterfree', 'Weedle', 'Kakuna', 'Beedrill', 'Pidgey', 'Pidgeotto', 'Pidgeot', 'Rattata',
  'Raticate', 'Spearow', 'Fearow', 'Ekans', 'Arbok', 'Pikachu', 'Raichu', 'Sandshrew', 'Sandslash', 'Nidoran♀',
  'Nidorina', 'Nidoqueen', 'Nidoran♂', 'Nidorino', 'Nidoking', 'Clefairy', 'Clefable', 'Vulpix', 'Ninetales',
  'Jigglypuff', 'Wigglytuff', 'Zubat', 'Golbat', 'Oddish', 'Gloom', 'Vileplume', 'Paras', 'Parasect', 'Venonat',
  'Venomoth', 'Diglett', 'Dugtrio', 'Meowth', 'Persian', 'Psyduck', 'Golduck', 'Mankey', 'Primeape', 'Growlithe',
  'Arcanine', 'Poliwag', 'Poliwhirl', 'Poliwrath', 'Abra', 'Kadabra', 'Alakazam', 'Machop', 'Machoke', 'Machamp',
  'Bellsprout', 'Weepinbell', 'Victreebel', 'Tentacool', 'Tentacruel', 'Geodude', 'Graveler', 'Golem', 'Ponyta',
  'Rapidash', 'Slowpoke', 'Slowbro', 'Magnemite', 'Magneton', "Farfetch'd", 'Doduo', 'Dodrio', 'Seel', 'Dewgong',
  'Grimer', 'Muk', 'Shellder', 'Cloyster', 'Gastly', 'Haunter', 'Gengar', 'Onix', 'Drowzee', 'Hypno', 'Krabby',
  'Kingler', 'Voltorb', 'Electrode', 'Exeggcute', 'Exeggutor', 'Cubone', 'Marowak', 'Hitmonlee', 'Hitmonchan',
  'Lickitung', 'Koffing', 'Weezing', 'Rhyhorn', 'Rhydon', 'Chansey', 'Tangela', 'Kangaskhan', 'Horsea', 'Seadra',
  'Goldeen', 'Seaking', 'Staryu', 'Starmie', 'Mr. Mime', 'Scyther', 'Jynx', 'Electabuzz', 'Magmar', 'Pinsir',
  'Tauros', 'Magikarp', 'Gyarados', 'Lapras', 'Ditto', 'Eevee', 'Vaporeon', 'Jolteon', 'Flareon', 'Porygon',
  'Omanyte', 'Omastar', 'Kabuto', 'Kabutops', 'Aerodactyl', 'Snorlax', 'Articuno', 'Zapdos', 'Moltres', 'Dratini',
  'Dragonair', 'Dragonite', 'Mewtwo', 'Mew',
];

// hp,atk,def,spe,spc,type1[,type2] — one line per dex entry, National Dex order.
const BASE_TABLE = `
45,49,49,45,65,Grass,Poison
60,62,63,60,80,Grass,Poison
80,82,83,80,100,Grass,Poison
39,52,43,65,50,Fire
58,64,58,80,65,Fire
78,84,78,100,85,Fire,Flying
44,48,65,43,50,Water
59,63,80,58,65,Water
79,83,100,78,85,Water
45,30,35,45,20,Bug
50,20,55,30,25,Bug
60,45,50,70,80,Bug,Flying
40,35,30,50,20,Bug,Poison
45,25,50,35,25,Bug,Poison
65,80,40,75,45,Bug,Poison
40,45,40,56,35,Normal,Flying
63,60,55,71,50,Normal,Flying
83,80,75,91,70,Normal,Flying
30,56,35,72,25,Normal
55,81,60,97,50,Normal
40,60,30,70,31,Normal,Flying
65,90,65,100,61,Normal,Flying
35,60,44,55,40,Poison
60,85,69,80,65,Poison
35,55,30,90,50,Electric
60,90,55,100,90,Electric
50,75,85,40,30,Ground
75,100,110,65,55,Ground
55,47,52,41,40,Poison
70,62,67,56,55,Poison
90,82,87,76,75,Poison,Ground
46,57,40,50,40,Poison
61,72,57,65,55,Poison
81,92,77,85,75,Poison,Ground
70,45,48,35,60,Normal
95,70,73,60,85,Normal
38,41,40,65,65,Fire
73,76,75,100,100,Fire
115,45,20,20,25,Normal
140,70,45,45,50,Normal
40,45,35,55,40,Poison,Flying
75,80,70,90,75,Poison,Flying
45,50,55,30,75,Grass,Poison
60,65,70,40,85,Grass,Poison
75,80,85,50,100,Grass,Poison
35,70,55,25,55,Bug,Grass
60,95,80,30,80,Bug,Grass
60,55,50,45,40,Bug,Poison
70,65,60,90,90,Bug,Poison
10,55,25,95,45,Ground
35,80,50,120,70,Ground
40,45,35,90,40,Normal
65,70,60,115,65,Normal
50,52,48,55,50,Water
80,82,78,85,80,Water
40,80,35,70,35,Fighting
65,105,60,95,60,Fighting
55,70,45,60,50,Fire
90,110,80,95,80,Fire
40,50,40,90,40,Water
65,65,65,90,50,Water
90,85,95,70,70,Water,Fighting
25,20,15,90,105,Psychic
40,35,30,105,120,Psychic
55,50,45,120,135,Psychic
70,80,50,35,35,Fighting
80,100,70,45,50,Fighting
90,130,80,55,65,Fighting
50,75,35,40,70,Grass,Poison
65,90,50,55,85,Grass,Poison
80,105,65,70,100,Grass,Poison
40,40,35,70,100,Water,Poison
80,70,65,100,120,Water,Poison
40,80,100,20,30,Rock,Ground
55,95,115,35,45,Rock,Ground
80,110,130,45,55,Rock,Ground
50,85,55,90,65,Fire
65,100,70,105,80,Fire
90,65,65,15,40,Water,Psychic
95,75,110,30,80,Water,Psychic
25,35,70,45,95,Electric
50,60,95,70,120,Electric
52,65,55,60,58,Normal,Flying
35,85,45,75,35,Normal,Flying
60,110,70,100,60,Normal,Flying
65,45,55,45,70,Water
90,70,80,70,95,Water,Ice
80,80,50,25,40,Poison
105,105,75,50,65,Poison
30,65,100,40,45,Water
50,95,180,70,85,Water,Ice
30,35,30,80,100,Ghost,Poison
45,50,45,95,115,Ghost,Poison
60,65,60,110,130,Ghost,Poison
35,45,160,70,30,Rock,Ground
60,48,45,42,90,Psychic
85,73,70,67,115,Psychic
30,105,90,50,25,Water
55,130,115,75,50,Water
40,30,50,100,55,Electric
60,50,70,140,80,Electric
60,40,80,40,60,Grass,Psychic
95,95,85,55,125,Grass,Psychic
50,50,95,35,40,Ground
60,80,110,45,50,Ground
50,120,53,87,35,Fighting
50,105,79,76,35,Fighting
90,55,75,30,60,Normal
40,65,95,35,60,Poison
65,90,120,60,85,Poison
80,85,95,25,30,Ground,Rock
105,130,120,40,45,Ground,Rock
250,5,5,50,105,Normal
65,55,115,60,100,Grass
105,95,80,90,40,Normal
30,40,70,60,70,Water
55,65,95,85,95,Water
45,67,60,63,50,Water
80,92,65,68,80,Water
30,45,55,85,70,Water
60,75,85,115,100,Water,Psychic
40,45,65,90,100,Psychic
70,110,80,105,55,Bug,Flying
65,50,35,95,95,Ice,Psychic
65,83,57,105,85,Electric
65,95,57,93,85,Fire
65,125,100,85,55,Bug
75,100,95,110,70,Normal
20,10,55,80,20,Water
95,125,79,81,100,Water,Flying
130,85,80,60,95,Water,Ice
48,48,48,48,48,Normal
55,55,50,55,65,Normal
130,65,60,65,110,Water
65,65,60,130,110,Electric
65,130,60,65,110,Fire
65,60,70,40,75,Normal
35,40,100,35,90,Rock,Water
70,60,125,55,115,Rock,Water
30,80,90,55,45,Rock,Water
60,115,105,80,70,Rock,Water
80,105,65,130,60,Rock,Flying
160,110,65,30,65,Normal
90,85,100,85,125,Ice,Flying
90,90,85,100,125,Electric,Flying
90,100,90,90,125,Fire,Flying
41,64,45,50,50,Dragon
61,84,65,70,70,Dragon
91,134,95,80,100,Dragon,Flying
106,110,90,130,154,Psychic
100,100,100,100,100,Psychic
`;

// Gen 1 type byte values used in the Pokémon struct.
export const TYPE_BYTE: Record<string, number> = {
  Normal: 0, Fighting: 1, Flying: 2, Poison: 3, Ground: 4, Rock: 5, Bug: 7, Ghost: 8,
  Fire: 20, Water: 21, Grass: 22, Electric: 23, Psychic: 24, Ice: 25, Dragon: 26,
};

export interface BaseStats {
  hp: number; atk: number; def: number; spe: number; spc: number;
  type1: string; type2: string;
}

export const BASE_STATS: BaseStats[] = BASE_TABLE.trim().split('\n').map((line) => {
  const [hp, atk, def, spe, spc, t1, t2] = line.split(',');
  return { hp: +hp, atk: +atk, def: +def, spe: +spe, spc: +spc, type1: t1, type2: t2 ?? t1 };
});

// Internal species index (as stored in the save) -> species name. Gaps are glitch "MissingNo." slots.
const INTERNAL_NAMES: Record<number, string> = {
  0x01: 'Rhydon', 0x02: 'Kangaskhan', 0x03: 'Nidoran♂', 0x04: 'Clefairy', 0x05: 'Spearow', 0x06: 'Voltorb',
  0x07: 'Nidoking', 0x08: 'Slowbro', 0x09: 'Ivysaur', 0x0a: 'Exeggutor', 0x0b: 'Lickitung', 0x0c: 'Exeggcute',
  0x0d: 'Grimer', 0x0e: 'Gengar', 0x0f: 'Nidoran♀', 0x10: 'Nidoqueen', 0x11: 'Cubone', 0x12: 'Rhyhorn',
  0x13: 'Lapras', 0x14: 'Arcanine', 0x15: 'Mew', 0x16: 'Gyarados', 0x17: 'Shellder', 0x18: 'Tentacool',
  0x19: 'Gastly', 0x1a: 'Scyther', 0x1b: 'Staryu', 0x1c: 'Blastoise', 0x1d: 'Pinsir', 0x1e: 'Tangela',
  0x21: 'Growlithe', 0x22: 'Onix', 0x23: 'Fearow', 0x24: 'Pidgey', 0x25: 'Slowpoke', 0x26: 'Kadabra',
  0x27: 'Graveler', 0x28: 'Chansey', 0x29: 'Machoke', 0x2a: 'Mr. Mime', 0x2b: 'Hitmonlee', 0x2c: 'Hitmonchan',
  0x2d: 'Arbok', 0x2e: 'Parasect', 0x2f: 'Psyduck', 0x30: 'Drowzee', 0x31: 'Golem', 0x33: 'Magmar',
  0x35: 'Electabuzz', 0x36: 'Magneton', 0x37: 'Koffing', 0x39: 'Mankey', 0x3a: 'Seel', 0x3b: 'Diglett',
  0x3c: 'Tauros', 0x40: "Farfetch'd", 0x41: 'Venonat', 0x42: 'Dragonite', 0x46: 'Doduo', 0x47: 'Poliwag',
  0x48: 'Jynx', 0x49: 'Moltres', 0x4a: 'Articuno', 0x4b: 'Zapdos', 0x4c: 'Ditto', 0x4d: 'Meowth',
  0x4e: 'Krabby', 0x52: 'Vulpix', 0x53: 'Ninetales', 0x54: 'Pikachu', 0x55: 'Raichu', 0x58: 'Dratini',
  0x59: 'Dragonair', 0x5a: 'Kabuto', 0x5b: 'Kabutops', 0x5c: 'Horsea', 0x5d: 'Seadra', 0x60: 'Sandshrew',
  0x61: 'Sandslash', 0x62: 'Omanyte', 0x63: 'Omastar', 0x64: 'Jigglypuff', 0x65: 'Wigglytuff', 0x66: 'Eevee',
  0x67: 'Flareon', 0x68: 'Jolteon', 0x69: 'Vaporeon', 0x6a: 'Machop', 0x6b: 'Zubat', 0x6c: 'Ekans',
  0x6d: 'Paras', 0x6e: 'Poliwhirl', 0x6f: 'Poliwrath', 0x70: 'Weedle', 0x71: 'Kakuna', 0x72: 'Beedrill',
  0x74: 'Dodrio', 0x75: 'Primeape', 0x76: 'Dugtrio', 0x77: 'Venomoth', 0x78: 'Dewgong', 0x7b: 'Caterpie',
  0x7c: 'Metapod', 0x7d: 'Butterfree', 0x7e: 'Machamp', 0x80: 'Golduck', 0x81: 'Hypno', 0x82: 'Golbat',
  0x83: 'Mewtwo', 0x84: 'Snorlax', 0x85: 'Magikarp', 0x88: 'Muk', 0x8a: 'Kingler', 0x8b: 'Cloyster',
  0x8d: 'Electrode', 0x8e: 'Clefable', 0x8f: 'Weezing', 0x90: 'Persian', 0x91: 'Marowak', 0x93: 'Haunter',
  0x94: 'Abra', 0x95: 'Alakazam', 0x96: 'Pidgeotto', 0x97: 'Pidgeot', 0x98: 'Starmie', 0x99: 'Bulbasaur',
  0x9a: 'Venusaur', 0x9b: 'Tentacruel', 0x9d: 'Goldeen', 0x9e: 'Seaking', 0xa3: 'Ponyta', 0xa4: 'Rapidash',
  0xa5: 'Rattata', 0xa6: 'Raticate', 0xa7: 'Nidorino', 0xa8: 'Nidorina', 0xa9: 'Geodude', 0xaa: 'Porygon',
  0xab: 'Aerodactyl', 0xad: 'Magnemite', 0xb0: 'Charmander', 0xb1: 'Squirtle', 0xb2: 'Charmeleon',
  0xb3: 'Wartortle', 0xb4: 'Charizard', 0xb9: 'Oddish', 0xba: 'Gloom', 0xbb: 'Vileplume', 0xbc: 'Bellsprout',
  0xbd: 'Weepinbell', 0xbe: 'Victreebel',
};

/** internal index -> dex number (1..151), or 0 for glitch/invalid slots. */
export const INTERNAL_TO_DEX: number[] = Array.from({ length: 256 }, (_, i) => {
  const name = INTERNAL_NAMES[i];
  return name ? DEX_NAMES.indexOf(name) + 1 : 0;
});

/** dex number (1..151) -> internal index. */
export const DEX_TO_INTERNAL: number[] = (() => {
  const out = new Array<number>(152).fill(0);
  INTERNAL_TO_DEX.forEach((dex, internal) => {
    if (dex > 0) out[dex] = internal;
  });
  return out;
})();

export function speciesName(internalId: number): string {
  const dex = INTERNAL_TO_DEX[internalId];
  return dex ? DEX_NAMES[dex - 1] : `MissingNo. (0x${internalId.toString(16).toUpperCase().padStart(2, '0')})`;
}

export function baseStatsFor(internalId: number): BaseStats | null {
  const dex = INTERNAL_TO_DEX[internalId];
  return dex ? BASE_STATS[dex - 1] : null;
}

// Moves 1..165 (index 0 = no move).
export const MOVE_NAMES: string[] = [
  '—', 'Pound', 'Karate Chop', 'DoubleSlap', 'Comet Punch', 'Mega Punch', 'Pay Day', 'Fire Punch', 'Ice Punch',
  'ThunderPunch', 'Scratch', 'ViceGrip', 'Guillotine', 'Razor Wind', 'Swords Dance', 'Cut', 'Gust', 'Wing Attack',
  'Whirlwind', 'Fly', 'Bind', 'Slam', 'Vine Whip', 'Stomp', 'Double Kick', 'Mega Kick', 'Jump Kick',
  'Rolling Kick', 'Sand-Attack', 'Headbutt', 'Horn Attack', 'Fury Attack', 'Horn Drill', 'Tackle', 'Body Slam',
  'Wrap', 'Take Down', 'Thrash', 'Double-Edge', 'Tail Whip', 'Poison Sting', 'Twineedle', 'Pin Missile', 'Leer',
  'Bite', 'Growl', 'Roar', 'Sing', 'Supersonic', 'SonicBoom', 'Disable', 'Acid', 'Ember', 'Flamethrower', 'Mist',
  'Water Gun', 'Hydro Pump', 'Surf', 'Ice Beam', 'Blizzard', 'Psybeam', 'BubbleBeam', 'Aurora Beam', 'Hyper Beam',
  'Peck', 'Drill Peck', 'Submission', 'Low Kick', 'Counter', 'Seismic Toss', 'Strength', 'Absorb', 'Mega Drain',
  'Leech Seed', 'Growth', 'Razor Leaf', 'SolarBeam', 'PoisonPowder', 'Stun Spore', 'Sleep Powder', 'Petal Dance',
  'String Shot', 'Dragon Rage', 'Fire Spin', 'ThunderShock', 'Thunderbolt', 'Thunder Wave', 'Thunder',
  'Rock Throw', 'Earthquake', 'Fissure', 'Dig', 'Toxic', 'Confusion', 'Psychic', 'Hypnosis', 'Meditate',
  'Agility', 'Quick Attack', 'Rage', 'Teleport', 'Night Shade', 'Mimic', 'Screech', 'Double Team', 'Recover',
  'Harden', 'Minimize', 'SmokeScreen', 'Confuse Ray', 'Withdraw', 'Defense Curl', 'Barrier', 'Light Screen',
  'Haze', 'Reflect', 'Focus Energy', 'Bide', 'Metronome', 'Mirror Move', 'Selfdestruct', 'Egg Bomb', 'Lick',
  'Smog', 'Sludge', 'Bone Club', 'Fire Blast', 'Waterfall', 'Clamp', 'Swift', 'Skull Bash', 'Spike Cannon',
  'Constrict', 'Amnesia', 'Kinesis', 'Softboiled', 'Hi Jump Kick', 'Glare', 'Dream Eater', 'Poison Gas',
  'Barrage', 'Leech Life', 'Lovely Kiss', 'Sky Attack', 'Transform', 'Bubble', 'Dizzy Punch', 'Spore', 'Flash',
  'Psywave', 'Splash', 'Acid Armor', 'Crabhammer', 'Explosion', 'Fury Swipes', 'Bonemerang', 'Rest',
  'Rock Slide', 'Hyper Fang', 'Sharpen', 'Conversion', 'Tri Attack', 'Super Fang', 'Slash', 'Substitute',
  'Struggle',
];

const ITEM_BASE: string[] = [
  '', 'Master Ball', 'Ultra Ball', 'Great Ball', 'Poké Ball', 'Town Map', 'Bicycle', '?????', 'Safari Ball',
  'Pokédex', 'Moon Stone', 'Antidote', 'Burn Heal', 'Ice Heal', 'Awakening', 'Parlyz Heal', 'Full Restore',
  'Max Potion', 'Hyper Potion', 'Super Potion', 'Potion', 'BoulderBadge', 'CascadeBadge', 'ThunderBadge',
  'RainbowBadge', 'SoulBadge', 'MarshBadge', 'VolcanoBadge', 'EarthBadge', 'Escape Rope', 'Repel', 'Old Amber',
  'Fire Stone', 'Thunderstone', 'Water Stone', 'HP Up', 'Protein', 'Iron', 'Carbos', 'Calcium', 'Rare Candy',
  'Dome Fossil', 'Helix Fossil', 'Secret Key', '?????', 'Bike Voucher', 'X Accuracy', 'Leaf Stone', 'Card Key',
  'Nugget', 'PP Up', 'Poké Doll', 'Full Heal', 'Revive', 'Max Revive', 'Guard Spec.', 'Super Repel',
  'Max Repel', 'Dire Hit', 'Coin', 'Fresh Water', 'Soda Pop', 'Lemonade', 'S.S. Ticket', 'Gold Teeth',
  'X Attack', 'X Defend', 'X Speed', 'X Special', 'Coin Case', "Oak's Parcel", 'Itemfinder', 'Silph Scope',
  'Poké Flute', 'Lift Key', 'Exp. All', 'Old Rod', 'Good Rod', 'Super Rod', 'PP Up', 'Ether', 'Max Ether',
  'Elixer', 'Max Elixer',
];

export function itemName(id: number): string {
  if (id > 0 && id < ITEM_BASE.length) return ITEM_BASE[id];
  if (id >= 0xc4 && id <= 0xc8) return `HM${String(id - 0xc3).padStart(2, '0')}`;
  if (id >= 0xc9 && id <= 0xfa) return `TM${String(id - 0xc8).padStart(2, '0')}`;
  return `Item 0x${id.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** The move each HM (items 0xC4-0xC8) and TM (0xC9-0xFA) teaches, as move ids (pokered: constants/item_constants.asm). */
const TMHM_MOVE_IDS = [
  15, 19, 57, 70, 148, // HM01-HM05
  5, 13, 14, 18, 25, 92, 32, 34, 36, 38, 61, 55, 58, 59, 63, 6, 66, 68, 69, 99, 72, 76, 82, 85, 87,
  89, 90, 91, 94, 100, 102, 104, 115, 117, 118, 120, 121, 126, 129, 130, 135, 138, 143, 156, 86, 149, 153, 157, 161, 164, // TM01-TM50
];

/** The move a TM or HM item teaches ("Thunderbolt" for TM24), or null for any other item. */
export function tmhmMoveName(id: number): string | null {
  return id >= 0xc4 && id <= 0xfa ? MOVE_NAMES[TMHM_MOVE_IDS[id - 0xc4]] : null;
}

/**
 * Entries in the game's item table that you can't normally hold in the bag, so the picker doesn't offer them.
 * (A save that already contains one still shows it; this only limits what can be newly chosen.)
 */
const NOT_BAG_ITEMS = new Set<number>([
  0x07, 0x2c, // "?????" placeholders, never used
  0x08, // Safari Ball: the Safari Zone keeps its balls in a separate counter
  0x09, // Pokédex: a story item, not a bag item
  0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, // the eight gym badges (tracked as flags on the trainer card)
  0x32, // second "PP Up" entry that the game never hands out (0x4f is the real one)
  0x3b, // Coin: the game keeps coins in their own counter
]);

/** True for items that can be put in the bag in a normal playthrough. */
export const isBagItem = (id: number): boolean => !NOT_BAG_ITEMS.has(id);

/** Items offered in the bag editor's picker (id, name). */
export const ITEM_CHOICES: { id: number; name: string }[] = (() => {
  const out: { id: number; name: string }[] = [];
  for (let id = 1; id < ITEM_BASE.length; id++) if (isBagItem(id)) out.push({ id, name: itemName(id) });
  for (let id = 0xc4; id <= 0xfa; id++) out.push({ id, name: itemName(id) });
  return out;
})();

// Experience growth curves.
export type Growth = 'Medium Fast' | 'Fast' | 'Medium Slow' | 'Slow';
export const GROWTH_RATES: Growth[] = ['Medium Fast', 'Fast', 'Medium Slow', 'Slow'];

export function expForLevel(growth: Growth, n: number): number {
  const c = n * n * n;
  let exp: number;
  switch (growth) {
    case 'Medium Fast': exp = c; break;
    case 'Fast': exp = Math.floor((4 * c) / 5); break;
    case 'Medium Slow': exp = Math.floor((6 * c) / 5) - 15 * n * n + 100 * n - 140; break;
    case 'Slow': exp = Math.floor((5 * c) / 4); break;
  }
  return Math.max(0, exp);
}

/**
 * Each species' growth curve is fixed by the game (it is in the game's data, not the save). By National Dex number;
 * every other number from 1 to 151 is Medium Fast. Checked against Bulbapedia's list by experience type and against
 * the experience of every Pokémon in two real saves.
 */
const MEDIUM_SLOW_DEX = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 16, 17, 18, 29, 30, 31, 32, 33, 34, 43, 44, 45, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
  74, 75, 76, 92, 93, 94, 151,
];
const FAST_DEX = [35, 36, 39, 40, 113];
const SLOW_DEX = [58, 59, 72, 73, 90, 91, 102, 103, 111, 112, 120, 121, 127, 128, 129, 130, 131, 142, 143, 144, 145, 146, 147, 148, 149, 150];

export const GROWTH_BY_DEX: readonly Growth[] = Array.from({ length: 151 }, (_, i): Growth =>
  MEDIUM_SLOW_DEX.includes(i + 1) ? 'Medium Slow' : FAST_DEX.includes(i + 1) ? 'Fast' : SLOW_DEX.includes(i + 1) ? 'Slow' : 'Medium Fast');

/** The growth curve for a species (by the game's internal id). A glitch species has none, so `fallback` is used. */
export function growthOf(internalId: number, fallback: Growth = 'Medium Fast'): Growth {
  const dex = INTERNAL_TO_DEX[internalId];
  return dex ? GROWTH_BY_DEX[dex - 1] : fallback;
}

/** The first growth curve consistent with the mon's current level/exp (falls back to Medium Fast). */
export function guessGrowth(level: number, exp: number): Growth {
  if (level >= 100) {
    // Past the cap every curve is "consistent"; pick the one whose level-100 exp is closest from below.
    let best: Growth = 'Medium Fast';
    let bestExp = -1;
    for (const g of GROWTH_RATES) {
      const lo = expForLevel(g, 100);
      if (lo <= exp && lo > bestExp) { best = g; bestExp = lo; }
    }
    return best;
  }
  for (const g of GROWTH_RATES) {
    const lo = expForLevel(g, level);
    const hi = level >= 100 ? Infinity : expForLevel(g, level + 1);
    if (exp >= lo && exp < hi) return g;
  }
  return 'Medium Fast';
}

/** Kanto gym badges in the order the game stores them (bit 0 = Boulder ... bit 7 = Earth). */
export const BADGE_NAMES = ['Boulder', 'Cascade', 'Thunder', 'Rainbow', 'Soul', 'Marsh', 'Volcano', 'Earth'] as const;

/** Text speed as the game stores it in the low bits of the options byte (pokered: TEXT_DELAY_*). */
export const TEXT_SPEEDS = [
  { value: 1, label: 'Fast' },
  { value: 3, label: 'Medium' },
  { value: 5, label: 'Slow' },
] as const;

/**
 * How the Celadon Mansion granny describes the starter Pikachu (Yellow), by friendship: a short form of what she
 * actually says. Each entry applies while friendship is below `below`. scripts/verify-against-rom.mjs checks each
 * label's key words against her lines in the game.
 */
export const FRIENDSHIP_BANDS = [
  { below: 51, label: 'Not tamed at all' },
  { below: 101, label: 'Needs more care' },
  { below: 131, label: 'A cute Pokémon' },
  { below: 161, label: 'Seems tamed' },
  { below: 201, label: 'Happy with you' },
  { below: 256, label: 'A fantastic duo' },
] as const;

export const friendshipLabel = (friendship: number): string =>
  FRIENDSHIP_BANDS.find((b) => friendship < b.below)?.label ?? FRIENDSHIP_BANDS[FRIENDSHIP_BANDS.length - 1].label;

/** Melanie, in Cerulean City, gives you her Bulbasaur once Pikachu's friendship is this high or higher. scripts/verify-against-rom.mjs checks it. */
export const BULBASAUR_FRIENDSHIP = 147;

/** Pikachu's mood is one byte; 128 is neutral, and every step you walk moves it 1 closer to 128 (pokeyellow: UpdatePikachuHappinessAndMood). */
export const MOOD_NEUTRAL = 128;

export const moodLabel = (mood: number): 'Upset' | 'Neutral' | 'Cheerful' =>
  mood < MOOD_NEUTRAL ? 'Upset' : mood === MOOD_NEUTRAL ? 'Neutral' : 'Cheerful';

/**
 * What the game makes Pikachu do when you talk to it (pokeyellow: GetPikaPicAnimationScriptIndex). The game looks up
 * one row by friendship (the first whose limit is at or above it), then one column by mood. Its mood table has five
 * columns, but they only ever differ as below 128, exactly 128, or above 128, so there are three here.
 * The names are the game's own animation names.
 */
export interface ReactionRow { from: number; upTo: number; below: string; at: string; above: string }
export const REACTION_ROWS: readonly ReactionRow[] = [
  { from: 0, upTo: 50, below: 'AngryBolt', at: 'SideBlink', above: 'Side' },
  { from: 51, upTo: 100, below: 'BackTurn', at: 'Sad', above: 'Bored' },
  { from: 101, upTo: 130, below: 'EarTwitch', at: 'Blink2', above: 'Smile' },
  { from: 131, upTo: 160, below: 'EarTwitch', at: 'Happy', above: 'FistPump' },
  { from: 161, upTo: 200, below: 'Mad', at: 'Jump', above: 'Excited' },
  { from: 201, upTo: 250, below: 'Mad', at: 'Heart', above: 'Joy' },
  { from: 251, upTo: 255, below: 'Mad', at: '2Hearts', above: 'Love' },
];

/** The game's animation name for how Pikachu reacts to being talked to. */
export function pikachuReactionName(friendship: number, mood: number): string {
  const row = REACTION_ROWS.find((r) => friendship <= r.upTo) ?? REACTION_ROWS[REACTION_ROWS.length - 1];
  return mood < MOOD_NEUTRAL ? row.below : mood === MOOD_NEUTRAL ? row.at : row.above;
}

/**
 * For each of the game's reaction names: its picture (row `row` of sprites/pikachu.png in the artwork, frame 1 on the left
 * and frame 2 on the right; `slug` is the name scripts/extract-pikachu.py gives that row) and a sentence to follow
 * "Pikachu ".
 */
export const REACTIONS: Readonly<Record<string, { slug: string; row: number; text: string }>> = {
  AngryBolt: { slug: 'angry-bolt', row: 0, text: 'looks angry, with sparks' },
  SideBlink: { slug: 'side-blink', row: 1, text: 'glances away and blinks' },
  Side: { slug: 'side', row: 2, text: 'looks off to the side' },
  BackTurn: { slug: 'back-turn', row: 3, text: 'turns its back on you' },
  Sad: { slug: 'sad', row: 4, text: 'looks sad' },
  Bored: { slug: 'bored', row: 5, text: 'looks bored' },
  EarTwitch: { slug: 'ear-twitch', row: 6, text: 'twitches its ears' },
  Blink2: { slug: 'blink', row: 7, text: 'blinks' },
  Smile: { slug: 'smile', row: 8, text: 'smiles' },
  Happy: { slug: 'happy', row: 9, text: 'looks happy' },
  FistPump: { slug: 'fist-pump', row: 10, text: 'pumps its fist' },
  Mad: { slug: 'mad', row: 11, text: 'looks mad' },
  Jump: { slug: 'jump', row: 12, text: 'jumps' },
  Excited: { slug: 'excited', row: 13, text: 'looks excited' },
  Heart: { slug: 'heart', row: 14, text: 'shows a heart' },
  Joy: { slug: 'joy', row: 15, text: 'looks overjoyed' },
  '2Hearts': { slug: 'two-hearts', row: 16, text: 'shows two hearts' },
  Love: { slug: 'love', row: 17, text: 'looks full of love' },
};

/** The picture, sentence and label for how Pikachu reacts at this friendship and mood. */
export function pikachuReactionInfo(friendship: number, mood: number): { name: string; slug: string; row: number; text: string } {
  const name = pikachuReactionName(friendship, mood);
  return { name, ...REACTIONS[name] };
}

/** Plain-English version of pikachuReactionName, to follow "Pikachu ". */
export const pikachuReaction = (friendship: number, mood: number): string => pikachuReactionInfo(friendship, mood).text;
