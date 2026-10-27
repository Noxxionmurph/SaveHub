// Sprite images (credits in CREDITS.md). They are loaded from the separate artwork site (see art.ts). A file that
// can't be loaded hides its <img> instead of showing a broken-image icon, so the editor still works without them.

import { artUrl } from './art.ts';
import { h } from './dom.ts';
import { ICON_OFFSETS, ICON_SIZE } from './spriteOffsets.ts';

const BASE = artUrl('sprites');

/** `form` picks one of a species' other looks; only Unown has any in Gen 2 ('b' to 'z'; A is the plain icon). */
export const pokemonIconUrl = (dex: number, form = '') => `${BASE}/pokemon/${dex}${form ? `-${form}` : ''}.png`;
export const itemIconUrl = (path: string) => `${BASE}/items/${path}.png`;
export const badgeIconUrl = (n: number, region: 'kanto' | 'johto' = 'kanto') => `${BASE}/badges/${region === 'johto' ? 'johto/' : ''}${n}.png`;
/** The in-game type label for a type name ("Fire"); Gen 2's ??? type (Curse) has its own. */
export const typeLabelUrl = (type: string) => `${BASE}/type-labels/${type === '???' ? 'unknown' : type.toLowerCase()}.png`;

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

/** Pokémon box icon (68x56) by National Dex number, optionally in another form. Dex 0 (glitch species) gets an empty spacer. */
export function pokemonIcon(dex: number, cls = '', form = ''): HTMLElement {
  if (!dex) return h('span', { class: `sprite mon-icon empty ${cls}`.trim(), 'aria-hidden': 'true' });
  return centre(icon(pokemonIconUrl(dex, form), ICON_SIZE[0], ICON_SIZE[1], `mon-icon ${cls}`.trim()), dex);
}

/** An egg, the same size as a Pokémon box icon. */
export function eggIcon(cls = ''): HTMLElement {
  const img = icon(`${BASE}/pokemon/egg.png`, ICON_SIZE[0], ICON_SIZE[1], `mon-icon egg ${cls}`.trim());
  // Measured like the others (scripts/measure-icons.mjs): the egg's centre sits 0.5px right and 18px low.
  img.style.transform = `translate(${(-0.5 / ICON_SIZE[0] * 100).toFixed(2)}%, ${(-18 / ICON_SIZE[1] * 100).toFixed(2)}%)`;
  return img;
}

/** Item icon (32x32) from a "<category>/<name>" path. */
export function itemIcon(path: string, cls = ''): HTMLImageElement {
  return icon(itemIconUrl(path), 32, 32, `item-icon ${cls}`.trim());
}

/** Gym badge (16x16): Kanto 1 = Boulder ... 8 = Earth, Johto 1 = Zephyr ... 8 = Rising. Drawn with hard pixel edges. */
export function badgeIcon(n: number, cls = '', region: 'kanto' | 'johto' = 'kanto'): HTMLImageElement {
  return icon(badgeIconUrl(n, region), 16, 16, `badge-icon ${cls}`.trim());
}

/**
 * A type as the games label it: the name in a coloured box (32x16, from Emerald's summary screen; Gen 1 and Gen 2 have
 * no coloured labels of their own). The name is the picture's alt text, and without the artwork the name shows as text.
 */
/** The shiny mark the games have used since Sword and Shield (two sparkles), or a ★ if the artwork is missing. */
export function shinyIcon(): HTMLElement {
  const img = icon(`${BASE}/marks/shiny.svg`, 24, 24, 'shiny-icon');
  img.addEventListener('error', () => img.replaceWith('★'));
  return img;
}

export function typeLabel(type: string, cls = ''): HTMLElement {
  const img = icon(typeLabelUrl(type), 32, 16, `type-label ${cls}`.trim());
  img.alt = type;
  img.title = type;
  img.addEventListener('error', () => img.replaceWith(h('span', { class: `type-text ${cls}`.trim() }, type)));
  return img;
}

/**
 * One of Pikachu's talk-to reactions, cut from sprites/pikachu.png in the artwork repository (one file: a row of two 40x40 frames
 * for each reaction, hard pixel edges). The stylesheet picks the row from `--row`. With `animated` it also holds
 * the second frame, which the stylesheet flips on and off (and leaves off for people who ask for less motion).
 * An empty `alt` marks the picture as decoration. Change it later with setPikachuPic.
 */
export function pikachuPic(row: number, alt: string, animated = false): HTMLElement {
  const frame = (cls: string) => h('span', { class: `pika-frame ${cls}`.trim(), 'aria-hidden': 'true' });
  const pic = h('span', { class: `pika-pic${animated ? ' animated' : ''}` },
    frame(''), animated ? frame('pika-frame-2') : null);
  setPikachuPic(pic, row, alt);
  return pic;
}

export function setPikachuPic(pic: HTMLElement, row: number, alt: string): void {
  pic.style.setProperty('--row', String(row));
  if (alt) { pic.setAttribute('role', 'img'); pic.setAttribute('aria-label', alt); pic.removeAttribute('aria-hidden'); }
  else { pic.removeAttribute('role'); pic.removeAttribute('aria-label'); pic.setAttribute('aria-hidden', 'true'); }
}

/** Point an existing icon at another file (and un-hide it if the last one failed). */
export function setIconSrc(img: HTMLImageElement, src: string): void {
  img.hidden = false;
  img.src = src;
}

/** An icon from any path inside the artwork (used for the per-game pictures on the landing page). */
export function pictureIcon(path: string, w: number, h_: number, cls = ''): HTMLImageElement {
  const img = icon(artUrl(path), w, h_, cls);
  const dex = Number(path.match(/\/pokemon\/(\d+)\.png$/)?.[1]);
  return dex ? centre(img, dex) : img;
}
