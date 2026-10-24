// Sprite images (see assets/sprites/CREDITS.md). Paths are relative to the page, so they work on any
// host or sub-path. A missing file hides its <img> instead of showing a broken-image icon, so the
// site still works if the assets folder is removed.

import { h } from './dom.ts';
import { ICON_OFFSETS, ICON_SIZE } from './spriteOffsets.ts';

const BASE = 'assets/sprites';

export const pokemonIconUrl = (dex: number) => `${BASE}/pokemon/${dex}.png`;
export const itemIconUrl = (path: string) => `${BASE}/items/${path}.png`;
export const badgeIconUrl = (n: number) => `${BASE}/badges/${n}.png`;
export const typeIconUrl = (type: string) => `${BASE}/types/${type.toLowerCase()}.png`;

function icon(src: string, w: number, h_: number, cls: string): HTMLImageElement {
  const img = h('img', { class: `sprite ${cls}`, src, alt: '', width: w, height: h_, loading: 'lazy', decoding: 'async' });
  // h() skips `false`, so this can't go in the props. Without it the browser starts its own image drag, which
  // cancels the pointer and would break dragging Pokémon around.
  img.draggable = false;
  img.addEventListener('error', () => { img.hidden = true; });
  return img;
}

/**
 * The icons are drawn with their feet on a common baseline, so the art sits low in its canvas. Shift each one
 * by how far off-centre its visible pixels are (measured by scripts/measure-icons.mjs). Percentages are of the
 * image's own size, so it stays right however large CSS draws the icon.
 */
function centre(img: HTMLImageElement, dex: number): HTMLImageElement {
  const [dx, dy] = ICON_OFFSETS[dex] ?? [0, 0];
  if (dx || dy) img.style.transform = `translate(${(-dx / ICON_SIZE[0] * 100).toFixed(2)}%, ${(-dy / ICON_SIZE[1] * 100).toFixed(2)}%)`;
  return img;
}

/** Pokémon box icon (68x56) by National Dex number. Dex 0 (glitch species) gets an empty spacer. */
export function pokemonIcon(dex: number, cls = ''): HTMLElement {
  if (!dex) return h('span', { class: `sprite mon-icon empty ${cls}`.trim(), 'aria-hidden': 'true' });
  return centre(icon(pokemonIconUrl(dex), ICON_SIZE[0], ICON_SIZE[1], `mon-icon ${cls}`.trim()), dex);
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

/** One of Pikachu's talk-to reactions (assets/sprites/pikachu/<slug>-1.png and -2.png, 40x40, hard pixel edges). */
export const pikachuPicUrl = (slug: string, frame: 1 | 2) => `${BASE}/pikachu/${slug}-${frame}.png`;

/**
 * A reaction picture. With `animated` it also holds the second frame, which the stylesheet flips on and off
 * (and leaves off for people who ask for less motion). Change it later with setPikachuPic.
 */
export function pikachuPic(slug: string, alt: string, animated = false): HTMLElement {
  const first = icon(pikachuPicUrl(slug, 1), 40, 40, 'pika-frame');
  first.alt = alt;
  const frames: HTMLElement[] = [first];
  if (animated) frames.push(icon(pikachuPicUrl(slug, 2), 40, 40, 'pika-frame pika-frame-2'));
  return h('span', { class: `pika-pic${animated ? ' animated' : ''}` }, frames);
}

export function setPikachuPic(pic: HTMLElement, slug: string, alt: string): void {
  const frames = pic.querySelectorAll('img');
  frames.forEach((img, i) => setIconSrc(img, pikachuPicUrl(slug, i === 0 ? 1 : 2)));
  if (frames[0]) frames[0].alt = alt;
}

/** Start fetching every reaction picture so they swap instantly while someone drags a slider. */
export function preloadPikachuPics(slugs: string[]): void {
  const go = () => { for (const slug of slugs) for (const frame of [1, 2] as const) new Image().src = pikachuPicUrl(slug, frame); };
  if ('requestIdleCallback' in window) window.requestIdleCallback(go); else setTimeout(go, 400);
}

/** Point an existing icon at another file (and un-hide it if the last one failed). */
export function setIconSrc(img: HTMLImageElement, src: string): void {
  img.hidden = false;
  img.src = src;
}

/** A generic icon from any page-relative path (used for the per-game pictures on the landing page). */
export function pictureIcon(src: string, w: number, h_: number, cls = ''): HTMLImageElement {
  const img = icon(src, w, h_, cls);
  const dex = Number(src.match(/\/pokemon\/(\d+)\.png$/)?.[1]);
  return dex ? centre(img, dex) : img;
}
