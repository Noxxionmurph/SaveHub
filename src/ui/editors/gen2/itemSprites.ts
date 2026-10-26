// Which sprite file shows for each Gold / Silver / Crystal item. Values are "<category>/<name>" inside assets/sprites/items/
// (the PokéSprite layout). Items with no entry fall back to the generic "?" bag icon.
// scripts/import-sprites.mjs reads this table to know which files to copy, so edit it here only.
//
// PokéSprite draws items as later games show them. Gold and Silver's berries were renamed in Ruby and Sapphire, so
// each one shows the later berry that does the same job (PSNCureBerry is Pecha, MiracleBerry is Lum, ...), and its
// mail designs never came back, so all ten letters share one picture. Five items only Gold and Silver had (Berserk
// Gene, Normal Box, Gorgeous Box, Polkadot Bow, Brick Piece) have no picture there and use the generic one, as do
// Crystal's GS Ball and Egg Ticket.

import { HM_COUNT, TMHM_MOVES, TM_COUNT, moveInfo } from '../../../core/gen2/data.ts';

export const UNKNOWN_ITEM = 'etc/unknown-item';
const MAIL = 'mail/retro-mail';

const BASE: Record<number, string> = {
  0x01: 'ball/master', 0x02: 'ball/ultra', 0x03: 'hold-item/bright-powder', 0x04: 'ball/great', 0x05: 'ball/poke',
  0x07: 'key-item/bicycle', 0x08: 'evo-item/moon-stone',
  0x09: 'medicine/antidote', 0x0a: 'medicine/burn-heal', 0x0b: 'medicine/ice-heal', 0x0c: 'medicine/awakening',
  0x0d: 'medicine/paralyze-heal', 0x0e: 'medicine/full-restore', 0x0f: 'medicine/max-potion', 0x10: 'medicine/hyper-potion',
  0x11: 'medicine/super-potion', 0x12: 'medicine/potion', 0x13: 'other-item/escape-rope', 0x14: 'other-item/repel',
  0x15: 'medicine/max-elixir', 0x16: 'evo-item/fire-stone', 0x17: 'evo-item/thunder-stone', 0x18: 'evo-item/water-stone',
  0x1a: 'medicine/hp-up', 0x1b: 'medicine/protein', 0x1c: 'medicine/iron', 0x1d: 'medicine/carbos',
  0x1e: 'hold-item/lucky-punch', 0x1f: 'medicine/calcium', 0x20: 'medicine/rare-candy', 0x21: 'battle-item/x-accuracy',
  0x22: 'evo-item/leaf-stone', 0x23: 'hold-item/metal-powder', 0x24: 'valuable-item/nugget', 0x25: 'other-item/poke-doll',
  0x26: 'medicine/full-heal', 0x27: 'medicine/revive', 0x28: 'medicine/max-revive', 0x29: 'battle-item/guard-spec',
  0x2a: 'other-item/super-repel', 0x2b: 'other-item/max-repel', 0x2c: 'battle-item/dire-hit',
  0x2e: 'medicine/fresh-water', 0x2f: 'medicine/soda-pop', 0x30: 'medicine/lemonade', 0x31: 'battle-item/x-attack',
  0x33: 'battle-item/x-defense', 0x34: 'battle-item/x-speed', 0x35: 'battle-item/x-sp-atk',
  0x36: 'key-item/coin-case', 0x37: 'key-item/dowsing-machine-gen3', 0x39: 'key-item/exp-share',
  0x3a: 'key-item/old-rod', 0x3b: 'key-item/good-rod', 0x3c: 'partner-gift/silver-leaf', 0x3d: 'key-item/super-rod',
  0x3e: 'medicine/pp-up', 0x3f: 'medicine/ether', 0x40: 'medicine/max-ether', 0x41: 'medicine/elixir',
  0x42: 'key-item/red-scale', 0x43: 'key-item/secret-potion', 0x44: 'key-item/ss-ticket', 0x45: 'key-item/mystery-egg',
  0x46: 'key-item/clear-bell', // Crystal only
  0x47: 'key-item/silver-wing', 0x48: 'medicine/moomoo-milk', 0x49: 'hold-item/quick-claw', 0x4a: 'berry/pecha',
  0x4b: 'partner-gift/gold-leaf', 0x4c: 'hold-item/soft-sand', 0x4d: 'hold-item/sharp-beak', 0x4e: 'berry/cheri',
  0x4f: 'berry/aspear', 0x50: 'berry/rawst', 0x51: 'hold-item/poison-barb', 0x52: 'hold-item/kings-rock',
  0x53: 'berry/persim', 0x54: 'berry/chesto', 0x55: 'apricorn/red', 0x56: 'valuable-item/tiny-mushroom',
  0x57: 'valuable-item/big-mushroom', 0x58: 'hold-item/silver-powder', 0x59: 'apricorn/blue', 0x5b: 'hold-item/amulet-coin',
  0x5c: 'apricorn/yellow', 0x5d: 'apricorn/green', 0x5e: 'hold-item/cleanse-tag', 0x5f: 'hold-item/mystic-water',
  0x60: 'hold-item/twisted-spoon', 0x61: 'apricorn/white', 0x62: 'hold-item/black-belt', 0x63: 'apricorn/black',
  0x65: 'apricorn/pink', 0x66: 'hold-item/black-glasses', 0x67: 'valuable-item/slowpoke-tail', 0x68: 'hold-item/silk-scarf',
  0x69: 'hold-item/stick', 0x6a: 'hold-item/smoke-ball', 0x6b: 'hold-item/never-melt-ice', 0x6c: 'hold-item/magnet',
  0x6d: 'berry/lum', 0x6e: 'valuable-item/pearl', 0x6f: 'valuable-item/big-pearl', 0x70: 'hold-item/everstone',
  0x71: 'hold-item/spell-tag', 0x72: 'medicine/rage-candy-bar', 0x74: 'key-item/blue-card', 0x75: 'hold-item/miracle-seed', 0x76: 'hold-item/thick-club',
  0x77: 'hold-item/focus-band', 0x79: 'medicine/energy-powder', 0x7a: 'medicine/energy-root', 0x7b: 'medicine/heal-powder',
  0x7c: 'medicine/revival-herb', 0x7d: 'hold-item/hard-stone', 0x7e: 'hold-item/lucky-egg', 0x7f: 'key-item/card-key',
  0x80: 'key-item/machine-part', 0x82: 'key-item/lost-item', 0x83: 'valuable-item/stardust', 0x84: 'valuable-item/star-piece',
  0x85: 'key-item/basement-key', 0x86: 'key-item/pass', 0x8a: 'hold-item/charcoal', 0x8b: 'medicine/berry-juice',
  0x8c: 'hold-item/scope-lens', 0x8f: 'hold-item/metal-coat', 0x90: 'hold-item/dragon-fang', 0x92: 'hold-item/leftovers',
  0x96: 'berry/leppa', 0x97: 'evo-item/dragon-scale', 0x9c: 'medicine/sacred-ash', 0x9d: 'ball/heavy', 0x9e: MAIL,
  0x9f: 'ball/level', 0xa0: 'ball/lure', 0xa1: 'ball/fast', 0xa3: 'hold-item/light-ball', 0xa4: 'ball/friend',
  0xa5: 'ball/moon', 0xa6: 'ball/love', 0xa9: 'evo-item/sun-stone', 0xac: 'evo-item/up-grade', 0xad: 'berry/oran',
  0xae: 'berry/sitrus', 0xaf: 'key-item/squirt-bottle', 0xb1: 'ball/park', 0xb2: 'key-item/rainbow-wing',
  0xb5: MAIL, 0xb6: MAIL, 0xb7: MAIL, 0xb8: MAIL, 0xb9: MAIL, 0xba: MAIL, 0xbb: MAIL, 0xbc: MAIL, 0xbd: MAIL,
};

/** The first TM's item id. ITEM_C3 and ITEM_DC are unused gaps in the run, so TMs 05 and 29 onward are one id later. */
const TM01 = 0xbf;
const HM01 = 0xf3;

/** The TM or HM index (0-56) for an item id, or -1. */
export function tmhmIndex(id: number): number {
  if (id >= HM01 && id < HM01 + HM_COUNT) return TM_COUNT + id - HM01;
  if (id < TM01 || id >= HM01 || id === 0xc3 || id === 0xdc) return -1;
  return id - TM01 - (id > 0xc3 ? 1 : 0) - (id > 0xdc ? 1 : 0);
}

/** A TM or HM disc, coloured by the type of the move it teaches. Curse (the "???" type) uses the Ghost disc it got later. */
export function discPath(index: number): string {
  const type = moveInfo(TMHM_MOVES[index])?.type ?? 'Normal';
  const t = type === '???' ? 'ghost' : type.toLowerCase();
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

/** The picture for an egg in a list (PokéSprite's Mystery Egg). */
export const EGG_ICON = 'key-item/mystery-egg';
