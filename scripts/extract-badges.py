"""One-off: cut the eight Kanto badge sprites out of the Red/Blue "Trainer Card" sheet (344x661) from
The Spriters Resource (ripped by FrenchOrange), using the bottom-left Super Game Boy colour panel.

    python3 scripts/extract-badges.py path/to/trainer-card.png

Writes assets/sprites/badges/1.png ... 8.png (16x16, transparent background).
The finished files are committed, so you only need this to redo the cut. Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

BG = (248, 232, 248, 255)          # panel background in the SGB colour version
COLS = [32, 64, 96, 128]           # left edge of each 16x16 badge cell
ROWS = [581, 605]                  # top edge of each row

def knock_out_background(cell: Image.Image) -> Image.Image:
    """Make the background transparent, but only where it touches the cell edge (4-connected), so light
    pixels enclosed by a badge's outline stay opaque."""
    px = cell.load()
    w, h = cell.size
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    seen = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h) or px[x, y] != BG:
            continue
        seen.add((x, y))
        px[x, y] = (0, 0, 0, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return cell

sheet = Image.open(sys.argv[1]).convert('RGBA')
out = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'badges'
out.mkdir(parents=True, exist_ok=True)
n = 0
for y in ROWS:
    for x in COLS:
        n += 1
        knock_out_background(sheet.crop((x, y, x + 16, y + 16))).save(out / f'{n}.png')
print(f'Wrote {n} badges to {out}')
