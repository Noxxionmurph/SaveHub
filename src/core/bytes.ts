// Byte helpers every game shares. The Game Boy games store numbers big-endian, the Game Boy Advance little-endian.

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v)));

/** Big-endian (Game Boy and Game Boy Color). */
export const be = {
  u16: (d: Uint8Array, o: number) => (d[o] << 8) | d[o + 1],
  setU16: (d: Uint8Array, o: number, v: number) => { d[o] = (v >> 8) & 0xff; d[o + 1] = v & 0xff; },
  u24: (d: Uint8Array, o: number) => (d[o] << 16) | (d[o + 1] << 8) | d[o + 2],
  setU24: (d: Uint8Array, o: number, v: number) => { d[o] = (v >> 16) & 0xff; d[o + 1] = (v >> 8) & 0xff; d[o + 2] = v & 0xff; },
};

/** Little-endian (Game Boy Advance). */
export const le = {
  u16: (d: Uint8Array, o: number) => d[o] | (d[o + 1] << 8),
  setU16: (d: Uint8Array, o: number, v: number) => { d[o] = v & 0xff; d[o + 1] = (v >> 8) & 0xff; },
  u32: (d: Uint8Array, o: number) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0,
  setU32: (d: Uint8Array, o: number, v: number) => {
    d[o] = v & 0xff; d[o + 1] = (v >> 8) & 0xff; d[o + 2] = (v >> 16) & 0xff; d[o + 3] = (v >>> 24) & 0xff;
  },
};

export interface BagItem {
  id: number;
  count: number;
}

/** A Game Boy item list (Gen 1 and 2): a count, then (id, quantity) pairs, then 0xFF. */
export function readItemList(d: Uint8Array, base: number, max: number): BagItem[] {
  const count = Math.min(d[base], max);
  const items: BagItem[] = [];
  for (let i = 0; i < count; i++) items.push({ id: d[base + 1 + i * 2], count: d[base + 2 + i * 2] });
  return items;
}

/** Writes a Game Boy item list, leaving out empty entries and keeping each quantity to 1-99. */
export function writeItemList(d: Uint8Array, base: number, items: BagItem[], max: number): void {
  const list = items.filter((it) => it.id !== 0 && it.id !== 0xff).slice(0, max);
  d[base] = list.length;
  list.forEach((it, i) => {
    d[base + 1 + i * 2] = it.id;
    d[base + 2 + i * 2] = clamp(it.count, 1, 99);
  });
  d[base + 1 + list.length * 2] = 0xff;
}
