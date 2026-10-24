// Which sprite file shows for each Gen 1 item. Values are "<category>/<name>" inside assets/sprites/items/
// (the PokéSprite layout). Items with no entry fall back to the generic "?" bag icon.
// scripts/import-sprites.mjs reads this table to know which files to copy, so edit it here only.

export const UNKNOWN_ITEM = 'etc/unknown-item';

/** TM discs are coloured by the move's type (checked against pokered's TM list by scripts/gen-moves.mjs). */
const TM_TYPES = [
  'normal', 'normal', 'normal', 'normal', 'normal', 'poison', 'normal', 'normal', 'normal', 'normal', // 01-10
  'water', 'water', 'ice', 'ice', 'normal', 'normal', 'fighting', 'fighting', 'fighting', 'normal', // 11-20
  'grass', 'grass', 'dragon', 'electric', 'electric', 'ground', 'ground', 'ground', 'psychic', 'psychic', // 21-30
  'normal', 'normal', 'psychic', 'normal', 'normal', 'normal', 'normal', 'fire', 'normal', 'normal', // 31-40
  'normal', 'psychic', 'flying', 'psychic', 'electric', 'psychic', 'normal', 'rock', 'normal', 'normal', // 41-50
] as const;
const HM_TYPES = ['normal', 'flying', 'water', 'normal', 'normal'] as const; // Cut, Fly, Surf, Strength, Flash

const BASE: Record<number, string> = {
  0x01: 'ball/master', 0x02: 'ball/ultra', 0x03: 'ball/great', 0x04: 'ball/poke',
  0x05: 'key-item/town-map', 0x06: 'key-item/bicycle', 0x08: 'ball/safari',
  0x0a: 'evo-item/moon-stone',
  0x0b: 'medicine/antidote', 0x0c: 'medicine/burn-heal', 0x0d: 'medicine/ice-heal',
  0x0e: 'medicine/awakening', 0x0f: 'medicine/paralyze-heal',
  0x10: 'medicine/full-restore', 0x11: 'medicine/max-potion', 0x12: 'medicine/hyper-potion',
  0x13: 'medicine/super-potion', 0x14: 'medicine/potion',
  0x1d: 'other-item/escape-rope', 0x1e: 'other-item/repel', 0x1f: 'fossil/old-amber',
  0x20: 'evo-item/fire-stone', 0x21: 'evo-item/thunder-stone', 0x22: 'evo-item/water-stone',
  0x23: 'medicine/hp-up', 0x24: 'medicine/protein', 0x25: 'medicine/iron', 0x26: 'medicine/carbos',
  0x27: 'medicine/calcium', 0x28: 'medicine/rare-candy',
  0x29: 'fossil/dome', 0x2a: 'fossil/helix', 0x2b: 'key-item/secret-key-kanto', 0x2d: 'key-item/bike-voucher',
  0x2e: 'battle-item/x-accuracy', 0x2f: 'evo-item/leaf-stone', 0x30: 'key-item/card-key',
  0x31: 'valuable-item/nugget', 0x32: 'medicine/pp-up', 0x33: 'other-item/poke-doll',
  0x34: 'medicine/full-heal', 0x35: 'medicine/revive', 0x36: 'medicine/max-revive',
  0x37: 'battle-item/guard-spec', 0x38: 'other-item/super-repel', 0x39: 'other-item/max-repel',
  0x3a: 'battle-item/dire-hit',
  0x3c: 'medicine/fresh-water', 0x3d: 'medicine/soda-pop', 0x3e: 'medicine/lemonade',
  0x3f: 'key-item/ss-ticket', 0x40: 'key-item/gold-teeth',
  0x41: 'battle-item/x-attack', 0x42: 'battle-item/x-defense', 0x43: 'battle-item/x-speed',
  0x44: 'battle-item/x-sp-atk', 0x45: 'key-item/coin-case', 0x46: 'key-item/oaks-parcel',
  0x48: 'key-item/silph-scope', 0x49: 'key-item/poke-flute', 0x4a: 'key-item/lift-key',
  0x4b: 'key-item/exp-share', 0x4c: 'key-item/old-rod', 0x4d: 'key-item/good-rod', 0x4e: 'key-item/super-rod',
  0x4f: 'medicine/pp-up', 0x50: 'medicine/ether', 0x51: 'medicine/max-ether',
  0x52: 'medicine/elixir', 0x53: 'medicine/max-elixir',
};

/** "<category>/<name>" for an item id, or the generic icon when there's no matching sprite. */
export function itemSpritePath(id: number): string {
  if (id >= 0xc4 && id <= 0xc8) return `hm/${HM_TYPES[id - 0xc4]}`;
  if (id >= 0xc9 && id <= 0xfa) return `tm/${TM_TYPES[id - 0xc9]}`;
  return BASE[id] ?? UNKNOWN_ITEM;
}

/** Every distinct sprite path the table can return (used by the import script). */
export function allItemSpritePaths(): string[] {
  const out = new Set<string>([UNKNOWN_ITEM, ...Object.values(BASE)]);
  HM_TYPES.forEach((t) => out.add(`hm/${t}`));
  TM_TYPES.forEach((t) => out.add(`tm/${t}`));
  return [...out].sort();
}
