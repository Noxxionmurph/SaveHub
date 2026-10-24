// The SaveForge mark: a pixel cartridge, drawn from rects so it stays crisp at any size.
// Colors come from CSS tokens (see .cart in styles.css), so it follows the light/dark theme.

const NS = 'http://www.w3.org/2000/svg';

const PIXELS: [cls: string, x: number, y: number, w: number, h: number][] = [
  ['c-body', 1, 0, 10, 1],
  ['c-body', 0, 1, 12, 11],
  ['c-shade', 0, 9, 12, 1],
  ['c-label', 2, 2, 8, 6],
  ['c-ink', 3, 3, 6, 1],
  ['c-ink', 3, 5, 4, 1],
  ['c-pin', 2, 12, 1, 2],
  ['c-pin', 4, 12, 1, 2],
  ['c-pin', 7, 12, 1, 2],
  ['c-pin', 9, 12, 1, 2],
];

/** A cartridge icon `heightPx` tall (width follows the 12:14 ratio). Decorative: hidden from screen readers. */
export function cartridge(heightPx: number, extraClass = ''): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 14');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `cart ${extraClass}`.trim());
  svg.setAttribute('height', String(heightPx));
  svg.setAttribute('width', String(Math.round((heightPx * 12) / 14)));
  for (const [cls, x, y, w, h] of PIXELS) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('class', cls);
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(w));
    r.setAttribute('height', String(h));
    svg.append(r);
  }
  return svg;
}
