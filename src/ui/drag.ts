// Drag and drop built on pointer events, because the browser's own drag and drop doesn't work on touch screens.
//
//  - Mouse: press, then move a few pixels.
//  - Touch and pen: press and hold for a moment, so swiping across the page still scrolls it.
//  - Once something is picked up, a ghost copy follows the pointer, the spot under it is highlighted, the page
//    scrolls when the pointer nears the top or bottom edge, and holding over a `data-nav` target repeats `onNav`
//    (used to turn box pages without letting go).
//
// The module knows nothing about Pokémon: things that can be picked up carry `data-pick` and `data-slot`, things
// that accept a drop carry `data-slot`, and `onDrop` gets the two slot strings. Listeners sit on a container that
// outlives redraws, so the lists inside it can be rebuilt freely, even in the middle of a drag.

import { h } from './dom.ts';

export interface DragConfig {
  /** Stable element around everything draggable. Its children may be replaced at any time. */
  root: HTMLElement;
  /** Picked up from here. Elements matching this need a `data-slot`. */
  pick: string;
  /** Dropped on here. Elements matching this need a `data-slot` (a spot) or a `data-nav` (-1 or 1: hold to turn the page). */
  drop: string;
  onDrop: (from: string, to: string) => void;
  onNav?: (direction: number) => void;
}

export interface DragHandle {
  /** The slot being dragged right now, so a redraw can keep showing it as lifted. */
  lifted(): string | null;
}

const HOLD_MS = 260; // press-and-hold before a touch picks something up
const SLOP_MOUSE = 4; // px of movement that starts a mouse drag
const SLOP_TOUCH = 10; // px of movement during the hold that means "this is a scroll"
const NAV_FIRST_MS = 450;
const NAV_REPEAT_MS = 800;
const EDGE = 44; // px from the top and bottom of the screen where the page starts scrolling...
const EDGE_DWELL_MS = 250; // ...once the pointer has stayed there this long, so passing through to reach a cell doesn't scroll

interface Pending { el: HTMLElement; slot: string; id: number; x: number; y: number; type: string; timer: number; off: () => void }
interface Live { edgeSince: number; slot: string; id: number; ghost: HTMLElement; gw: number; gh: number; x: number; y: number; over: HTMLElement | null; nav: string | null; navTimer: number; raf: number }

