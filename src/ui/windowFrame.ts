// The frame the save's OPTION menu has chosen (FRAME: TYPE 1, TYPE 2 ...), drawn round the big game windows (trainer card,
// options, stats, Pokédex summary, the windows in the review) the way the game draws it round its own.
//
// The pictures are 24x24 nine-slices (3x3 tiles of 8x8: corners, edges and a middle the games never draw) in the
// artwork repository; see scripts/extract-frames.py. The stylesheet makes room for the frame (see "the chosen in-game
// frame" in styles.css), keyed on data-frame on the page, so a screen without one (Gen 1, the landing page) keeps the
// plain two-line frame. The frame itself is painted here, onto a picture exactly the window's size in screen pixels,
// because the browser's own border-image leaves a faint seam between tiles and uneven pixels on most screens.

import { artUrl } from './art.ts';

/** The big windows (keep in step with the stylesheet's frame rules). */
const BIG = '.lcd:is(.tcard, .stats, .review-list, .save-window, .options-window, .dex-summary)';

/** Which games' frames: Gold/Silver/Crystal share eight; Emerald redrew some of Ruby and Sapphire's twenty. */
export type FrameSet = 'gen2' | 'rs' | 'emerald';

let current: { set: FrameSet; img: HTMLImageElement } | null = null;

/** Show frame `type` (0 = TYPE 1) of `set` on every big window, now and until the next showFrame or hideFrame. */
export function showFrame(set: FrameSet, type: number): void {
  const img = new Image();
  current = { set, img };
  img.addEventListener('load', () => { if (current?.img === img) later(); });
  // Without the picture, the windows keep their usual two-line frame.
  img.addEventListener('error', () => { if (current?.img === img) hideFrame(); });
  img.src = artUrl(`sprites/frames/${set}/${type + 1}.png`);
  document.documentElement.dataset.frame = set === 'gen2' ? 'gen2' : 'gen3';
  watch();
  later();
}

/** Back to the plain frame (when the screen changes to one without a game, or to a game without the setting). */
export function hideFrame(): void {
  current = null;
  delete document.documentElement.dataset.frame;
  align();
}

/*
 * Pixel art is only even when every art pixel covers the same whole number of screen pixels, so each big window is
 * trimmed to a whole number of screen pixels (a hair narrower, a hair taller) and moved by the fraction of one that
 * puts its corner on one (the browser draws a picture where the layout puts it, 875.52 screen pixels down, and then
 * every few rows one comes out a pixel off), and the window, frame and all, is painted at exactly that size as its
 * background, k screen pixels per art pixel, where k is --px2's
 * (the whole number of screen pixels nearest two CSS pixels). The edges repeat their tile from each corner, like the
 * game's, and the last one is cut short. Gen 2's frames are one colour, so they take the window's ink on the window's
 * colour (and follow the theme). Gen 3's keep the game's own colours round the game's white window (the stylesheet's
 * --lcd there) on a light theme; on a dark one each colour's lightness is turned over and laid on the dark window
 * colour, so the frame's white edge becomes the window and its dark outline a light one, in the same hues. This runs again after anything that can
 * move or resize a window: a redraw, a dialog opening, a resize or zoom, a theme change, an animation ending.
 */
const TILE = 8;
let watching = false;
let queued = 0;

function align(): void {
  queued = 0;
  moveOnly = false;
  const wins = [...document.querySelectorAll<HTMLElement>(BIG)];
  for (const w of wins) { w.style.width = ''; w.style.minHeight = ''; w.style.position = ''; w.style.left = ''; w.style.top = ''; }
  const dialogs = [...new Set(wins.map((w) => w.closest('dialog')).filter((d) => d !== null))];
  for (const d of dialogs) d.style.translate = '';
  const frame = current;
  if (!frame || !document.documentElement.dataset.frame) {
    for (const w of wins) { w.style.backgroundImage = ''; w.style.backgroundSize = ''; delete w.dataset.frameKey; }
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.round(2 * dpr));
  // Sizes first, one at a time in page order (a window made a hair taller moves the ones below it, and can move a
  // whole dialog, which stays centred), then the corners, once nothing moves any more.
  const sizes = wins.map((w) => {
    const r = w.getBoundingClientRect();
    const W = Math.floor(r.width * dpr + 0.01), H = Math.ceil(r.height * dpr - 0.01);
    if (W !== r.width * dpr) w.style.width = `${W / dpr}px`;
    if (H !== r.height * dpr) w.style.minHeight = `${H / dpr}px`;
    return [W, H];
  });
  // A dialog is drawn on its own (on top of the page), from wherever its corner is, so its corner goes on a screen
  // pixel first. It is centred, so it can't be moved by an offset; a transform is fine for a layer of its own.
  for (const d of dialogs) {
    const r = d.getBoundingClientRect();
    const x = (Math.round(r.left * dpr) - r.left * dpr) / dpr, y = (Math.round(r.top * dpr) - r.top * dpr) / dpr;
    if (x || y) d.style.translate = `${x}px ${y}px`;
  }
  wins.forEach((w, i) => {
    const [W, H] = sizes[i];
    const r = w.getBoundingClientRect(), cs = getComputedStyle(w), ink = cs.color, paper = cs.getPropertyValue('--lcd').trim();
    place(w, r, dpr);
    if (!frame.img.complete || !frame.img.naturalWidth || W < 2 * TILE * k || H < 2 * TILE * k) return;
    const key = `${frame.img.src} ${W}x${H} ${k} ${ink} ${paper}`;
    if (w.dataset.frameKey === key) return;
    w.dataset.frameKey = key;
    const art = frame.set === 'gen2' || !isDark(paper) ? frame.img : darkened(frame.img, paper);
    w.style.backgroundImage = `url("${paint(art, frame.set === 'gen2' ? ink : null, paper, W, H, k)}")`;
    w.style.backgroundSize = `${W / dpr}px ${H / dpr}px`;
  });
}

