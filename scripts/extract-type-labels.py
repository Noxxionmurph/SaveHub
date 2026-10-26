"""One-off: the in-game type labels (the type's name in a coloured box, as on Ruby, Sapphire and Emerald's summary
screen) from the pret/pokeemerald disassembly (graphics/types/<type>.png: 32x16, indexed, each file carrying the
palette the game gives it). Gen 1 and Gen 2 have no coloured type labels of their own, so these stand in for them.

    python3 scripts/extract-type-labels.py path/to/pokeemerald/graphics/types

Writes assets/sprites/type-labels/<type>.png (32x16 RGBA, colour 0 made transparent), named the way the editor names
types ("fighting", not pokeemerald's "fight"), with "unknown" for Gen 2's ??? type (Curse).
The finished files live in the artwork repository (checked out as ./assets/), so you only need this to redo them.
Needs Pillow."""
import sys
from pathlib import Path
from PIL import Image

NAMES = {
    'normal': 'normal', 'fight': 'fighting', 'flying': 'flying', 'poison': 'poison', 'ground': 'ground', 'rock': 'rock',
    'bug': 'bug', 'ghost': 'ghost', 'steel': 'steel', 'fire': 'fire', 'water': 'water', 'grass': 'grass',
    'electric': 'electric', 'psychic': 'psychic', 'ice': 'ice', 'dragon': 'dragon', 'dark': 'dark', 'mystery': 'unknown',
}

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'type-labels'
out.mkdir(parents=True, exist_ok=True)
for name, ours in NAMES.items():
    img = Image.open(src / f'{name}.png')
    if img.size != (32, 16) or img.mode != 'P':
        sys.exit(f'{name}.png: expected a 32x16 indexed picture, got {img.size[0]}x{img.size[1]} {img.mode}')
    rgba = img.convert('RGBA')
    rgba.putdata([(0, 0, 0, 0) if i == 0 else c for i, c in zip(img.getdata(), rgba.getdata())])
    rgba.save(out / f'{ours}.png', optimize=True)
print(f'wrote {len(NAMES)} labels to {out}')