export function enableDrag(cfg: DragConfig): DragHandle {
  let pending: Pending | null = null;
  let live: Live | null = null;
  let quietUntil = 0; // the click that follows a drag is swallowed

  const slotOf = (el: Element | null | undefined) => (el as HTMLElement | null | undefined)?.dataset?.slot ?? null;

  function down(e: PointerEvent): void {
    if (pending || live || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = (e.target as Element).closest<HTMLElement>(cfg.pick);
    const slot = slotOf(el);
    if (!el || slot === null || !cfg.root.contains(el)) return;
    // Once lifted, the finger drags instead of scrolling. This has to be a non-passive listener on the element the
    // touch started on, which keeps receiving the touch even if a redraw detaches it.
    const block = (te: TouchEvent) => { if (live) te.preventDefault(); };
    el.addEventListener('touchmove', block, { passive: false });
    pending = {
      el, slot, id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType, timer: 0,
      off: () => el.removeEventListener('touchmove', block),
    };
    if (e.pointerType !== 'mouse') pending.timer = window.setTimeout(() => lift(), HOLD_MS);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
  }

  function lift(): void {
    const p = pending;
    if (!p) return;
    clearTimeout(p.timer);
    const img = p.el.querySelector<HTMLImageElement>('img.mon-icon');
    const size = Math.min(72, p.el.getBoundingClientRect().width);
    const ghost = h('div', { class: 'drag-ghost', 'aria-hidden': 'true' });
    ghost.style.width = `${size}px`;
    if (img) ghost.append(img.cloneNode(true));
    document.body.append(ghost);
    // Capture on the stable root, not the cell: a redraw can remove the cell and the drag must carry on.
    try { cfg.root.setPointerCapture(p.id); } catch { /* the pointer already ended */ }
    live = { edgeSince: 0, slot: p.slot, id: p.id, ghost, gw: ghost.offsetWidth, gh: ghost.offsetHeight, x: p.x, y: p.y, over: null, nav: null, navTimer: 0, raf: 0 };
    p.el.classList.add('lifted');
    document.body.classList.add('dragging');
    navigator.vibrate?.(12);
    place();
    hover();
    live.raf = requestAnimationFrame(scrollLoop);
  }

  function move(e: PointerEvent): void {
    if (e.pointerId !== (live?.id ?? pending?.id)) return;
    if (live) {
      live.x = e.clientX; live.y = e.clientY;
      e.preventDefault();
      place();
      hover();
      return;
    }
    if (!pending) return;
    const dist = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
    if (pending.type === 'mouse') {
      if (dist > SLOP_MOUSE) { pending.x = e.clientX; pending.y = e.clientY; lift(); }
    } else if (dist > SLOP_TOUCH) {
      end(); // the finger moved before the hold finished: that's a scroll, leave it to the browser
    }
  }

  function up(e: PointerEvent): void {
    if (e.pointerId !== (live?.id ?? pending?.id)) return;
    const from = live?.slot ?? null;
    const to = live ? slotOf(live.over) : null;
    const dragged = live !== null;
    end();
    if (dragged) quietUntil = Date.now() + 400;
    if (from !== null && to !== null && to !== from) cfg.onDrop(from, to);
  }

  function cancel(e: PointerEvent): void {
    if (e.pointerId === (live?.id ?? pending?.id)) end();
  }

  function key(e: KeyboardEvent): void {
    if (e.key === 'Escape' && live) { quietUntil = Date.now() + 400; end(); }
  }

  function end(): void {
    const l = live;
    const p = pending;
    live = null;
    pending = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', key);
    if (p) { clearTimeout(p.timer); p.off(); p.el.classList.remove('lifted'); }
    if (l) {
      clearTimeout(l.navTimer);
      cancelAnimationFrame(l.raf);
      l.ghost.remove();
      l.over?.classList.remove('drop-over');
      try { cfg.root.releasePointerCapture(l.id); } catch { /* already released */ }
      cfg.root.querySelectorAll('.lifted, .drop-over').forEach((el) => el.classList.remove('lifted', 'drop-over'));
    }
    document.body.classList.remove('dragging');
  }

  function place(): void {
    if (!live) return;
    live.ghost.style.transform = `translate(${Math.round(live.x - live.gw / 2)}px, ${Math.round(live.y - live.gh / 2)}px) scale(1.15)`;
  }

  /** Highlight what is under the pointer, and run the hold-to-turn-the-page timer over a `data-nav` target. */
  function hover(): void {
    const l = live;
    if (!l) return;
    const target = document.elementFromPoint(l.x, l.y)?.closest<HTMLElement>(cfg.drop) ?? null;
    const spot = target && target.dataset.slot !== undefined && target.dataset.slot !== l.slot && cfg.root.contains(target) ? target : null;
    if (spot !== l.over) {
      l.over?.classList.remove('drop-over');
      spot?.classList.add('drop-over');
      l.over = spot;
    }
    // Compared by direction, not by element: turning the page redraws the buttons, and the hold should carry on.
    const nav = target?.dataset.nav ?? null;
    if (nav !== l.nav) {
      clearTimeout(l.navTimer);
      l.nav = nav;
      if (nav) l.navTimer = window.setTimeout(turn, NAV_FIRST_MS);
    }
  }

  function turn(): void {
    const l = live;
    if (!l || !l.nav) return;
    cfg.onNav?.(Number(l.nav));
    l.over = null; // the grid was just rebuilt
    l.navTimer = window.setTimeout(turn, NAV_REPEAT_MS);
    requestAnimationFrame(hover);
  }

  /** Scroll the page while the pointer rests within EDGE of the top or bottom of the screen. */
  function scrollLoop(now: number): void {
    const l = live;
    if (!l) return;
    const top = EDGE - l.y;
    const bottom = l.y - (window.innerHeight - EDGE);
    if (top > 0 || bottom > 0) {
      l.edgeSince ||= now;
      if (now - l.edgeSince > EDGE_DWELL_MS) {
        const speed = Math.min(12, Math.max(top, bottom) / 3 + 2);
        window.scrollBy(0, top > 0 ? -speed : speed);
        hover();
      }
    } else {
      l.edgeSince = 0;
    }
    l.raf = requestAnimationFrame(scrollLoop);
  }

  cfg.root.addEventListener('pointerdown', down);
  // The click after a drag would open the menu of whatever is under the pointer; swallow it.
  cfg.root.addEventListener('click', (e) => { if (Date.now() < quietUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  // A long press must not open the browser's context menu (Android) or image callout (iOS).
  cfg.root.addEventListener('contextmenu', (e) => { if (pending || live) e.preventDefault(); });

  return { lifted: () => live?.slot ?? null };
}
