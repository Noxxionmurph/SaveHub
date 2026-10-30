// The player's secret base: where it is, and the decorations set out in it, on a picture of the room drawn from the
// game's own tiles (a canvas, so a desk with a doll on it looks as it does in the game). The PC's spare decorations
// sit in a strip of pictures below: drag one into the room, or pick it and tap the room. Drag a decoration in the room
// to move it (its dolls come along); tap it to pick it, then put it away.

import {
  BASE_DECOR_MAX, BASE_SPOT_OPTIONS, cantPlace, decorAt, decorPlacing, isSpriteDecor, laidOut, moveDecor, roomKind, roomOf,
  withoutDecor, type PlacedDecoration,
} from '../../../core/gen3/bases.ts';
import { DECORS_BY_CATEGORY, decorName } from '../../../core/gen3/decorations.ts';
import type { Gen3Save } from '../../../core/gen3/save.ts';
import { clear, h, selectInput } from '../../dom.ts';
import { decorSpriteUrl, secretBaseTilesUrl } from '../../sprites.ts';

const T = 16;
/** The strip's pictures are the decoration's own size, at least two tiles square so small ones still make a target. */
const thumbSize = (id: number) => {
  const d = decorPlacing(id)!;
  return { w: Math.max(d.w, 2) * T, h: Math.max(d.h, 2) * T };
};
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
const ready = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

type Tile = { x: number; y: number };
/** What a drag is doing: moving a placed decoration (`index`), or bringing one in from the strip (`id`). */
type Drag = { index: number; grab: Tile; from: Tile; to: Tile | null } | { id: number; to: Tile | null; moved: boolean };

