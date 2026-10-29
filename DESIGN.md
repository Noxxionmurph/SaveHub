# SaveForge design

One save editor for many series (Pokémon today, then Final Fantasy, Mega Man Battle Network and others), styled as the console the game ran on. Each page takes on its console: grey Game Boy, teal Game Boy Color or indigo Game Boy Advance. Each game's own screens (for Pokémon: the trainer card, the OPTION menu, the Pokédex) come back as LCD panels. Everything else stays quiet so the game art stands out.

## Shell and series

- The shell (landing page, file slot, chooser, review window, save flow, footer) never names a series. Its copy and demos work for any game module.
- Themes belong to the **platform**, not the series. A Final Fantasy or Battle Network game on GBA gets the indigo GBA look. A new platform (SNES, PS1, DS) gets its own `data-console` token set, in light and dark, with the same token names.
- Series-specific pieces (the party strip, the Pokédex, the Pokémon window) live under `src/ui/editors/<game>/`. Shared pieces stay in `src/ui/` and must not assume Pokémon.
- The landing page groups games by `family`, one shelf per series, each with one short line on what you can edit.

The values below are the tokens in `styles.css`. Pages use the token names, never raw values.

## Consoles

`data-console` on `<html>` picks the palette. With no attribute you get the Game Boy look. Each game module sets its console with `GameModule.theme`, and `?console=gb|gbc|gba` forces one so you can preview it.

