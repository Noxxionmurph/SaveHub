"""One-off: colour the pret/pokeemerald disassembly's 8x8 Pokéblock (graphics/pokeblock/pokeblock.png) in each of the
14 palettes the game uses for it (red.pal ... gold.pal next to it, in PBLOCK_CLR order), with colour 0 made transparent.

    python3 scripts/extract-pokeblocks.py path/to/pokeemerald/graphics/pokeblock

Writes assets/sprites/pokeblocks/1.png ... 14.png (8x8), numbered by the colour the save stores (1 red ... 14 gold).
The finished files live in the artwork repository (checked out as ./assets/), so you only need this to redo them.
Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

COLOURS = ['red', 'blue', 'pink', 'green', 'yellow', 'purple', 'indigo', 'brown', 'liteblue', 'olive', 'gray', 'black',
           'white', 'gold']

src = Path(sys.argv[1])
block = Image.open(src / 'pokeblock.png')
if block.size != (8, 8) or block.mode != 'P':
    sys.exit(f'expected an 8x8 indexed picture, got {block.size[0]}x{block.size[1]} {block.mode}')


def jasc(path: Path) -> list[tuple[int, int, int]]:
    lines = path.read_text().split()
    return [tuple(int(v) for v in lines[3 + i * 3:6 + i * 3]) for i in range(int(lines[2]))]


out = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'pokeblocks'
out.mkdir(parents=True, exist_ok=True)
for n, name in enumerate(COLOURS, 1):
    pal = jasc(src / f'{name}.pal')
    img = Image.new('RGBA', (8, 8))
    img.putdata([(0, 0, 0, 0) if p == 0 else (*pal[p], 255) for p in block.getdata()])
    img.save(out / f'{n}.png')
print(f'Wrote {len(COLOURS)} Pokéblocks to {out}')
