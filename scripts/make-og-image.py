"""Draws og-image.png, the 1200x630 picture links to the site show on Discord, Reddit and the like.

usage: python3 scripts/make-og-image.py   (writes og-image.png at the repo root)

Series-neutral on purpose: the SaveForge cartridge (the same rects as src/ui/brand.ts), the wordmark and one line,
in the default Game Boy colours from styles.css. No game artwork, so it can live in this repository.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
BG, TEXT, MUTED = '#d6d9de', '#1d2129', '#4b5260'
CART, SHADE, LCD, INK, PIN, SLOT = '#8b919b', '#6e747e', '#aebf6e', '#1f2a12', '#3c424d', '#23272f'

# brand.ts PIXELS, as (colour, x, y, w, h) in art pixels
PIXELS = [
    (CART, 1, 0, 10, 1), (CART, 0, 1, 12, 11), (SHADE, 0, 9, 12, 1), (LCD, 2, 2, 8, 6),
    (INK, 3, 3, 6, 1), (INK, 3, 5, 4, 1),
    (PIN, 2, 12, 1, 2), (PIN, 4, 12, 1, 2), (PIN, 7, 12, 1, 2), (PIN, 9, 12, 1, 2),
]

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)

# the cartridge sitting in its slot, 24 screen pixels per art pixel
S, cx, cy = 24, 110, 150
slot_top = cy + 12 * S
d.rounded_rectangle((cx - 36, slot_top, cx + 12 * S + 36, slot_top + 80), radius=10, fill=SLOT)
for colour, x, y, w, h in PIXELS:
    d.rectangle((cx + x * S, cy + y * S, cx + (x + w) * S - 1, cy + (y + h) * S - 1), fill=colour)

pixel = ImageFont.truetype(os.path.join(ROOT, 'fonts', 'pixelify-sans.woff'), 96)
pixel.set_variation_by_axes([700])
sans = ImageFont.truetype(os.path.join(ROOT, 'fonts', 'instrument-sans.woff'), 44)
sans.set_variation_by_axes([500])
tx = cx + 12 * S + 90
d.text((tx, 215), 'SaveForge', font=pixel, fill=TEXT)
d.text((tx, 350), 'Edit your retro game saves', font=sans, fill=TEXT)
d.text((tx, 408), 'in the browser.', font=sans, fill=MUTED)

img.save(os.path.join(ROOT, 'og-image.png'), optimize=True)
print('wrote og-image.png')
