"""One-off: cut Emerald's seven Battle Frontier symbols from the pret/pokeemerald disassembly's Frontier Pass sheet
(graphics/frontier_pass/medals.png: 16x112, one 16x16 symbol per row, Tower to Pyramid), once in each of the two
palettes the game loads for them (silver.pal and gold.pal next to it), with colour 0 made transparent.

    python3 scripts/extract-frontier-symbols.py path/to/pokeemerald/graphics/frontier_pass

Writes assets/sprites/frontier/silver-1.png ... silver-7.png and gold-1.png ... gold-7.png (16x16).
The finished files live in the artwork repository (checked out as ./assets/), so you only need this to redo them.
Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

src = Path(sys.argv[1])
sheet = Image.open(src / 'medals.png')
if sheet.size != (16, 112) or sheet.mode != 'P':
    sys.exit(f'expected a 16x112 indexed sheet, got {sheet.size[0]}x{sheet.size[1]} {sheet.mode}')


def jasc(path: Path) -> list[tuple[int, int, int]]:
    lines = path.read_text().split()
    return [tuple(int(v) for v in lines[3 + i * 3:6 + i * 3]) for i in range(int(lines[2]))]


out = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'frontier'
out.mkdir(parents=True, exist_ok=True)
for metal in ('silver', 'gold'):
    pal = jasc(src / f'{metal}.pal')
    for n in range(7):
        cell = sheet.crop((0, n * 16, 16, n * 16 + 16))
        img = Image.new('RGBA', (16, 16))
        img.putdata([(0, 0, 0, 0) if p == 0 else (*pal[p], 255) for p in cell.getdata()])
        img.save(out / f'{metal}-{n + 1}.png')
print(f'Wrote 14 symbols to {out}')