export function secretBaseCard(s: Gen3Save, markDirty: () => void, fold: (key: string, title: Node | string, ...body: (Node | string)[]) => Node,
  onRedraw: (redraw: () => void) => void): Node {
  const wrap = h('section', { class: 'card secret-base' });
  let picked = -1;
  let placing = 0;
  let note = '';
  let hover: Tile | null = null;
  let drag: Drag | null = null;

  /** Decorations in the PC that aren't already set out (in the base or the bedroom), with how many are spare. */
  const spare = () => {
    const free = new Map<number, number>();
    for (const list of s.decorations) for (const id of list) free.set(id, (free.get(id) ?? 0) + 1);
    for (const id of s.placedDecorations) free.set(id, (free.get(id) ?? 0) - 1);
    return DECORS_BY_CATEGORY.flat().filter((d) => (free.get(d.id) ?? 0) > 0).map((d) => ({ ...d, n: free.get(d.id)! }));
  };
  /** Where the decoration's bottom-left corner goes when the pointer is on (x, y): the pointer is on its middle. */
  const anchor = (id: number, t: Tile) => {
    const d = decorPlacing(id)!;
    return { x: t.x - Math.floor((d.w - 1) / 2), y: t.y + Math.floor((d.h - 1) / 2) };
  };

  const draw = () => {
    // Stays open across a redraw even when the toggle event that remembers it hasn't been handled yet.
    const wasOpen = !!wrap.querySelector('details')?.open, stripScroll = wrap.querySelector('.base-strip')?.scrollLeft ?? 0;
    clear(wrap);
    drag = null;
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
    const room = roomOf(base.id), kind = roomKind(base.id);
    const canvas = h('canvas', { class: 'base-room', width: room.w * T, height: room.h * T, role: 'img', 'aria-label': 'Secret base room' }) as HTMLCanvasElement;
    canvas.style.setProperty('--w', String(room.w * T));
    canvas.style.setProperty('--h', String(room.h * T));
    const free = spare();
    if (!free.some((d) => d.id === placing)) placing = free[0]?.id ?? 0;

    /** The room as it would look: a decoration being dragged shown where it would land, outlined green or red. */
    const paint = () => {
      let decor = base.decor, outline: { p: PlacedDecoration; ok: boolean } | null = null;
      if (drag && 'index' in drag && drag.to) {
        const index = drag.index, moved = moveDecor(base.id, base.decor, index, drag.to.x, drag.to.y);
        const p = { id: base.decor[index].id, ...drag.to };
        decor = typeof moved === 'string' ? base.decor.map((q, k) => (k === index ? p : q)) : moved;
        outline = { p, ok: typeof moved !== 'string' };
      } else if (drag && 'id' in drag && drag.to) {
        const p = { id: drag.id, ...drag.to };
        outline = { p, ok: cantPlace(base.id, base.decor, p.id, p.x, p.y) === null };
        decor = [...base.decor, p];
      } else if (!drag && hover && placing && picked < 0) {
        // Where a tap would set the chosen decoration out (nothing when the tap would pick a decoration instead).
        const p = { id: placing, ...anchor(placing, hover) }, ok = cantPlace(base.id, base.decor, p.id, p.x, p.y) === null;
        if (ok || decorAt(base.decor, hover.x, hover.y) < 0) outline = { p, ok };
      }
      paintRoom(canvas, base.id, decor, picked >= 0 && !drag ? base.decor[picked] : null, outline, paint);
    };
    const tileAt = (e: PointerEvent): Tile | null => {
      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientY < r.top || e.clientX >= r.right || e.clientY >= r.bottom) return null;
      return { x: Math.floor((e.clientX - r.left) / r.width * room.w), y: Math.floor((e.clientY - r.top) / r.height * room.h) };
    };
    const place = (id: number, at: Tile) => {
      const why = cantPlace(base.id, base.decor, id, at.x, at.y);
      if (why) { note = why; return false; }
      base.decor.push({ id, ...at });
      note = '';
      markDirty();
      return true;
    };

    // In the room: press on a decoration and drag to move it; a press that doesn't move is a tap.
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      const t = tileAt(e);
      if (!t) return;
      const hit = decorAt(base.decor, t.x, t.y);
      // With a decoration chosen in the strip, a tap where it can go sets it out, even on a desk (a doll, say).
      const settable = placing && picked < 0 && cantPlace(base.id, base.decor, placing, anchor(placing, t).x, anchor(placing, t).y) === null;
      if (hit < 0 || settable) return;
      const p = base.decor[hit];
      drag = { index: hit, grab: { x: p.x - t.x, y: p.y - t.y }, from: t, to: null };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const t = tileAt(e);
      if (drag && 'index' in drag) {
        if (t && (drag.to || t.x !== drag.from.x || t.y !== drag.from.y)) {
          const to = { x: t.x + drag.grab.x, y: t.y + drag.grab.y };
          if (drag.to?.x !== to.x || drag.to?.y !== to.y) { drag.to = to; paint(); }
        }
        return;
      }
      if (e.pointerType !== 'mouse') return;
      if (hover?.x !== t?.x || hover?.y !== t?.y) { hover = t; paint(); }
    });
    canvas.addEventListener('pointerleave', () => { if (!drag) { hover = null; paint(); } });
    canvas.addEventListener('pointercancel', () => { drag = null; paint(); });
    canvas.addEventListener('pointerup', (e) => {
      const d = drag;
      drag = null;
      if (d && 'index' in d) {
        if (d.to) {
          const p = base.decor[d.index];
          if (d.to.x !== p.x || d.to.y !== p.y) {
            const moved = moveDecor(base.id, base.decor, d.index, d.to.x, d.to.y);
            if (typeof moved === 'string') note = moved;
            else { base.decor = moved; note = ''; markDirty(); }
          }
          picked = -1;
        } else {
          picked = picked === d.index ? -1 : d.index;
          note = '';
        }
        draw();
        return;
      }
      const t = tileAt(e);
      if (!t) return;
      if (picked >= 0) { picked = -1; note = ''; draw(); return; }
      if (placing) {
        if (place(placing, anchor(placing, t)) && !spare().some((f) => f.id === placing)) placing = 0;
        draw();
      }
    });

    // The strip: tap a picture to choose it, or drag it into the room. Sideways drags scroll the strip.
    const strip = h('div', { class: 'base-strip', role: 'group', 'aria-label': 'Spare decorations in the PC' },
      free.map((f) => {
        const size = thumbSize(f.id);
        const thumb = h('canvas', { width: size.w, height: size.h }) as HTMLCanvasElement;
        thumb.style.setProperty('--w', String(size.w));
        thumb.style.setProperty('--h', String(size.h));
        const btn = h('button', {
          class: `base-thumb${f.id === placing ? ' chosen' : ''}`, 'aria-pressed': String(f.id === placing),
          'aria-label': f.n > 1 ? `${f.name} (${f.n})` : f.name, title: f.name,
          onclick: () => { if (placing !== f.id) { placing = f.id; picked = -1; note = ''; draw(); } },
        }, thumb, f.n > 1 ? h('span', { class: 'base-thumb-n' }, `×${f.n}`) : '');
        paintThumb(thumb, kind, f.id, () => paintThumb(thumb, kind, f.id, () => {}));
        btn.addEventListener('pointerdown', (e) => {
          if (e.button > 0) return;
          drag = { id: f.id, to: null, moved: false };
          btn.setPointerCapture(e.pointerId);
        });
        btn.addEventListener('pointermove', (e) => {
          if (!drag || !('id' in drag)) return;
          const t = tileAt(e);
          drag.moved ||= !!t;
          const to = t ? anchor(drag.id, t) : null;
          if (drag.to?.x !== to?.x || drag.to?.y !== to?.y) { drag.to = to; paint(); }
        });
        btn.addEventListener('pointercancel', () => { drag = null; paint(); });
        // Chosen here rather than on click, which a touch doesn't always get once the button has the pointer; the
        // redraw takes this button away, so a click that does follow goes nowhere. Keys still use onclick.
        btn.addEventListener('pointerup', () => {
          const d = drag;
          drag = null;
          if (!d || !('id' in d) || (!d.moved && placing === d.id)) return;
          placing = d.id;
          picked = -1;
          note = '';
          if (d.to && place(d.id, d.to) && !spare().some((x) => x.id === d.id)) placing = 0;
          draw();
        });
        return btn;
      }));

    const chosen = free.find((f) => f.id === placing);
    const info = picked >= 0
      ? h('div', { class: 'item-row base-picked' },
        h('span', {}, decorName(base.decor[picked].id)),
        h('button', {
          onclick: () => { base.decor = withoutDecor(base.id, base.decor, picked); picked = -1; markDirty(); draw(); },
        }, 'Put away'))
      : h('div', { class: 'item-row base-place' },
        h('span', {}, chosen ? chosen.name : h('span', { class: 'muted' }, 'No spare decorations in the PC')),
        chosen ? h('span', { class: 'muted' }, 'Drag it into the room, or tap the room') : '');
    // Twice the size where the room fits that way, else once (whole screen pixels either way, see styles.css).
    const view = h('div', { class: 'base-view' }, canvas);
    new ResizeObserver(() => canvas.classList.toggle('x2', view.clientWidth >= room.w * T * 2)).observe(view);
    wrap.append(folded(
      spot,
      view,
      info,
      note ? h('p', { class: 'muted base-note', role: 'status' }, note) : '',
      free.length ? strip : '',
      h('div', { class: 'button-row' },
        h('button', { disabled: !base.decor.length, onclick: () => { base.decor = []; picked = -1; markDirty(); draw(); } }, 'Put everything away'))));
    paint();
    strip.scrollLeft = stripScroll;
  };
  draw();
  onRedraw(draw);
  return wrap;
}

