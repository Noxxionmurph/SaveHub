"""One-off: cut the eight Hoenn badges from the pret/pokeemerald disassembly's trainer card sheet
(graphics/trainer_card/badges.png: 128x16, one 16x16 badge per column, Stone to Rain), in the sheet's own colours
(the palette the game loads for them), with colour 0 made transparent.

    python3 scripts/extract-hoenn-badges.py path/to/pokeemerald/graphics/trainer_card/badges.png

Writes assets/sprites/badges/hoenn/1.png ... 8.png (16x16).
The finished files live in the artwork repository (checked out as ./assets/), so you only need this to redo them.
Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

sheet = Image.open(sys.argv[1])
if sheet.size != (128, 16) or sheet.mode != 'P':
    sys.exit(f'expected a 128x16 indexed sheet, got {sheet.size[0]}x{sheet.size[1]} {sheet.mode}')
pal = sheet.getpalette()
out = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'badges' / 'hoenn'
out.mkdir(parents=True, exist_ok=True)
for n in range(8):
    cell = sheet.crop((n * 16, 0, n * 16 + 16, 16))
    img = Image.new('RGBA', (16, 16))
    img.putdata([(0, 0, 0, 0) if p == 0 else (*pal[p * 3:p * 3 + 3], 255) for p in cell.getdata()])
    img.save(out / f'{n + 1}.png')
print(f'Wrote 8 badges to {out}')
