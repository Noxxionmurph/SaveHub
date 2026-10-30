// The player's secret base: where it is, and the decorations set out in it, on a picture of the room drawn from the
// game's own tiles (a canvas, so a desk with a doll on it looks as it does in the game). Tap an empty spot to set out
// the chosen decoration there; tap a decoration to pick it, then put it away.

import {
  BASE_DECOR_MAX, BASE_SPOT_OPTIONS, cantPlace, decorAt, decorPlacing, isSpriteDecor, laidOut, roomKind, roomOf, withoutDecor,
  type SecretBase,
} from '../../../core/gen3/bases.ts';
import { DECORS_BY_CATEGORY, decorName } from '../../../core/gen3/decorations.ts';
import type { Gen3Save } from '../../../core/gen3/save.ts';
import { clear, h, selectInput } from '../../dom.ts';
import { decorSpriteUrl, secretBaseTilesUrl } from '../../sprites.ts';

const T = 16;
const images = new Map<string, HTMLImageElement>();
function image(url: string, onload: () => void): HTMLImageElement {
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    images.set(url, img);
  }
  if (!img.complete) img.addEventListener('load', onload, { once: true });
  return img;
}

export function secretBaseCard(s: Gen3Save, markDirty: () => void, fold: (key: string, title: Node | string, ...body: (Node | string)[]) => Node,
  onRedraw: (redraw: () => void) => void): Node {
  const wrap = h('section', { class: 'card secret-base' });
  let picked = -1;
  let placing = 0;
  let note = '';
  let hover: { x: number; y: number } | null = null;

  /** Decorations in the PC that aren't already set out (in the base or the bedroom), each once per spare copy. */
  const spare = () => {
    const free = new Map<number, number>();
    for (const list of s.decorations) for (const id of list) free.set(id, (free.get(id) ?? 0) + 1);
    for (const id of s.placedDecorations) free.set(id, (free.get(id) ?? 0) - 1);
    return DECORS_BY_CATEGORY.flat().filter((d) => (free.get(d.id) ?? 0) > 0);
  };
  /** Where the decoration's bottom-left corner goes when the tap is on (x, y): the tap lands on its middle. */
  const anchor = (id: number, x: number, y: number) => {
    const d = decorPlacing(id)!;
    return { x: x - Math.floor((d.w - 1) / 2), y: y + Math.floor((d.h - 1) / 2) };
  };

  const draw = () => {
    // Stays open across a redraw even when the toggle event that remembers it hasn't been handled yet.
    const wasOpen = !!wrap.querySelector('details')?.open;
    clear(wrap);
    const base = s.secretBase;
    const folded = (...body: (Node | string)[]) => {
      const d = fold('secret-base', h('span', {}, 'Secret base', base ? h('span', { class: 'muted count' }, `${base.decor.length}/${BASE_DECOR_MAX}`) : ''), ...body) as HTMLDetailsElement;
      if (wasOpen) d.open = true;
      return d;
    };
    const spot = selectInput([{ value: 0, label: 'No secret base' }, ...BASE_SPOT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))],
      base?.id ?? 0, (v) => {
        const id = Number(v);
        s.secretBase = id ? { id, decor: [] } : null;
        picked = -1; note = ''; hover = null;
        markDirty(); draw();
      }, { 'aria-label': 'Secret base spot' });
    if (!base) {
      wrap.append(folded(spot));
      return;
    }
    if (picked >= base.decor.length) picked = -1;
    const room = roomOf(base.id);
    const canvas = h('canvas', { class: 'base-room', width: room.w * T, height: room.h * T, role: 'img', 'aria-label': 'Secret base room' }) as HTMLCanvasElement;
    canvas.style.setProperty('--w', String(room.w * T));
    canvas.style.setProperty('--h', String(room.h * T));
    const paint = () => paintRoom(canvas, base, picked, placing && hover && picked < 0 ? { id: placing, ...anchor(placing, hover.x, hover.y) } : null, paint);
    const tile = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: Math.floor((e.clientX - r.left) / r.width * room.w), y: Math.floor((e.clientY - r.top) / r.height * room.h) };
    };
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const t = tile(e);
      if (hover?.x !== t.x || hover?.y !== t.y) { hover = t; paint(); }
    });
    canvas.addEventListener('pointerleave', () => { hover = null; paint(); });
    // A tap sets out the chosen decoration if it can go there (a doll onto a desk, say); otherwise it picks what's there.
    canvas.addEventListener('click', (e) => {
      const t = tile(e as PointerEvent);
      const at = placing && picked < 0 ? anchor(placing, t.x, t.y) : null;
      const why = at ? cantPlace(base.id, base.decor, placing, at.x, at.y) : null;
      if (at && !why) {
        base.decor.push({ id: placing, ...at });
        note = '';
        if (!spare().some((d) => d.id === placing)) placing = 0;
        markDirty(); draw();
        return;
      }
      const hit = decorAt(base.decor, t.x, t.y);
      if (hit >= 0 || picked >= 0) picked = hit === picked ? -1 : hit;
      note = hit < 0 && why ? why : '';
      draw();
    });

    const free = spare();
    if (!free.some((d) => d.id === placing)) placing = free[0]?.id ?? 0;
    const pickedRow = picked >= 0
      ? h('div', { class: 'item-row base-picked' },
        h('span', {}, decorName(base.decor[picked].id)),
        h('button', {
          onclick: () => { base.decor = withoutDecor(base.id, base.decor, picked); picked = -1; markDirty(); draw(); },
        }, 'Put away'))
      : h('div', { class: 'item-row base-place' },
        free.length
          ? selectInput(free.map((d) => ({ value: d.id, label: d.name })), placing, (v) => { placing = Number(v); note = ''; draw(); },
            { 'aria-label': 'Decoration to set out' })
          : h('span', { class: 'muted' }, 'No spare decorations in the PC'),
        free.length ? h('span', { class: 'muted' }, 'Tap the room to set it out') : '');
    // Twice the size where the room fits that way, else once (whole screen pixels either way, see styles.css).
    const view = h('div', { class: 'base-view' }, canvas);
    new ResizeObserver(() => canvas.classList.toggle('x2', view.clientWidth >= room.w * T * 2)).observe(view);
    wrap.append(folded(
      spot,
      view,
      pickedRow,
      note ? h('p', { class: 'muted base-note', role: 'status' }, note) : '',
      h('div', { class: 'button-row' },
        h('button', { disabled: !base.decor.length, onclick: () => { base.decor = []; picked = -1; markDirty(); draw(); } }, 'Put everything away'))));
    paint();
  };
  draw();
  onRedraw(draw);
  return wrap;
}

