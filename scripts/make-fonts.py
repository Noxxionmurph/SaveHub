"""One-off: make the self-hosted web fonts in fonts/ from the Google Fonts repository.

    git clone --depth 1 --filter=blob:none --sparse https://github.com/google/fonts /tmp/gfonts
    git -C /tmp/gfonts sparse-checkout set ofl/instrumentsans ofl/jetbrainsmono ofl/pixelifysans
    python3 scripts/make-fonts.py /tmp/gfonts

Each font is cut down to what the site uses, so the three files together are small:
  - the Latin character set Google Fonts serves as its "latin" subset (accented letters, punctuation, a few symbols);
    anything else (arrows, the male and female signs, ...) comes from the visitor's system font, as it always has;
  - only the weights the stylesheet asks for (a variable font's weight axis is narrowed to that range, and Instrument
    Sans' width axis is fixed at normal).
The fonts are licensed under the SIL Open Font License; the licence texts are copied next to them (fonts/OFL-*.txt).
Needs fontTools (pip install fonttools). Writes WOFF (zlib), which every browser reads; WOFF2 would need brotli.
"""
import io
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# (output name, folder and file in the Google Fonts repository, axis limits)
FONTS = [
    ("instrument-sans", "instrumentsans", "InstrumentSans[wdth,wght].ttf", {"wdth": 100, "wght": (400, 600)}),
    ("jetbrains-mono", "jetbrainsmono", "JetBrainsMono[wght].ttf", {"wght": (400, 600)}),
    ("pixelify-sans", "pixelifysans", "PixelifySans[wght].ttf", {"wght": (500, 700)}),
]

# Google Fonts' "latin" unicode-range
LATIN = (
    list(range(0x0000, 0x0100)) + [0x0131, 0x0152, 0x0153, 0x02BB, 0x02BC, 0x02C6, 0x02DA, 0x02DC, 0x0304, 0x0308, 0x0329]
    + list(range(0x2000, 0x2070)) + [0x20AC, 0x2122, 0x2191, 0x2193, 0x2212, 0x2215, 0xFEFF, 0xFFFD]
)

root = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/gfonts") / "ofl"
out = Path(__file__).resolve().parent.parent / "fonts"
out.mkdir(exist_ok=True)

for name, folder, file, limits in FONTS:
    font = TTFont(root / folder / file)
    font = instancer.instantiateVariableFont(font, limits)
    # Save and reload before subsetting: fontTools' subsetter trips over the instancer's in-memory tables.
    buffer = io.BytesIO()
    font.save(buffer)
    font = TTFont(io.BytesIO(buffer.getvalue()))
    options = subset.Options()
    options.layout_features = ["*"]      # keep kerning and ligatures
    options.name_IDs = ["*"]             # keep the copyright and licence notices inside the file
    options.notdef_outline = True
    options.flavor = "woff"
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=LATIN)
    subsetter.subset(font)
    font.flavor = "woff"
    target = out / f"{name}.woff"
    font.save(target)
    shutil.copyfile(root / folder / "OFL.txt", out / f"OFL-{name}.txt")
    print(f"{target.name}: {target.stat().st_size:,} bytes")
