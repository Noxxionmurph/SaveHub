// Which sprite file shows for each Ruby / Sapphire / Emerald item. Values are "<category>/<name>" inside
// assets/sprites/items/ (the PokéSprite layout). Items with no entry fall back to the generic "?" bag icon.
// scripts/import-sprites.mjs reads this table to know which files to copy, so edit it here only.

import { HM_COUNT, TM01, TMHM_MOVES, TM_COUNT, moveInfo } from '../../../core/gen3/data.ts';

export const UNKNOWN_ITEM = 'etc/unknown-item';

const BASE: Record<number, string> = {
  1: 'ball/master', 2: 'ball/ultra', 3: 'ball/great', 4: 'ball/poke', 5: 'ball/safari', 6: 'ball/net', 7: 'ball/dive',
  8: 'ball/nest', 9: 'ball/repeat', 10: 'ball/timer', 11: 'ball/luxury', 12: 'ball/premier', 13: 'medicine/potion',
  14: 'medicine/antidote', 15: 'medicine/burn-heal', 16: 'medicine/ice-heal', 17: 'medicine/awakening',
  18: 'medicine/paralyze-heal', 19: 'medicine/full-restore', 20: 'medicine/max-potion', 21: 'medicine/hyper-potion',
  22: 'medicine/super-potion', 23: 'medicine/full-heal', 24: 'medicine/revive', 25: 'medicine/max-revive',
  26: 'medicine/fresh-water', 27: 'medicine/soda-pop', 28: 'medicine/lemonade', 29: 'medicine/moomoo-milk',
  30: 'medicine/energy-powder', 31: 'medicine/energy-root', 32: 'medicine/heal-powder', 33: 'medicine/revival-herb',
  34: 'medicine/ether', 35: 'medicine/max-ether', 36: 'medicine/elixir', 37: 'medicine/max-elixir',
  38: 'medicine/lava-cookie', 39: 'flute/blue', 40: 'flute/yellow', 41: 'flute/red', 42: 'flute/black',
  43: 'flute/white', 44: 'medicine/berry-juice', 45: 'medicine/sacred-ash', 46: 'valuable-item/shoal-salt',
  47: 'valuable-item/shoal-shell', 48: 'shard/red', 49: 'shard/blue', 50: 'shard/yellow', 51: 'shard/green',
  63: 'medicine/hp-up', 64: 'medicine/protein', 65: 'medicine/iron', 66: 'medicine/carbos', 67: 'medicine/calcium',
  68: 'medicine/rare-candy', 69: 'medicine/pp-up', 70: 'medicine/zinc', 71: 'medicine/pp-max',
  73: 'battle-item/guard-spec', 74: 'battle-item/dire-hit', 75: 'battle-item/x-attack', 76: 'battle-item/x-defense',
  77: 'battle-item/x-speed', 78: 'battle-item/x-accuracy', 79: 'battle-item/x-sp-atk', 80: 'other-item/poke-doll',
  81: 'other-item/fluffy-tail', 83: 'other-item/super-repel', 84: 'other-item/max-repel',
  85: 'other-item/escape-rope', 86: 'other-item/repel', 93: 'evo-item/sun-stone', 94: 'evo-item/moon-stone',
  95: 'evo-item/fire-stone', 96: 'evo-item/thunder-stone', 97: 'evo-item/water-stone', 98: 'evo-item/leaf-stone',
  103: 'valuable-item/tiny-mushroom', 104: 'valuable-item/big-mushroom', 106: 'valuable-item/pearl',
  107: 'valuable-item/big-pearl', 108: 'valuable-item/stardust', 109: 'valuable-item/star-piece',
  110: 'valuable-item/nugget', 111: 'other-item/heart-scale', 121: 'mail/orange-mail', 122: 'mail/harbor-mail',
  123: 'mail/glitter-mail', 124: 'mail/mech-mail', 125: 'mail/wood-mail', 126: 'mail/wave-mail',
  127: 'mail/bead-mail', 128: 'mail/shadow-mail', 129: 'mail/tropic-mail', 130: 'mail/dream-mail',
  131: 'mail/fab-mail', 132: 'mail/retro-mail', 133: 'berry/cheri', 134: 'berry/chesto', 135: 'berry/pecha',
  136: 'berry/rawst', 137: 'berry/aspear', 138: 'berry/leppa', 139: 'berry/oran', 140: 'berry/persim',
  141: 'berry/lum', 142: 'berry/sitrus', 143: 'berry/figy', 144: 'berry/wiki', 145: 'berry/mago', 146: 'berry/aguav',
  147: 'berry/iapapa', 148: 'berry/razz', 149: 'berry/bluk', 150: 'berry/nanab', 151: 'berry/wepear',
  152: 'berry/pinap', 153: 'berry/pomeg', 154: 'berry/kelpsy', 155: 'berry/qualot', 156: 'berry/hondew',
  157: 'berry/grepa', 158: 'berry/tamato', 159: 'berry/cornn', 160: 'berry/magost', 161: 'berry/rabuta',
  162: 'berry/nomel', 163: 'berry/spelon', 164: 'berry/pamtre', 165: 'berry/watmel', 166: 'berry/durin',
  167: 'berry/belue', 168: 'berry/liechi', 169: 'berry/ganlon', 170: 'berry/salac', 171: 'berry/petaya',
  172: 'berry/apicot', 173: 'berry/lansat', 174: 'berry/starf', 175: 'berry/enigma', 179: 'hold-item/bright-powder',
  180: 'hold-item/white-herb', 181: 'ev-item/macho-brace', 182: 'key-item/exp-share', 183: 'hold-item/quick-claw',
  184: 'other-item/soothe-bell', 185: 'hold-item/mental-herb', 186: 'hold-item/choice-band',
  187: 'hold-item/kings-rock', 188: 'hold-item/silver-powder', 189: 'hold-item/amulet-coin',
  190: 'hold-item/cleanse-tag', 191: 'hold-item/soul-dew', 192: 'evo-item/deep-sea-tooth',
  193: 'evo-item/deep-sea-scale', 194: 'hold-item/smoke-ball', 195: 'hold-item/everstone',
  196: 'hold-item/focus-band', 197: 'hold-item/lucky-egg', 198: 'hold-item/scope-lens', 199: 'hold-item/metal-coat',
  200: 'hold-item/leftovers', 201: 'evo-item/dragon-scale', 202: 'hold-item/light-ball', 203: 'hold-item/soft-sand',
  204: 'hold-item/hard-stone', 205: 'hold-item/miracle-seed', 206: 'hold-item/black-glasses',
  207: 'hold-item/black-belt', 208: 'hold-item/magnet', 209: 'hold-item/mystic-water', 210: 'hold-item/sharp-beak',
  211: 'hold-item/poison-barb', 212: 'hold-item/never-melt-ice', 213: 'hold-item/spell-tag',
  214: 'hold-item/twisted-spoon', 215: 'hold-item/charcoal', 216: 'hold-item/dragon-fang',
  217: 'hold-item/silk-scarf', 218: 'evo-item/up-grade', 219: 'hold-item/shell-bell', 220: 'incense/sea',
  221: 'incense/lax', 222: 'hold-item/lucky-punch', 223: 'hold-item/metal-powder', 224: 'hold-item/thick-club',
  225: 'hold-item/stick', 254: 'scarf/red', 255: 'scarf/blue', 256: 'scarf/pink', 257: 'scarf/green',
  258: 'scarf/yellow', 259: 'key-item/mach-bike', 260: 'key-item/coin-case', 261: 'key-item/dowsing-machine-gen3',
  262: 'key-item/old-rod', 263: 'key-item/good-rod', 264: 'key-item/super-rod', 265: 'key-item/ss-ticket',
  266: 'key-item/contest-pass', 268: 'key-item/wailmer-pail', 269: 'key-item/devon-goods', 270: 'key-item/soot-sack',
  271: 'key-item/basement-key', 272: 'key-item/acro-bike', 273: 'key-item/pokeblock-case', 274: 'key-item/letter',
  275: 'key-item/eon-ticket', 276: 'hold-item/red-orb', 277: 'hold-item/blue-orb', 278: 'key-item/scanner',
  279: 'key-item/go-goggles', 280: 'key-item/meteorite', 281: 'key-item/rm-1-key', 282: 'key-item/rm-2-key',
  283: 'key-item/rm-4-key', 284: 'key-item/rm-6-key', 285: 'key-item/storage-key', 286: 'fossil/root',
  287: 'fossil/claw', 288: 'key-item/devon-scope', 349: 'key-item/oaks-parcel', 350: 'key-item/poke-flute-gen3',
  351: 'key-item/secret-key-kanto', 352: 'key-item/bike-voucher', 353: 'key-item/gold-teeth', 354: 'fossil/old-amber',
  355: 'key-item/card-key', 356: 'key-item/lift-key', 357: 'fossil/helix', 358: 'fossil/dome',
  359: 'key-item/silph-scope', 360: 'key-item/bicycle', 361: 'key-item/town-map', 362: 'key-item/vs-seeker',
  363: 'key-item/fame-checker', 364: 'key-item/tm-case', 365: 'key-item/berry-pouch', 366: 'key-item/teachy-tv',
  367: 'key-item/tri-pass', 368: 'key-item/rainbow-pass', 369: 'key-item/tea', 370: 'key-item/mysticticket',
  371: 'key-item/auroraticket', 372: 'key-item/powder-jar', 373: 'key-item/ruby', 374: 'key-item/sapphire',
  375: 'key-item/magma-emblem', 376: 'key-item/old-sea-map',
};

/** The TM or HM index (0-57) for an item id, or -1. TMs and HMs are one run of ids. */
export const tmhmIndex = (id: number): number => (id >= TM01 && id < TM01 + TM_COUNT + HM_COUNT ? id - TM01 : -1);

/** A TM or HM disc, coloured by the type of the move it teaches. */
export function discPath(index: number): string {
  const t = (moveInfo(TMHM_MOVES[index])?.type ?? 'Normal').toLowerCase();
  return index >= TM_COUNT ? `hm/${t === 'flying' || t === 'water' || t === 'fighting' ? t : 'normal'}` : `tm/${t}`;
}

/** "<category>/<name>" for an item id, or the generic icon when there's no matching sprite. */
export function itemSpritePath(id: number): string {
  const tm = tmhmIndex(id);
  if (tm >= 0) return discPath(tm);
  return BASE[id] ?? UNKNOWN_ITEM;
}

/** Every distinct sprite path the table can return (used by the import script). */
export function allItemSpritePaths(): string[] {
  const out = new Set<string>([UNKNOWN_ITEM, ...Object.values(BASE)]);
  for (let i = 0; i < TM_COUNT + HM_COUNT; i++) out.add(discPath(i));
  return [...out].sort();
}