| Token | Role | GB light / dark | GBC light / dark | GBA light / dark |
|---|---|---|---|---|
| `--bg` | Page canvas | `#d6d9de` / `#1b1e24` | `#bfe0db` / `#0f1d20` | `#dcd8ef` / `#14122b` |
| `--surface` | Cards, slot, tiles | `#e8eaed` / `#252930` | `#d7ece9` / `#172a2e` | `#ebe8f7` / `#1d1a3d` |
| `--line`, `--line-strong` | Hairlines, card edges, input borders | `#b3b9c2`, `#8e95a1` | `#93c4be`, `#5f9d96` | `#b9b3de`, `#7b72b8` |
| `--text` | Body and headings | `#1d2129` / `#e6e8ec` | `#0f2427` / `#e3f3f1` | `#1c1840` / `#e9e6fb` |
| `--muted` | Secondary text (≥5.5:1 on `--bg`) | `#4b5260` / `#a2a9b5` | `#2e5557` / `#9cc0bc` | `#4a4478` / `#aaa4d8` |
| `--button` | The one primary action per screen (Choose file, Save) | `#9b1b4d` / `#e0447f` | `#24515a` / `#5fd8c9` | `#4b3d9a` / `#9a8bff` |
| `--lcd`, `--lcd-ink`, `--lcd-dim`, `--lcd-edge` | In-game screens: trainer card, options, change list (also the landing page's example) | pea green `#aebf6e` | pale grey-green `#e4e9e4` | blue-white `#e8eefa` with scanline rule |
| `--cart`, `--cart-shade`, `--pin`, `--slot-bar` | The cartridge mark and the file slot | grey cart | teal cart | indigo cart |
| `--focus` | Focus ring | `#1a56db` / `#7fb0ff` | `#0b5cad` / `#8bd0ff` | `#0b5cad` / `#a9c4ff` |
| `--danger` | Remove, errors | `#a4161a` / `#ff9a9a` | same | same |
| `--male`, `--female`, `--shiny` | Gender marks and the shiny star | blue, red, gold | same | same |
| `--caught*` | "Caught" cells in the Pokédex | LCD green on GB, a cart-tinted surface on GBC and GBA | | |

Rules:
- There's one filled `--button` per screen. Everything else uses the plain bordered button. Filters must look different from bulk-action buttons.
- Colour on tiles (`--label`) belongs to the game (Red is red, Crystal is light blue). It's only used for the tile's left stripe.
- Dark mode exists for every console: it follows `prefers-color-scheme`, `data-theme="light|dark"` overrides it, and each console redefines its tokens in all three places.

## Typography

| Family | Token | Used for |
|---|---|---|
| Pixelify Sans (modified, bundled) | `--font-display` | Wordmark, game title on editor pages, everything inside an LCD panel, Lv labels, trainer-card stats. In-game text only. |
| Instrument Sans | `--font-body` | Headings, body, buttons, inputs, tabs |
| JetBrains Mono | `--font-mono` | Typing into number fields only |

Scale (rem): 0.75 · 0.8125 (labels, captions) · 0.875 (small body, notes) · 1 (body) · 1.0625 (LCD values) · 1.25 (h2) · 1.5 (trainer name) · 2 (editor game title) · the landing h1 at `clamp` display size.
Weights: 400 body, 500 to 600 labels and buttons, 700 display only. All fonts are bundled and use `font-display: swap`.

## Pixel art

These rules cover every series' art. The fixed box sizes below are Pokémon's; a new series adds its own kinds with the same whole-pixel scales.

- Sprites, items, badges and Pikachu use whole screen pixels per art pixel with `image-rendering: pixelated`.
- `--px1` and `--px2` are the whole number of screen pixels nearest 1 and 2 CSS px (from `--dpr`). Lists, tiles, cells, the dex and the bag use `--px1` on every screen size. The Pokémon window and landing tiles use `--px2`.
- **Never enlarge sprites past these scales.** 2x and 1.5x were both tried and reverted.
- Fixed boxes: Pokémon icons 68×56 (art ≤35×30), items 32×32 (art ≤27×23), type icons 24px, the shiny mark 16px. Held items are 0.75 art px, just right of the Pokémon and never on top of it. ♂ and ♀ are smooth inline SVG at 0.75em.
- Every new picture kind needs a rule in the "one scale for every picture" block and an entry in `KINDS` in `e2e/assets.py`.
- The cartridge mark (`brand.ts`) is drawn from rects with `crispEdges` and takes its colours from the cart tokens.

## Spacing and layout

- The content column is `#app` at 880px max, with a 16px side gutter on phones and no horizontal scroll.
- Spacing steps: 4 · 6 · 8 · 12 · 16 · 24 · 28 · 56. Section gaps are about 48px on the landing page.
- Mobile first: check 375, 768 and 1440 widths. Long Gen 3 cards start folded (`details.fold`).

## Shape and depth

- Radius: 4px for inputs and chips, 6px for small buttons, 8px for cards, tiles and the slot, 999px for pills and the HP bar. Nothing goes above 14px.
- Depth comes from a 2 to 3px darker bottom edge (the cartridge or button "lip") and inset shadows on LCD panels, not soft drop shadows. Buttons press down 2px on `:active`.

## Components

Use the shared pieces before writing new ones: `ui/tabs.ts`, `itemList.ts`, `monMenu.ts`, `monDialog.ts`, `hpBar.ts`, `gameChoice.ts` (OPTION-style choice and step rows), `typeChip.ts` and `dexTab.ts`.
- **LCD panel** (`.lcd`): for anything the game itself shows. Ink and dim tokens only, in the pixel font.
- **Tabs**: a ▸ cursor marks the active tab, like the in-game menu.
- **Pokémon window**: Esc and × both discard, Save commits.
- **Tiles**: a game-colour stripe, the name, the platform, and the icon at `--px2`.
- **Landing page**: the h1 and lede stay series-neutral. Under the file slot sit the "Works with" chips (one per `family`, linking to its shelf) and the sample buttons (full game title and its colour stripe). The example change list comes from the first module with a `demo`.
- **Link preview**: `og-image.png` (1200×630), drawn by `scripts/make-og-image.py` with no game artwork.

## Copy

Users already know their game. Explain only niche or surprising things (DVs and stat exp, IVs and EVs, what a change silently affects). Don't write tab intros that only say what the tab is, and don't restate ranges the input already enforces.
