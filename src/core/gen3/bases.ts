// The player's secret base (pokeemerald include/global.h struct SecretBase, slot 0 of SaveBlock1's 20; the other 19 are
// friends' bases from record mixing and aren't edited here). A base is the spot it was made at (an id; the room is
// id / 10) and up to 16 decorations from the PC, each at the map tile of its bottom-left corner. Placing follows
// src/decoration.c CanPlaceDecoration, against the room as the earlier decorations left it (a desk can hold a doll).
import { BASE_SPOTS, DECOR_PLACING, METATILE_KIND, METATILE_LAYER, ROOMS } from './baseData.ts';

export const SECRET_BASE_SIZE = 0xa0;
export const BASE_DECOR_MAX = 16;
/** Dolls and cushions are sprites, and a room has 14 objects for them (FLAG_DECORATION_1 ... 14). */
export const BASE_SPRITES_MAX = 14;
export const VAR_SECRET_BASE_MAP = 0x4026;
const SOLID_BOARD = 33;
const SAND_ORNAMENT_BROKEN_BASE = 0x28c - 0x200;

export const ROOM_KINDS = ['red_cave', 'brown_cave', 'blue_cave', 'yellow_cave', 'tree', 'shrub'] as const;
const KIND_NAMES = ['Red cave', 'Brown cave', 'Blue cave', 'Yellow cave', 'Tree', 'Shrub'];

export interface PlacedDecoration { id: number; x: number; y: number }
export interface SecretBase {
  /** Which spot (BASE_SPOTS); its room is id / 10. */
  id: number;
  /** In the order the game lays them out. */
  decor: PlacedDecoration[];
}

const placing = new Map(DECOR_PLACING.map(([id, perm, w, h, tiles]) => [id, { perm, w, h, tiles }]));
export const decorPlacing = (id: number) => placing.get(id);
export const isSpriteDecor = (id: number) => placing.get(id)?.perm === 'sprite';

export const roomOf = (baseId: number) => ROOMS[Math.floor(baseId / 10)];
export const roomKind = (baseId: number) => ROOM_KINDS[Math.floor(baseId / 40)];

/** The spots for a menu, labelled by route and kind, with north/south when a route has two of a kind. */
export const BASE_SPOT_OPTIONS: { id: number; label: string }[] = (() => {
  const label = (id: number, route: string) => {
    const r = roomOf(id);
    return `${route} · ${KIND_NAMES[Math.floor(id / 40)]} (${r.w}×${r.h})`;
  };
  const out = BASE_SPOTS.map(([id, , route, y]) => ({ id, route, y, label: label(id, route) }));
  for (const o of out) {
    const same = out.filter((p) => p.label === o.label).sort((a, b) => a.y - b.y);
    if (same.length > 1) {
      const i = same.indexOf(o), where = same.length === 2 ? ['north', 'south'] : ['north', 'middle', 'south'];
      o.label += `, ${where[Math.round(i * (where.length - 1) / (same.length - 1))]}`;
    }
  }
  return out.sort((a, b) => a.route.localeCompare(b.route, 'en', { numeric: true }) || a.label.localeCompare(b.label))
    .map(({ id, label: l }) => ({ id, label: l }));
})();
export const baseSpotLabel = (id: number) => BASE_SPOT_OPTIONS.find((o) => o.id === id)?.label ?? `Secret base #${id}`;
export const baseMapSection = (id: number) => BASE_SPOTS.find(([i]) => i === id)?.[1] ?? 0;

export function readSecretBase(d: Uint8Array, at: number): SecretBase | null {
  if (!d[at]) return null;
  const decor: PlacedDecoration[] = [];
  for (let i = 0; i < BASE_DECOR_MAX; i++) {
    const id = d[at + 0x12 + i], pos = d[at + 0x22 + i];
    if (id) decor.push({ id, x: pos >> 4, y: pos & 15 });
  }
  return { id: d[at], decor };
}

/** The player's details a newly made base is stamped with (SetPlayerSecretBase). */
export interface BaseOwner { name: Uint8Array; trainerId: Uint8Array; gender: number; language: number }

/** Writes the player's base. A base that moved (or is new, or gone) is cleared first, as the game does when you move:
 * its decorations go back to the PC. Only the count of friends' bases received survives. */
export function writeSecretBase(d: Uint8Array, at: number, base: SecretBase | null, before: SecretBase | null, owner: BaseOwner): void {
  if (base?.id !== before?.id) {
    const received = [d[at + 0x0e], d[at + 0x0f]];
    d.fill(0, at, at + SECRET_BASE_SIZE);
    d.fill(0xff, at + 2, at + 9);
    d[at + 0x0e] = received[0];
    d[at + 0x0f] = received[1];
    if (!base) return;
    d[at] = base.id;
    d[at + 1] = (owner.gender & 1) << 4;
    const end = owner.name.indexOf(0xff);
    d.set(owner.name.subarray(0, end < 0 ? 7 : Math.min(end, 7)), at + 2);
    d.set(owner.trainerId.subarray(0, 4), at + 9);
    d[at + 0x0d] = owner.language;
  }
  if (!base) return;
  d.fill(0, at + 0x12, at + 0x32);
  base.decor.slice(0, BASE_DECOR_MAX).forEach((p, i) => {
    d[at + 0x12 + i] = p.id;
    d[at + 0x22 + i] = (p.x & 15) << 4 | (p.y & 15);
  });
}

