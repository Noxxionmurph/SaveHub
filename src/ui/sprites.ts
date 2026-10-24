// Sprite images (see assets/sprites/CREDITS.md). Paths are relative to the page, so they work on any
// host or sub-path. A missing file hides its <img> instead of showing a broken-image icon, so the
// site still works if the assets folder is removed.

import { h } from './dom.ts';

const BASE = 'assets/sprites';

export const pokemonIconUrl = (dex: number) => `${BASE}/pokemon/${dex}.png`;
export const itemIconUrl = (path: string) => `${BASE}/items/${path}.png`;
export const badgeIconUrl = (n: number) => `${BASE}/badges/${n}.png`;
export const typeIconUrl = (type: string) => `${BASE}/types/${type.toLowerCase()}.png`;

function icon(src: string, w: number, h_: number, cls: string): HTMLImageElement {
  const img = h('img', { class: `sprite ${cls}`, src, alt: '', width: w, height: h_, loading: 'lazy', decoding: 'async', draggable: false });
  img.addEventListener('error', () => { img.hidden = true; });
  return img;
}

/** Pokémon box icon (68x56) by National Dex number. Dex 0 (glitch species) gets an empty spacer. */
export function pokemonIcon(dex: number, cls = ''): HTMLElement {
  if (!dex) return h('span', { class: `sprite mon-icon empty ${cls}`.trim(), 'aria-hidden': 'true' });
  return icon(pokemonIconUrl(dex), 68, 56, `mon-icon ${cls}`.trim());
}

/** Item icon (32x32) from a "<category>/<name>" path. */
export function itemIcon(path: string, cls = ''): HTMLImageElement {
  return icon(itemIconUrl(path), 32, 32, `item-icon ${cls}`.trim());
}

/** Kanto gym badge (16x16): 1 = Boulder ... 8 = Earth. Drawn with hard pixel edges. */
export function badgeIcon(n: number, cls = ''): HTMLImageElement {
  return icon(badgeIconUrl(n), 16, 16, `badge-icon ${cls}`.trim());
}

/** Round type icon (Fire, Water, ...). The file is 128px; CSS sizes it. */
export function typeIcon(type: string, cls = ''): HTMLImageElement {
  return icon(typeIconUrl(type), 128, 128, `type-icon ${cls}`.trim());
}

/** Point an existing icon at another file (and un-hide it if the last one failed). */
export function setIconSrc(img: HTMLImageElement, src: string): void {
  img.hidden = false;
  img.src = src;
}

/** A generic icon from any page-relative path (used for the per-game pictures on the landing page). */
export function pictureIcon(src: string, w: number, h_: number, cls = ''): HTMLImageElement {
  return icon(src, w, h_, cls);
}
