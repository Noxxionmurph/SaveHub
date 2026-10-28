// The Pokéblock case (pokeemerald include/global.h struct Pokeblock, SaveBlock1 pokeblocks[40]; pokeruby the same).
// Each Pokéblock takes 8 bytes (7 used; the compiler pads the struct, so the case is 0x140 bytes): its colour (0 is an
// empty slot), five flavours and its feel. The case lists the filled slots in order and the game packs them to the
// front when one is used or thrown away.

export const POKEBLOCK_SLOTS = 40;
const SIZE = 8;
/** Colour names by the byte the save stores (1 Red ... 14 Gold), as the case names them. */
export const POKEBLOCK_COLORS = ['', 'Red', 'Blue', 'Pink', 'Green', 'Yellow', 'Purple', 'Indigo', 'Brown', 'Lite Blue', 'Olive',
  'Gray', 'Black', 'White', 'Gold'] as const;
export const FLAVORS = ['spicy', 'dry', 'sweet', 'bitter', 'sour'] as const;
export const FLAVOR_MAX = 255;
/** The case shows a feel up to 99. */
export const FEEL_MAX = 99;

export interface Pokeblock { color: number; spicy: number; dry: number; sweet: number; bitter: number; sour: number; feel: number }

export function readPokeblocks(d: Uint8Array, at: number): Pokeblock[] {
  const out: Pokeblock[] = [];
  for (let i = 0; i < POKEBLOCK_SLOTS; i++) {
    const o = at + i * SIZE;
    if (!d[o]) continue;
    out.push({ color: d[o], spicy: d[o + 1], dry: d[o + 2], sweet: d[o + 3], bitter: d[o + 4], sour: d[o + 5], feel: d[o + 6] });
  }
  return out;
}

export function writePokeblocks(d: Uint8Array, at: number, list: Pokeblock[]): void {
  const byte = (v: number, max: number) => Math.max(0, Math.min(max, Math.floor(v)));
  d.fill(0, at, at + POKEBLOCK_SLOTS * SIZE);
  list.slice(0, POKEBLOCK_SLOTS).forEach((p, i) => {
    const o = at + i * SIZE;
    d[o] = byte(p.color, POKEBLOCK_COLORS.length - 1) || 1;
    FLAVORS.forEach((f, j) => { d[o + 1 + j] = byte(p[f], FLAVOR_MAX); });
    d[o + 6] = byte(p.feel, 255);
    d[o + 7] = 0;
  });
}

/** The level the case shows: the strongest flavour. */
export const pokeblockLevel = (p: Pokeblock) => Math.max(...FLAVORS.map((f) => p[f]));

export const pokeblockName = (p: Pokeblock) => `${POKEBLOCK_COLORS[p.color] ?? '?'} Pokéblock`;
