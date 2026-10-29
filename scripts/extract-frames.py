"""One-off: the window frames from the OPTION menu's FRAME setting, as 24x24 nine-slice pictures (3x3 tiles of 8x8:
corners, edges and the middle), which src/ui/windowFrame.ts paints round the big windows.

    python3 scripts/extract-frames.py path/to/pokecrystal path/to/pokeruby path/to/pokeemerald

Gen 2 (Gold, Silver and Crystal share them): pret/pokecrystal's gfx/frames/1.png ... 8.png are six 1bpp tiles each,
in the order the game names them (┌ ─ ┐ │ └ ┘). The game draws the top and bottom with the same ─ tile and both sides
with the same │ tile, so that is what goes on each edge here. The ink is black and the paper transparent, so the
editor can draw the frame in the window's own ink on the window's own colour. The middle is left empty.

Gen 3: pret/pokeruby's and pret/pokeemerald's graphics/text_window/1.png ... 20.png are already 3x3 tiles in the
game's own colours. Colour 0 (what the game leaves see-through) is made transparent, and the colours are the ones the
GBA shows (5 bits a channel), since the two disassemblies round the same colour to different 8-bit values. Emerald
redrew nine of the twenty (5, 7, 9, 10, 12, 13, 14, 17 and 19, mostly an extra inner line), so Ruby and Sapphire get
their own set. The game never draws the middle tile (the inside of a window is plain white).

Writes assets/sprites/frames/gen2/1.png ... 8.png, frames/rs/1.png ... 20.png and
frames/emerald/1.png ... 20.png, numbered like the menu's TYPE 1, TYPE 2 ... The finished files live in the artwork
repository (checked out as ./assets/), so you only need this to redo them. Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

crystal, ruby, emerald = (Path(a) for a in sys.argv[1:4])
out = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'frames'

(out / 'gen2').mkdir(parents=True, exist_ok=True)
for n in range(1, 9):
    src = Image.open(crystal / 'gfx' / 'frames' / f'{n}.png').convert('L')
    if src.size != (24, 16):
        sys.exit(f'gen 2 frame {n}: expected 24x16, got {src.size[0]}x{src.size[1]}')
    tile = [src.crop(((i % 3) * 8, (i // 3) * 8, (i % 3) * 8 + 8, (i // 3) * 8 + 8)) for i in range(6)]
    tl, top, tr, side, bl, br = tile
    grid = [[tl, top, tr], [side, None, side], [bl, top, br]]
    pic = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    for y, row in enumerate(grid):
        for x, t in enumerate(row):
            if t is not None:
                pic.paste(Image.new('RGBA', (8, 8), (0, 0, 0, 255)), (x * 8, y * 8), t.point(lambda v: 255 if v < 128 else 0))
    pic.save(out / 'gen2' / f'{n}.png', optimize=True)

for game, disasm in (('rs', ruby), ('emerald', emerald)):
    (out / game).mkdir(parents=True, exist_ok=True)
    for n in range(1, 21):
        src = Image.open(disasm / 'graphics' / 'text_window' / f'{n}.png')
        if src.size != (24, 24) or src.mode != 'P':
            sys.exit(f'{game} frame {n}: expected a 24x24 indexed picture, got {src.size[0]}x{src.size[1]} {src.mode}')
        pal = [round((v >> 3) * 255 / 31) for v in src.getpalette()]
        pic = Image.new('RGBA', (24, 24))
        pic.putdata([(0, 0, 0, 0) if i == 0 else (*pal[i * 3:i * 3 + 3], 255) for i in src.getdata()])
        pic.save(out / game / f'{n}.png', optimize=True)

print(f'wrote 8 + 20 + 20 frames to {out}')