/** The room's metatiles once the given decorations are set out (ShowDecorationOnMap); dolls and cushions aren't tiles. */
export function laidOut(baseId: number, decor: PlacedDecoration[]): number[] {
  const room = roomOf(baseId), cells = room.cells.slice();
  for (const p of decor) {
    const d = placing.get(p.id);
    if (!d || d.perm === 'sprite') continue;
    for (let j = 0; j < d.h; j++) {
      for (let i = 0; i < d.w; i++) {
        const x = p.x + i, y = p.y - d.h + 1 + j;
        if (x < 0 || y < 0 || x >= room.w || y >= room.h) continue;
        const wall = d.perm !== 'wall' && METATILE_KIND[cells[y * room.w + x]] === 'W' ? 1 : 0;
        cells[y * room.w + x] = d.tiles[j * d.w + i] + wall;
      }
    }
  }
  return cells;
}

/** The placed decoration covering a tile, if any: a doll or cushion before what it sits on, then the last one set out. */
export function decorAt(decor: PlacedDecoration[], x: number, y: number): number {
  for (const sprites of [true, false]) {
    for (let k = decor.length - 1; k >= 0; k--) {
      const p = decor[k], d = placing.get(p.id);
      if (d && (d.perm === 'sprite') === sprites && x >= p.x && x < p.x + d.w && y <= p.y && y > p.y - d.h) return k;
    }
  }
  return -1;
}

/** Why a decoration can't go with its bottom-left corner at (x, y), or null if it can. Covers the room's own rules;
 * whether the PC has a spare one is the caller's business. */
export function cantPlace(baseId: number, decor: PlacedDecoration[], id: number, x: number, y: number): string | null {
  const d = placing.get(id), room = roomOf(baseId);
  if (!d) return 'Unknown decoration';
  if (decor.length >= BASE_DECOR_MAX) return `A base holds ${BASE_DECOR_MAX} decorations`;
  if (d.perm === 'sprite' && decor.filter((p) => isSpriteDecor(p.id)).length >= BASE_SPRITES_MAX) {
    return `A base holds ${BASE_SPRITES_MAX} dolls and cushions`;
  }
  const cells = laidOut(baseId, decor);
  const inside = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < room.w && cy < room.h;
  const kind = (cx: number, cy: number) => (inside(cx, cy) ? METATILE_KIND[cells[cy * room.w + cx]] : 'x');
  const sprite = (cx: number, cy: number) => decor.some((p) => isSpriteDecor(p.id) && p.x === cx && p.y === cy);
  for (let i = 0; i < d.h; i++) for (let j = 0; j < d.w; j++) if (!inside(x + j, y - i)) return "Doesn't fit there";
  const no = "Can't be placed there";
  switch (d.perm) {
    case 'solid':
    case 'pass':
      for (let i = 0; i < d.h; i++) {
        for (let j = 0; j < d.w; j++) {
          const k = kind(x + j, y - i);
          if (!(k === '.' || (id === SOLID_BOARD && k === 'H'))) return no;
          if (sprite(x + j, y - i)) return no;
        }
      }
      break;
    case 'behind':
      for (let i = 0; i < d.h - 1; i++) {
        for (let j = 0; j < d.w; j++) {
          const k = kind(x + j, y - i), normal = METATILE_LAYER[d.tiles[(d.h - 1 - i) * d.w + j]] === '0';
          if (!(k === '.' || (k === 'T' && normal)) || sprite(x + j, y - i)) return no;
        }
      }
      for (let j = 0; j < d.w; j++) {
        const k = kind(x + j, y - d.h + 1);
        if (!(k === '.' || k === 'W') || sprite(x + j, y - d.h + 1)) return no;
      }
      break;
    case 'wall':
      for (let i = 0; i < d.h; i++) {
        for (let j = 0; j < d.w; j++) {
          if (kind(x + j, y - i) !== 'W') return no;
          if (inside(x + j, y - i + 1) && cells[(y - i + 1) * room.w + x + j] === SAND_ORNAMENT_BROKEN_BASE) return no;
        }
      }
      break;
    case 'sprite':
      for (let j = 0; j < d.w; j++) {
        const k = kind(x + j, y);
        if (d.h === 2 ? k !== 'l' : k !== 's' && k !== 'l') return d.h === 2 ? 'Big dolls go in the middle of a large desk or mat' : 'Dolls and cushions go on a large desk or mat';
        if (sprite(x + j, y)) return no;
      }
      break;
  }
  return null;
}

/** Decorations that would be left floating once one is taken away (a doll on a desk that's gone), in order. */
export function withoutDecor(baseId: number, decor: PlacedDecoration[], index: number): PlacedDecoration[] {
  const kept: PlacedDecoration[] = [];
  decor.forEach((p, k) => {
    if (k === index) return;
    if (!isSpriteDecor(p.id) || cantPlace(baseId, kept.filter((q) => !isSpriteDecor(q.id)), p.id, p.x, p.y) === null) kept.push(p);
  });
  return kept;
}
