// Just enough PNG reading (8-bit, non-interlaced, any colour type) to find where a sprite's visible pixels
// sit inside its canvas. No dependencies: Node's zlib does the inflating.
import { inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Visible-pixel bounds { x0, y0, x1, y1 } (x1/y1 exclusive) plus the canvas size, for pixels with alpha > threshold. */
export function visibleBounds(png, threshold = 8) {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  let palette = null, trns = null;
  const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const kind = png.toString('latin1', pos + 4, pos + 8);
    const body = png.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (kind === 'PLTE') palette = body;
    else if (kind === 'tRNS') trns = body;
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || !(type in CHANNELS)) throw new Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace})`);
  const bpp = CHANNELS[type];
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const rows = [];
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = (line[i] + add) & 0xff;
    }
    rows.push(line);
    prev = line;
  }
  const alphaAt = (x, y) => {
    const row = rows[y];
    if (type === 6) return row[x * 4 + 3];
    if (type === 4) return row[x * 2 + 1];
    if (type === 3) return trns && row[x] < trns.length ? trns[row[x]] : 255;
    return 255;
  };
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) > threshold) { if (x < x0) x0 = x; if (x + 1 > x1) x1 = x + 1; if (y < y0) y0 = y; if (y + 1 > y1) y1 = y + 1; }
    }
  }
  void palette;
  return { x0, y0, x1, y1, width, height };
}

/** How far the visible art's centre is from the canvas centre, in pixels (positive = right / down). */
export function centreOffset(png) {
  const b = visibleBounds(png);
  return { dx: (b.x0 + b.x1) / 2 - b.width / 2, dy: (b.y0 + b.y1) / 2 - b.height / 2, width: b.width, height: b.height };
}
