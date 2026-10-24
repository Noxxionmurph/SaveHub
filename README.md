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

Pokémon box icons (dex #1-151) and item icons live in `assets/sprites/` and come from
[PokéSprite](https://github.com/msikma/pokesprite) (see `assets/sprites/CREDITS.md`). The images are © Nintendo /
Creatures Inc. / GAME FREAK Inc.; delete the folder to remove them and the site still works, just without icons.
To refresh them from a PokéSprite checkout: `node scripts/import-sprites.mjs <path>`. Which file shows for which
Gen 1 item is one table in `src/ui/editors/gen1/itemSprites.ts`, and `npm test` checks that every file it names exists.

## Run it

Requires Node 22.18+ (uses Node's built-in TypeScript stripping — **no npm dependencies**).

```
npm run dev          # builds to dist/ and serves http://localhost:5173
npm test             # unit tests (data tables, round-trips, checksums)
node scripts/make-sample.ts sample.sav   # synthetic save to try the UI
```

Everything runs client-side; saves never leave the browser. **Back up your real .sav before editing.**

## Gen 1 features

- Trainer: name, rival, ID, money, coins, play time, badges
- Bag and PC item storage
- Party and all 12 boxes: add / delete / reorder, full Pokémon editor
  (species, nickname, OT, level, exp + growth curve, status, moves, PP / PP Ups, DVs, EVs, battle stats)
- Pokédex seen / owned
- All checksums recalculated on export (main + box banks); an unedited save round-trips byte-for-byte

## Layout

```
src/core/types.ts          GameModule / EditableSave contracts (the only thing the shell knows about)
src/core/registry.ts       GAMES list + detectGames()
src/games/*.ts             one small descriptor per game: detect, load, lazy editor import
src/core/<game>/           format code per game: data tables, text encoding, parse/serialize, checksums
src/ui/main.ts             game-agnostic shell: drop zone, detection, chooser, download
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

The landing page's supported-games list, auto-detection, the manual chooser (used when a file matches zero or
several games) and the download button all pick the new game up automatically.

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
- Gen 1: English only (Japanese uses different offsets and text encoding). Event flags, map position and options are left untouched.
- Growth rate isn't stored in the save, so the editor infers it from level/exp and lets you override it.
