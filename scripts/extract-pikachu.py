"""One-off: cut Pikachu's talk-to reactions out of the "Pikachu's moods (ranked from least to most happy)" sheet on
Serebii (https://www.serebii.net/yellow/pikachu.shtml, 242 px wide), which is built from Pokémon Yellow's own
40x40 pictures in the game's Super Game Boy colours.

    python3 scripts/extract-pikachu.py path/to/pikachu-moods.png

Writes assets/sprites/pikachu/<name>-1.png and <name>-2.png (40x40, four colours): the two frames of each of the
18 reactions the game can pick when you talk to your starter Pikachu. Rows are in the sheet's order, least to most
happy. Where a frame is also in the pokeyellow disassembly (gfx/pikachu/*.png) the pixels are identical, and
that is how rows were matched to names; Jump and Heart match by elimination and by eye.
The finished files are committed, so you only need this to redo the cut. Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

# Row i starts at y = 52 + 56 * i. Frame 1 is at x = 17 and frame 2 at x = 73. Names are the game's animation names.
NAMES = [
    "angry-bolt", "side-blink", "side", "back-turn", "sad", "bored", "ear-twitch", "blink", "smile",
    "happy", "fist-pump", "mad", "jump", "excited", "heart", "joy", "two-hearts", "love",
]
TOP, PITCH, FRAME_X, SIZE = 52, 56, (17, 73), 40


def main(sheet_path: str) -> None:
    sheet = Image.open(sheet_path).convert("RGB")
    out = Path(__file__).resolve().parent.parent / "assets" / "sprites" / "pikachu"
    out.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(NAMES):
        y = TOP + PITCH * i
        for n, x in enumerate(FRAME_X, start=1):
            frame = sheet.crop((x, y, x + SIZE, y + SIZE))
            frame.quantize(colors=4, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out / f"{name}-{n}.png", optimize=True)
    print(f"wrote {len(NAMES) * 2} pictures to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
