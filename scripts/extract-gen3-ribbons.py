"""One-off: cut the 32 Gen 3 ribbons from the pret/pokeemerald disassembly's PokéNav ribbon sheet
(graphics/pokenav/ribbons/icons_big.png: 32x384, twelve 32x32 pictures, top to bottom: Champion, contest Normal,
Super, Hyper and Master, Winning, Victory, Artist, Effort and the three gift ribbons), each in the palette the game
gives that ribbon (icons1.pal to icons5.pal, as src/pokenav_ribbons_summary.c's sRibbonGfxData pairs them), with
colour 0 made transparent.

    python3 scripts/extract-gen3-ribbons.py path/to/pokeemerald/graphics/pokenav/ribbons

Writes assets/sprites/ribbons/gen3/0.png ... 31.png (32x32), numbered like the game's ribbon ids (CHAMPION_RIBBON 0,
COOL_RIBBON_NORMAL 1 ... WORLD_RIBBON 31).
The finished files live in the artwork repository (checked out as ./assets/), so you only need this to redo them.
Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

src = Path(sys.argv[1])
sheet = Image.open(src / 'icons_big.png')
if sheet.size != (32, 384) or sheet.mode != 'P':
    sys.exit(f'expected a 32x384 indexed sheet, got {sheet.size[0]}x{sheet.size[1]} {sheet.mode}')


def jasc(path: Path) -> list[tuple[int, int, int]]:
    lines = path.read_text().split()
    return [tuple(int(v) for v in lines[3 + i * 3:6 + i * 3]) for i in range(int(lines[2]))]


pals = [jasc(src / f'icons{n}.pal') for n in range(1, 6)]
CHAMPION, NORMAL, WINNING, VICTORY, ARTIST, EFFORT, GIFT1, GIFT2, GIFT3 = 0, 1, 5, 6, 7, 8, 9, 10, 11
# (picture, palette) for each ribbon id, from sRibbonGfxData.
ribbons = [(CHAMPION, 0)]
for pal in range(5):                       # Cool, Beauty, Cute, Smart, Tough
    ribbons += [(NORMAL + rank, pal) for rank in range(4)]
ribbons += [(WINNING, 0), (VICTORY, 0), (ARTIST, 1), (EFFORT, 2), (GIFT1, 1), (GIFT1, 3), (GIFT1, 4), (GIFT2, 3),
            (GIFT2, 4), (GIFT3, 0), (GIFT3, 1)]
assert len(ribbons) == 32

out = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'ribbons' / 'gen3'
out.mkdir(parents=True, exist_ok=True)
for rid, (pic, pal) in enumerate(ribbons):
    cell = sheet.crop((0, pic * 32, 32, pic * 32 + 32))
    img = Image.new('RGBA', (32, 32))
    img.putdata([(0, 0, 0, 0) if p == 0 else (*pals[pal][p], 255) for p in cell.getdata()])
    img.save(out / f'{rid}.png')
print(f'Wrote 32 ribbons to {out}')