/**
 * A W x H (screen pixels) window in `paper` with its frame, as a picture; `ink` recolours a one-colour frame (drawn on
 * the paper right to the edge, like Gen 2's), null keeps the frame's colours (with its outer pixels see-through).
 */
function paint(img: CanvasImageSource, ink: string | null, paper: string, W: number, H: number, k: number): string {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g) return '';
  g.imageSmoothingEnabled = false;
  const T = TILE * k;
  // tile (col, row) of the 3x3 picture at x, y, cut to w x h screen pixels
  const tile = (col: number, row: number, x: number, y: number, w = T, h = T) =>
    g.drawImage(img, col * TILE, row * TILE, w / k, h / k, x, y, w, h);
  for (let x = T; x < W - T; x += T) { const w = Math.min(T, W - T - x); tile(1, 0, x, 0, w); tile(1, 2, x, H - T, w); }
  for (let y = T; y < H - T; y += T) { const h = Math.min(T, H - T - y); tile(0, 1, 0, y, T, h); tile(2, 1, W - T, y, T, h); }
  tile(0, 0, 0, 0); tile(2, 0, W - T, 0); tile(0, 2, 0, H - T); tile(2, 2, W - T, H - T);
  if (ink) { g.globalCompositeOperation = 'source-in'; g.fillStyle = ink; g.fillRect(0, 0, W, H); }
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = paper;
  // Gen 3: the window starts 3 art pixels in (no frame leaves more than that of its outer edge see-through)
  const inset = ink ? 0 : 3 * k;
  g.fillRect(inset, inset, W - 2 * inset, H - 2 * inset);
  return c.toDataURL();
}

/** A CSS colour as 0-255 red, green, blue (by painting it, so any notation the stylesheet uses works). */
function rgb(colour: string): [number, number, number] {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return [255, 255, 255];
  g.fillStyle = colour;
  g.fillRect(0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  return [r, gr, b];
}

const isDark = (colour: string) => { const [r, g, b] = rgb(colour); return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128; };

const darkCache = new Map<string, HTMLCanvasElement>();

/**
 * A Gen 3 frame for a dark window: each colour's HSL lightness turned over (white to black, dark grey to light grey,
 * hues kept), then laid on the window colour as a "screen" blend, so what was the game's white is exactly the window.
 */
function darkened(img: HTMLImageElement, paper: string): HTMLCanvasElement {
  const key = `${img.src} ${paper}`;
  const hit = darkCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return c;
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height);
  const p = rgb(paper).map((v) => v / 255);
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [r, gr, b] = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
    const max = Math.max(r, gr, b), min = Math.min(r, gr, b), l = (max + min) / 2;
    // turning lightness l over to 1 - l with hue and saturation kept is the same as moving every channel by 1 - 2l
    const shift = 1 - 2 * l;
    [r, gr, b].forEach((v, j) => { const turned = Math.min(1, Math.max(0, v + shift)); d[i + j] = Math.round(255 * (1 - (1 - turned) * (1 - p[j]))); });
  }
  g.putImageData(px, 0, 0);
  darkCache.set(key, c);
  return c;
}

/**
 * Move a window by the fraction of a screen pixel that puts its corner on one. A relative offset, not a transform: the
 * browser lines a transformed window up with the screen before moving it.
 */
function place(w: HTMLElement, r: DOMRect, dpr: number): void {
  const at = (v: number, moved: string) => { const p = (v - (parseFloat(moved) || 0)) * dpr; return (Math.round(p) - p) / dpr; };
  const x = at(r.left, w.style.left), y = at(r.top, w.style.top);
  Object.assign(w.style, x || y ? { position: 'relative', left: `${x}px`, top: `${y}px` } : { position: '', left: '', top: '' });
}

/** After a scroll only the corners can be off (by the fraction of a screen pixel the scroll moved), not the sizes. */
function realign(): void {
  queued = 0;
  moveOnly = false;
  if (!current || !document.documentElement.dataset.frame) return;
  const dpr = window.devicePixelRatio || 1;
  for (const w of document.querySelectorAll<HTMLElement>(BIG)) place(w, w.getBoundingClientRect(), dpr);
}

let moveOnly = false;
const later = () => { if (queued && moveOnly) cancelAnimationFrame(queued); if (!queued || moveOnly) { moveOnly = false; queued = requestAnimationFrame(align); } };
const scrolled = () => { if (!queued) { moveOnly = true; queued = requestAnimationFrame(realign); } };

function watch(): void {
  if (watching) return;
  watching = true;
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-console'] });
  new ResizeObserver(later).observe(document.body);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', later);
  window.addEventListener('resize', later);
  document.addEventListener('animationend', later);
  document.addEventListener('transitionend', later);
  document.addEventListener('toggle', later, true);
  document.addEventListener('scroll', scrolled, { capture: true, passive: true });
}
