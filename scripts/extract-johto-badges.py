"""One-off: colour the eight Johto badges from the pret/pokegold disassembly's trainer card sheet
(gfx/trainer_card/badges.png: 16x176 greyscale, one 16x16 badge per row in the order the game stores their bits,
Zephyr to Rising, then three sparkle frames), using the game's own badge palette (PREDEFPAL_CGB_BADGE).

    python3 scripts/extract-johto-badges.py path/to/pokegold/gfx/trainer_card/badges.png

Writes assets/sprites/badges/johto/1.png ... 8.png (16x16, the lightest shade made transparent).
The finished files live in the artwork repository (checked out as ./assets/), so you only need this to redo them.
Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

# pokegold gfx/cgb/predef.pal, PREDEFPAL_CGB_BADGE: RGB 31,31,31 / 26,21,22 / 15,15,18 / 00,00,00 (5-bit channels).
PALETTE = [(31, 31, 31), (26, 21, 22), (15, 15, 18), (0, 0, 0)]
to8 = lambda c: tuple((v << 3) | (v >> 2) for v in c)

sheet = Image.open(sys.argv[1]).convert('L')
if sheet.size != (16, 176):
    sys.exit(f'expected a 16x176 sheet, got {sheet.size[0]}x{sheet.size[1]}')
# The sheet uses the standard 2bpp greys (255, 170, 85, 0): place each by value, not rank, so a badge without the
# lightest shade still maps right.
shade = {g: min(3, round((255 - g) / 85)) for g in set(sheet.getdata())}

out = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'badges' / 'johto'
out.mkdir(parents=True, exist_ok=True)
for n in range(8):
    cell = sheet.crop((0, n * 16, 16, n * 16 + 16))
    img = Image.new('RGBA', (16, 16))
    img.putdata([(0, 0, 0, 0) if shade[p] == 0 else (*to8(PALETTE[shade[p]]), 255) for p in cell.getdata()])
    img.save(out / f'{n + 1}.png')
print(f'Wrote 8 badges to {out}')
