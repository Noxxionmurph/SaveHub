"""One-off: make the self-hosted web fonts in fonts/ from the Google Fonts repository.

    git clone --depth 1 --filter=blob:none --sparse https://github.com/google/fonts /tmp/gfonts
    git -C /tmp/gfonts sparse-checkout set ofl/instrumentsans ofl/jetbrainsmono ofl/pixelifysans
    python3 scripts/make-fonts.py /tmp/gfonts                  # all three
    python3 scripts/make-fonts.py /tmp/gfonts pixelify-sans    # only the ones named

Each font is cut down to what the site uses, so the three files together are small:
  - the Latin character set Google Fonts serves as its "latin" subset (accented letters, punctuation, a few symbols);
    anything else (arrows, the male and female signs, ...) comes from the visitor's system font, as it always has;
  - only the weights the stylesheet asks for (a variable font's weight axis is narrowed to that range, and Instrument
    Sans' width axis is fixed at normal).
Two changes are made to Pixelify Sans, so that ordinary text and numbers can be set in it:
  - its digit 5 is the same shape as its letter S ("12345" reads "1234S", "500" reads "S00"), so the 5 is redrawn with a
    flat top bar and square corner (patch_five below), at both ends of the weight axis;
  - its "fi", "fl" and similar ligatures are drawn badly ("file" reads "Ale", "fix" reads "Ax"), so the ligature features
    (liga, dlig) are left out.
Nothing else in any font is altered.
The fonts are licensed under the SIL Open Font License; the licence texts are copied next to them (fonts/OFL-*.txt).
Needs fontTools (pip install fonttools). Writes WOFF (zlib), which every browser reads; WOFF2 would need brotli.
"""
import io
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import _g_v_a_r
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

# Pixelify Sans' 5, redrawn: a square top bar the full width of the glyph, then the stem and bowl it already had. The
# points are on the font's own pixel grid, in the same order for both ends of the weight axis (500 and 700), so the
# difference between them is the variation. (Each is a single clockwise contour starting at the bottom left.)
FIVE_500 = [(150, -12), (150, 77), (60, 77), (60, 190), (170, 190), (170, 100), (420, 100), (420, 166), (240, 166), (240, 255),
            (150, 255), (150, 344), (60, 344), (60, 633), (531, 633), (531, 520), (170, 520), (170, 366), (259, 366), (259, 279),
            (440, 279), (440, 190), (531, 190), (531, 77), (440, 77), (440, -12)]
FIVE_700 = [(149, -11), (149, 74), (61, 74), (61, 211), (188, 211), (188, 125), (414, 125), (414, 160), (237, 160), (237, 246),
            (149, 246), (149, 331), (61, 331), (61, 638), (542, 638), (542, 501), (188, 501), (188, 381), (276, 381), (276, 297),
            (453, 297), (453, 211), (542, 211), (542, 74), (453, 74), (453, -11)]


def patch_five(font):
    """Replace the 5 of a Pixelify Sans whose weight axis runs 500-700 (default 500)."""
    glyf, gvar = font["glyf"], font["gvar"]
    tuples = gvar.variations["five"]
    assert len(tuples) == 1 and tuples[0].axes == {"wght": (0.0, 1.0, 1.0)}, "unexpected variation data for the 5"
    pen = TTGlyphPen(None)
    pen.moveTo(FIVE_500[0])
    for point in FIVE_500[1:]:
        pen.lineTo(point)
    pen.closePath()
    glyph = pen.glyph()
    glyph.recalcBounds(glyf)
    glyf["five"] = glyph
    advance, _ = font["hmtx"]["five"]
    font["hmtx"]["five"] = (advance, glyph.xMin)
    old = tuples[0].coordinates
    phantoms = old[-4:]                                    # the four phantom points carry the advance width's variation
    tuples[0].coordinates = [(b[0] - a[0], b[1] - a[1]) for a, b in zip(FIVE_500, FIVE_700)] + list(phantoms)


root = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/gfonts") / "ofl"
only = set(sys.argv[2:])
out = Path(__file__).resolve().parent.parent / "fonts"
out.mkdir(exist_ok=True)

for name, folder, file, limits in FONTS:
    if only and name not in only:
        continue
    font = TTFont(root / folder / file)
    font = instancer.instantiateVariableFont(font, limits)
    # Save and reload before subsetting: fontTools' subsetter trips over the instancer's in-memory tables.
    buffer = io.BytesIO()
    font.save(buffer)
    font = TTFont(io.BytesIO(buffer.getvalue()))
    if name == "pixelify-sans":
        patch_five(font)
    options = subset.Options()
    options.layout_features = ["*"]      # keep kerning and ligatures
    if name == "pixelify-sans":          # ... except Pixelify Sans' broken ones
        tags = {record.FeatureTag for record in font["GSUB"].table.FeatureList.FeatureRecord}
        options.layout_features = sorted(tags - {"liga", "dlig"})
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