/** Draws decorations' metatiles (in the room's colours) with their bottom-left corner at tile (x, y) of a canvas. */
function tilesOf(ctx: CanvasRenderingContext2D, tiles: HTMLImageElement, id: number, x: number, y: number): void {
  const d = decorPlacing(id)!;
  for (let j = 0; j < d.h; j++) {
    for (let i = 0; i < d.w; i++) {
      const m = d.tiles[j * d.w + i];
      ctx.drawImage(tiles, (m % 16) * T, Math.floor(m / 16) * T, T, T, (x + i) * T, (y - d.h + 1 + j) * T, T, T);
    }
  }
}

/** A doll or cushion standing on tile (x, y): centred, feet on its bottom edge. */
function spriteOf(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number): void {
  ctx.drawImage(img, x * T + T / 2 - img.naturalWidth / 2, (y + 1) * T - img.naturalHeight);
}

function paintThumb(canvas: HTMLCanvasElement, kind: string, id: number, again: () => void): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { w, h: ht } = thumbSize(id), d = decorPlacing(id)!;
  ctx.clearRect(0, 0, w, ht);
  if (d.perm === 'sprite') {
    const img = image(decorSpriteUrl(id), again);
    if (ready(img)) ctx.drawImage(img, (w - img.naturalWidth) / 2, (ht - img.naturalHeight) / 2);
    return;
  }
  const tiles = image(secretBaseTilesUrl(kind), again);
  if (!ready(tiles)) return;
  ctx.save();
  ctx.translate((w - d.w * T) / 2, (ht - d.h * T) / 2);
  tilesOf(ctx, tiles, id, 0, d.h - 1);
  ctx.restore();
}

function paintRoom(canvas: HTMLCanvasElement, baseId: number, decor: PlacedDecoration[], picked: PlacedDecoration | null,
  outline: { p: PlacedDecoration; ok: boolean } | null, again: () => void): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const room = roomOf(baseId);
  const tiles = image(secretBaseTilesUrl(roomKind(baseId)), again);
  if (!ready(tiles)) return;
  laidOut(baseId, decor).forEach((m, i) =>
    ctx.drawImage(tiles, (m % 16) * T, Math.floor(m / 16) * T, T, T, (i % room.w) * T, Math.floor(i / room.w) * T, T, T));
  // The nearer dolls stand in front.
  for (const p of decor.filter((q) => isSpriteDecor(q.id)).sort((a, b) => a.y - b.y)) {
    const img = image(decorSpriteUrl(p.id), again);
    if (ready(img)) spriteOf(ctx, img, p.x, p.y);
  }
  const box = (p: PlacedDecoration, color: string, fill: string) => {
    const d = decorPlacing(p.id)!;
    const left = p.x * T, top = (p.y - d.h + 1) * T;
    ctx.fillStyle = fill;
    ctx.fillRect(left, top, d.w * T, d.h * T);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, d.w * T - 1, d.h * T - 1);
  };
  if (picked) box(picked, '#ffffff', 'rgba(255,255,255,0.25)');
  if (outline) box(outline.p, outline.ok ? '#30d158' : '#ff453a', outline.ok ? 'rgba(48,209,88,0.25)' : 'rgba(255,69,58,0.3)');
}
