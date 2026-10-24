# SaveForge — multi-game save editor (TypeScript, runs in the browser)

One site, many games. Drop a save on the landing page, the game is detected from the file's structure
(size, checksums, layout; never a hash, since saves change on every write), and that game's editor is
lazy-loaded. Currently supported: Pokémon Red / Blue / Yellow (English). Everything is a self-contained
"game module", so adding Pokémon Gen 2–5, Final Fantasy, Mega Man Battle Network, etc. never touches the shell.

## Look and feel

The page is styled as a handheld: grey plastic shell, olive LCD panels wherever the app shows data (levels, stats,
Pokédex totals, the example bytes), magenta action buttons. Colours are CSS tokens at the top of `styles.css` with a
light and a dark set. Fonts (Pixelify Sans, Instrument Sans, JetBrains Mono) load from Google Fonts and fall back to
system fonts. A game can set `colors` on its module to give each title a cartridge-label colour on the landing page.

## Sprites

Pokémon box icons (dex #1-151), item icons and type icons live in `assets/sprites/` and come from
[PokéSprite](https://github.com/msikma/pokesprite); the eight gym badges are cut from the Trainer Card sheet on
The Spriters Resource (see `assets/sprites/CREDITS.md`). The images are © Nintendo /
Creatures Inc. / GAME FREAK Inc.; delete the folder to remove them and the site still works, just without icons.
To refresh them from a PokéSprite checkout: `node scripts/import-sprites.mjs <path>`.
The box icons are drawn with their feet on a common baseline, so the art sits low in its canvas;
`scripts/measure-icons.mjs` measures where the visible pixels really are and writes `src/ui/spriteOffsets.ts`, and
the UI nudges each icon by that much so Pokémon look vertically centred wherever they appear (the import script
runs it for you, and `npm test` fails if the table is stale). Which file shows for which
Gen 1 item is one table in `src/ui/editors/gen1/itemSprites.ts`, and `npm test` checks that every file it names exists.

## Run it

Requires Node 22.18+ (uses Node's built-in TypeScript stripping — **no npm dependencies**).

```
npm run dev          # builds to dist/ and serves http://localhost:5173
npm test             # unit tests (data tables, round-trips, checksums)
node scripts/make-sample.ts sample.sav   # the same made-up save the "Try a sample save" button opens
node scripts/gen-moves.mjs <pokered checkout>   # regenerates src/core/gen1/moves.ts (type, power, accuracy, PP)
node scripts/measure-icons.mjs                  # regenerates src/ui/spriteOffsets.ts after changing the Pokémon icons
```

Everything runs client-side; saves never leave the browser. **Back up your real .sav before editing.**

## Gen 1 features

- Trainer: name, rival, ID, money, coins, play time, badges; in-game options (text speed, battle animations,
  battle style)
- **Pokémon Yellow** is told apart from Red/Blue by the file itself (Yellow writes Pikachu's state into a block
  Red and Blue leave empty). A Yellow save gets a Pikachu card: friendship (0-255, with the game's own wording
  for each range) and whether the game still counts your Pikachu as your starter. That depends on its original
  trainer matching your name and Trainer ID, so the editor tags the starter in the party, warns in the review list
  if an edit would orphan it, and has a "Make Pikachu my starter" button. Red and Blue can't be told apart, so
  those saves ask which one yours is.
- Bag and PC item storage (only items the game can actually put there)
- Party and all 12 boxes. The party has up/down arrows beside each card; boxes are a 4 x 5 grid like the PC. Tap ⋯
  (party) or a Pokémon (box) to edit it, move it between the party and any box, copy it or remove it. The last
  Pokémon in the party can't be moved out or removed.
- Full Pokémon editor: species, nickname, OT, level, exp + growth curve, status, moves (with type icons), DVs, EVs,
  battle stats. Each move shows its PP (read-only) and a PP Up stepper (0-3); every PP Up raises the maximum and the
  current PP with it, like the game, and "Max PP" is shown under both. Restore PP refills all four.
- Pokédex seen / owned
- **Save** first shows a plain-language list of everything that changed (and "No changes yet" if nothing did)
- "Try a sample save" on the landing page opens a made-up save, so nothing needs to be uploaded to look around
- All checksums recalculated on export (main + box banks); an unedited save round-trips byte-for-byte

## Layout

```
src/core/types.ts          GameModule / EditableSave contracts (the only thing the shell knows about)
src/core/registry.ts       GAMES list + detectGames()
src/games/*.ts             one small descriptor per game: detect, load, lazy editor import
src/core/<game>/           format code per game: data tables, text encoding, parse/serialize, checksums,
                           plus what the shell can ask for: describeChanges (review list) and a sample save
src/ui/main.ts             game-agnostic shell: drop zone, detection, chooser, review dialog, save
src/ui/editors/<game>/     editor UI per game (lazy-loaded)
scripts/build.mjs          strips types -> dist/ (rewrites .ts imports and import() to .js)
test/                      node:test suite
```

## Adding a game

1. **Format code** in `src/core/<game>/`: a model class with `serialize()` that recalculates every checksum,
   plus data tables. Keep it free of DOM code so it's testable in Node.
2. **Descriptor** in `src/games/<game>.ts`, using `defineGame({ id, family, games, platform, detect, identify?, load, loadEditor })`.
   `detect()` must be cheap, side-effect-free and never throw; return `{ confidence: 'certain' }` only when
   size + checksum + layout all match, otherwise `'likely'` or `null`.
   `games` lists every exact title the module opens (e.g. `Pokémon Red`, `Pokémon Blue`); the site shows the
   exact name as the page headline. If the format records the version (a game code, a layout difference),
   have `identify()` return the single matching name; if it genuinely can't tell (Red vs Blue), return all
   candidates and the site asks the user to confirm which one theirs is.
3. **Editor** in `src/ui/editors/<game>/index.ts` exporting a `MountEditor`; call `host.markDirty()` on edits.
4. **Register** it in the `GAMES` array in `src/core/registry.ts`.
5. Optional, and the shell picks them up when present: `describeChanges(before)` on the save model (a list of
   `ChangeGroup`s for the review dialog) and `sample()` on the descriptor (a made-up save for the "Try a sample
   save" button, built in code so no binary file is shipped).

The landing page's supported-games list, auto-detection, the manual chooser (used when a file matches zero or
several games) and the Save button all pick the new game up automatically.

Tips: write a round-trip test first (unedited save re-serializes byte-for-byte), and when two games share a
file size, make each `detect()` verify its own checksum so only one claims the file.

## Deploying

`npm run build` produces a static site in `dist/`. Host it anywhere static (GitHub Pages, Cloudflare Pages,
Netlify); there's no backend. For more games you may want a bundler later (esbuild/Vite) for minification;
the per-game `import()` already gives you code splitting.

## Deploying to GitHub Pages (auto-updates on every push)

`.github/workflows/pages.yml` runs the tests, builds, and publishes `dist/` to GitHub Pages on each push to
`main`. One-time setup: create the repo, push this folder, then Settings -> Pages -> Source: "GitHub Actions".
The site then lives at `https://<user>.github.io/<repo>/` (all asset paths are relative, so the subpath is fine)
and downloads a plain `.sav`.

## Hosting on a Claude artifact (phone-friendly, updatable)

`node scripts/build.mjs && node scripts/build-artifact.mjs` writes `artifact/index.html` (inline CSS, no
html/head/body wrapper) next to the compiled modules in `dist/`. Publish that file with the Artifact tool,
attaching the `dist/` modules via `files`, and republish the same path to update it in place.
Hosted pages can't start downloads or show `confirm()`, so the app uses the `downloads` capability (the save
is wrapped in a `.zip`, since `.sav` isn't an allowed type) and in-page dialogs. On a normal website a plain
`.sav` download is used instead.

## Known limitations

- Tested against synthetic saves built from documented offsets, not yet against real cartridge saves; try copies of your own and report mismatches.
- Gen 1: English only (Japanese uses different offsets and text encoding). Event flags and map position are left untouched.
- The options byte (text speed, battle style, animations) and the max-PP rules come from the pokered disassembly, not
  from a real cartridge; check them against one of your own saves.
- Yellow's Pikachu offsets (friendship at 0x271C, mood at 0x271D) come from the pokeyellow disassembly and were
  checked against one real Yellow save. Mood is kept as it is, not editable.
- Red and Blue saves are byte-identical in structure, so the site asks which version yours is.
- Names that use the game's "PK" / "MN" symbols show a "?" in the editor but are written back exactly as they were
  unless you change that name.
- Growth rate isn't stored in the save, so the editor infers it from level/exp and lets you override it.
