"""One-off: cut Pikachu's talk-to reactions out of the "Pikachu's moods (ranked from least to most happy)" sheet on
Serebii (https://www.serebii.net/yellow/pikachu.shtml, 242 px wide), which is built from Pokémon Yellow's own
40x40 pictures in the game's Super Game Boy colours.

    python3 scripts/extract-pikachu.py path/to/pikachu-moods.png [path/to/output.png]

Writes assets/sprites/pikachu.png (by default): 80 px wide, one 40 px row for each of the 18 reactions the game
can pick when you talk to your starter Pikachu, frame 1 on the left and frame 2 on the right, in four colours.
One file keeps the page to a single request. The rows are in the sheet's order, least to most happy, and
src/core/gen1/data.ts (REACTIONS) lists them in that same order; test/yellow.test.ts checks the two agree.
Where a frame is also in the pokeyellow disassembly (gfx/pikachu/*.png) the pixels are identical, and that is
how rows were matched to names; Jump and Heart match by elimination and by eye.
The finished file is committed, so you only need this to redo the cut. Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

# Row i of Serebii's sheet starts at y = 52 + 56 * i. Frame 1 is at x = 17 and frame 2 at x = 73. Names are the
# game's animation names, in kebab-case.
NAMES = [
    "angry-bolt", "side-blink", "side", "back-turn", "sad", "bored", "ear-twitch", "blink", "smile",
    "happy", "fist-pump", "mad", "jump", "excited", "heart", "joy", "two-hearts", "love",
]
TOP, PITCH, FRAME_X, SIZE = 52, 56, (17, 73), 40
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "assets" / "sprites" / "pikachu.png"


def main(sheet_path: str, out_path: Path = DEFAULT_OUT) -> None:
    sheet = Image.open(sheet_path).convert("RGB")
    out = Image.new("RGB", (SIZE * len(FRAME_X), SIZE * len(NAMES)))
    for i in range(len(NAMES)):
        for n, x in enumerate(FRAME_X):
            y = TOP + PITCH * i
            out.paste(sheet.crop((x, y, x + SIZE, y + SIZE)), (SIZE * n, SIZE * i))
    packed = out.quantize(colors=4, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    if len(out.getcolors()) != 4:
        sys.exit(f"expected the game's 4 colours, found {len(out.getcolors())}: is this the right sheet?")
    packed.save(out_path, optimize=True)
    print(f"wrote {len(NAMES)} reactions (2 frames each) to {out_path}")


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(sys.argv[1], Path(sys.argv[2]) if len(sys.argv) == 3 else DEFAULT_OUT)