function paintRoom(canvas: HTMLCanvasElement, base: SecretBase, picked: number,
  ghost: { id: number; x: number; y: number } | null, again: () => void): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const room = roomOf(base.id);
  const tiles = image(secretBaseTilesUrl(roomKind(base.id)), again);
  if (!tiles.complete || !tiles.naturalWidth) return;
  const cells = laidOut(base.id, base.decor);
  const put = (m: number, x: number, y: number) => ctx.drawImage(tiles, (m % 16) * T, Math.floor(m / 16) * T, T, T, x * T, y * T, T, T);
  cells.forEach((m, i) => put(m, i % room.w, Math.floor(i / room.w)));
  // Dolls and cushions stand on their tile, centred, feet on its bottom edge, the nearer ones in front.
  const sprites = base.decor.map((p, k) => ({ p, k })).filter(({ p }) => isSpriteDecor(p.id)).sort((a, b) => a.p.y - b.p.y);
  for (const { p } of sprites) {
    const img = image(decorSpriteUrl(p.id), again);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, p.x * T + T / 2 - img.naturalWidth / 2, (p.y + 1) * T - img.naturalHeight);
  }
  const box = (id: number, x: number, y: number, color: string, fill: string) => {
    const d = decorPlacing(id)!;
    const left = x * T, top = (y - d.h + 1) * T;
    ctx.fillStyle = fill;
    ctx.fillRect(left, top, d.w * T, d.h * T);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, d.w * T - 1, d.h * T - 1);
  };
  if (picked >= 0) { const p = base.decor[picked]; box(p.id, p.x, p.y, '#ffffff', 'rgba(255,255,255,0.25)'); }
  if (ghost) {
    const ok = cantPlace(base.id, base.decor, ghost.id, ghost.x, ghost.y) === null;
    box(ghost.id, ghost.x, ghost.y, ok ? '#30d158' : '#ff453a', ok ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.3)');
  }
}
