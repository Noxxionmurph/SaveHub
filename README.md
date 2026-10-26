# SaveForge — multi-game save editor (TypeScript, runs in the browser)

One site, many games. Drop a save on the landing page, the game is detected from the file's structure
(size, checksums, layout; never a hash, since saves change on every write), and that game's editor is
lazy-loaded. Currently supported: Pokémon Red / Blue / Yellow, Gold / Silver and Crystal (English). Everything is a
self-contained "game module", so adding Pokémon Gen 3–5, Final Fantasy, Mega Man Battle Network, etc. never touches the shell.

## Look and feel

The page is styled as a handheld: grey plastic shell, olive LCD panels wherever the app shows data (levels, stats,
Pokédex totals, the example bytes), magenta action buttons. Colours are CSS tokens at the top of `styles.css` with a
light and a dark set. A game module can set `theme: 'gbc'` to restyle the page as a teal Game Boy Color (a pale screen with
a dark bezel, teal shell, dark teal buttons) or `theme: 'gba'` for an indigo Game Boy Advance (a bright white-blue window,
indigo shell and buttons, and the two-line frame and ruled paper of the Gen 3 trainer card on the big readouts): only
the tokens (and that one frame rule) change, in the `data-console` blocks of `styles.css`. No game uses either yet.
Add `?console=gbc` or `?console=gba` (or `?console=gb`) to the address to preview a theme on every screen.
Touches borrowed from the games themselves: HP bars use the game's own length and colour rules (`src/core/gen1/hp.ts`, from
the disassembly in pret/pokered), the review dialog opens with the PLAYER / BADGES / POKÉDEX / TIME window the game shows when you
save, the open tab has the menu cursor, the big readouts have a two-line frame like the in-game text boxes, the Options card is
drawn like the game's OPTION screen (every choice shown, the chosen one marked with the cursor; real radio buttons underneath),
the Pokédex totals are the game's SEEN / OWN window, the trainer card keeps each badge in its own boxed slot (dashed until earned) and the badge picker is one row of eight (on a phone without the names, with a line under it naming the badges you have), and the trainer card types itself in once when a file opens (not for
people who ask for less motion). Fonts (Pixelify Sans, Instrument Sans, JetBrains Mono) are bundled in `fonts/` (SIL Open Font License, Latin only,
~100 KB together), so the page makes no request to Google or any other font host; a character a font lacks falls back to
the system font. `scripts/make-fonts.py` remakes the files from the google/fonts repository.
Every retro window (the trainer card, Options, stats, save and review windows, the Pokédex totals, Pikachu's windows) is set in
Pixelify Sans, uppercase for its small labels; the sans is for reading and the monospace only for typing into number fields.
So that ordinary text and numbers can be set in the pixel font, the shipped copy has two small changes (see the header of
`make-fonts.py`): its 5, which was the same shape as its S, is redrawn with a flat top, and its fi / fl ligatures, which were drawn as an "A", are left out. (The Claude-hosted copy
of the page is the one exception: it still links Google Fonts.) A game can set `colors` on its module to give each title a cartridge-label colour on the landing page.

## Artwork

The pictures (Pokémon box icons for dex #1-251 plus Unown's letters and an egg, item icons, type icons, Kanto and Johto
gym badges and Pikachu's reactions) are **not in
this repository**. They live in [SaveHub-assets](https://github.com/Noxxionmurph/SaveHub-assets), which is served as its
own site (`https://noxxionmurph.github.io/SaveHub-assets/`); the editor loads them from there. The images are
© Nintendo / Creatures Inc. / GAME FREAK Inc. and come from PokéSprite, The Spriters Resource and Serebii (see
[CREDITS.md](CREDITS.md)). Keeping them apart means a request to remove artwork only ever touches that repository, and
the editor carries on without pictures (a picture that can't load hides itself, and the Pikachu preview box is dropped).

- **One place decides where they come from**: `ART_BASE` in `src/ui/art.ts`. Nothing else names a path to the artwork
  (`npm test` checks), so moving or removing it is a one-line change.
- **Working on the code**: `git clone https://github.com/Noxxionmurph/SaveHub-assets assets` inside this folder (it is
  git-ignored), then `npm run dev`. `npm run build:local` does the same build without serving. A plain `npm run build`
  makes the site as it is deployed: no pictures inside it, loaded from the artwork site. Without the checkout the
  tests that read the picture files skip themselves.
- **Updates reach phones straight away**: the deployed build puts a version (a hash of everything that ships) on the
  address of every script and stylesheet (`styles.css?v=...`), so a browser that kept an older copy for GitHub Pages' 10
  minutes can't run it next to newer files; only the page itself can be up to 10 minutes old. `scripts/build.mjs` does it;
  `--local-art` builds don't carry a version.
- **Changing the artwork**: edit it in the `assets` checkout and push that repository; the editor picks it up with no
  rebuild. To refresh from a PokéSprite checkout: `node scripts/import-sprites.mjs <path>`.
- **If the artwork has to come down**: delete the files (or the repository) in SaveHub-assets. The editor keeps working.
  To point at another place, change `ART_BASE`.
- The 16x16 badges are drawn at a whole number of screen pixels per source pixel, whatever the screen scaling (100%,
  125%, a 2.625 phone...); a fractional multiple is what makes pixel art look soft. `src/ui/pixels.ts` publishes the
  scaling as `--dpr` and the stylesheet sizes the badges with `round()` (browsers without it keep the plain sizes).
  `e2e/crisp.py` checks it at six scalings.
- The box icons are drawn with their feet on a common baseline, so the art sits low in its canvas;
  `scripts/measure-icons.mjs` measures where the visible pixels really are and writes `src/ui/spriteOffsets.ts`, and
  the UI nudges each icon by that much so Pokémon look vertically centred wherever they appear (the import script
  runs it for you, and `npm test` fails if the table is stale, when the artwork is checked out). Which file shows for which
  item is one table per game (`src/ui/editors/gen1/itemSprites.ts`, `src/ui/editors/gen2/itemSprites.ts`), and `npm test`
  checks that every file they name exists. The Johto badges are Gold's own trainer card badges in the game's badge
  palette; `scripts/extract-johto-badges.py` makes them from the pokegold disassembly.

## Not affiliated

SaveForge is an unofficial fan tool, free and non-commercial, with no ads or donation links. It is not affiliated with
or endorsed by Nintendo, Game Freak or Creatures Inc. The site says so in its footer, with links to this repository, the
issue tracker (the contact address) and the credits.

## Run it

Requires Node 22.18+ (uses Node's built-in TypeScript stripping — **no npm dependencies**).

```
npm run dev          # builds to dist/ (artwork from ./assets/, see Artwork) and serves http://localhost:5173
npm test             # unit tests (data tables, round-trips, checksums)
python3 e2e/run.py    # browser checks in a real Chromium (see e2e/README.md; needs Playwright and the artwork checkout)
node scripts/make-sample.ts sample.sav   # the same made-up Yellow save the "Try a Yellow sample" button opens
node scripts/gen-moves.mjs <pokered checkout>   # regenerates src/core/gen1/moves.ts (type, power, accuracy, PP)
node scripts/verify-against-rom.mjs rom.gb      # checks the Gen 1 tables below against a Red/Blue ROM you own (copies nothing)
node scripts/measure-icons.mjs                  # regenerates src/ui/spriteOffsets.ts after changing the Pokémon icons
node scripts/gen-gen2-data.mjs <pokegold checkout>   # regenerates src/core/gen2/tables.ts (species, base stats, moves, items)
node scripts/gen-crystal-data.mjs <pokecrystal checkout>   # regenerates src/core/gen2/crystalTables.ts (Crystal's items and place names)
python3 scripts/boot-gen2-save.py gold.gbc edited.sav out.png   # opens a Gold, Silver or Crystal save in the real game (PyBoy, your own ROM) and takes pictures
```

Everything runs client-side; saves never leave the browser. **Back up your real .sav before editing.**

## Gen 1 features

- Trainer: name, rival, ID, money, coins, play time, badges; in-game options (text speed, battle animations,
  battle style)
- **Pokémon Yellow** is told apart from Red/Blue by the file itself (Yellow writes Pikachu's state into a block
  Red and Blue leave empty). A Yellow save gets a Pikachu card: friendship (0-255, with the game's own wording
  for each range), mood (0-255, 128 is neutral) and whether the game still counts your Pikachu as your starter.
  A live picture at the top shows how Pikachu will react when you talk to it, and stays in view as you move the
  sliders. Whether the game follows your Pikachu depends on its original trainer matching your name and Trainer ID,
  so the editor tags the starter in the party, warns in the review list if an edit would orphan it, and has a
  "Make Pikachu my starter" button. Red and Blue can't be told apart, so those saves ask which one yours is.
- Bag and PC item storage (only items the game can actually put there)
- Party and all 12 boxes. The party has up/down arrows beside each card; boxes are a 4 x 5 grid like the PC, with your
  party in a row above it. **Drag a Pokémon onto another to swap them** (inside a box, between boxes and the party),
  or onto an empty spot to move it to the end; hold a dragged Pokémon over the ‹ › buttons to turn to the next box.
  Tap one for its menu instead: edit it, move it to the party or any box, duplicate it or remove it. The last Pokémon in
  the party can't be moved out or removed (a swap is fine, since the count doesn't change).
- Full Pokémon editor: species, nickname, OT, level, exp (the species' own growth curve), status, moves (with type icons), DVs, EVs,
  battle stats. Each move shows its PP (read-only) and a PP Up stepper (0-3); every PP Up raises the maximum and the
  current PP with it, like the game, and "Max PP" is shown under both. Restore PP refills all four.
- Pokédex: not seen / seen / caught (caught only marks the Pokédex, it doesn't add the Pokémon), with a filter
  (All / Not seen / Seen / Caught) and a search by name or number. Gen 1 and Gen 2 share it (`src/ui/dexTab.ts`).
- **Save** first shows a plain-language list of everything that changed (and "No changes yet" if nothing did)
- "Try a Yellow sample" and "Try a Crystal sample" on the landing page open made-up saves, so nothing needs to be uploaded to look around
- All checksums recalculated on export (main + box banks); an unedited save round-trips byte-for-byte

## Gen 2 features (Gold / Silver)

- Trainer: name, rival, ID, money, Mom's savings, coins, play time (to 999 hours), all 16 badges (Johto and Kanto, shown
  on the trainer card in the game's own badge art), and every OPTION setting: text speed, battle scene, battle style,
  sound, Game Boy Printer shade, menu account and text box frame.
- All four bag pockets (Items, Balls, Key Items, TM/HM with a count for each of the 57, and a switch to hide the ones you already have) and PC item storage. Each picker
  only offers what the game files in that pocket.
- Party and all 14 boxes, with box names. Moving works as in Gen 1 (arrows, drag and drop, the action menu) and follows
  the game's PC rules: a Pokémon holding Mail can't go in a box, the party always keeps one Pokémon that can battle (an
  egg can't), a Pokémon taken out of a box is healed, and one put in has its PP restored.
- Pokémon editor with what Gen 2 added: held item, friendship, Pokérus, Special Attack and Special Defense, and eggs
  (egg cycles, and hatching one or turning it back into an egg). Gender, shininess and Unown's letter come from the
  DVs in these games, so they're set from the DVs: pick a gender, tap Make shiny, or pick a letter, and the editor
  changes as few DV bits as it can. Shiny Pokémon get a ★ and Unown shows its own letter everywhere.
- Pokédex: all 251 seen / caught.
- Both copies of the save are written (Gold and Silver keep a backup), with both checksums; an unedited save
  round-trips byte for byte.

## Crystal

Crystal opens in the same editor, with its own save layout (most addresses moved a few bytes, and the backup copy is
one block in bank 0; see `GEN2_LAYOUTS` in `src/core/gen2/save.ts`). It also has:

- Whether you play as the boy or the girl (kept outside the checksummed data, at 0x3E3D, and read back on Continue).
- Its four new key items: Clear Bell, GS Ball, Blue Card and Egg Ticket.
- Where each Pokémon was caught: the place, the level, the time of day and whether its trainer was a boy or a girl
  (two bytes Gold and Silver leave empty; `src/core/gen2/caught.ts`).

## Layout

```
src/core/types.ts          GameModule / EditableSave contracts (the only thing the shell knows about)
src/core/registry.ts       GAMES list + detectGames()
src/games/*.ts             one small descriptor per game: detect, load, lazy editor import
src/core/<game>/           format code per game: data tables, text encoding, parse/serialize, checksums,
                           plus what the shell can ask for: describeChanges (review list) and a sample save
src/ui/main.ts             game-agnostic shell: drop zone, detection, chooser, review dialog, save
src/ui/drag.ts             pointer-event drag and drop (mouse, touch, pen); knows nothing about any game
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

## Performance notes

Measured with Chromium's CPU throttled to 4x (roughly a mid-range phone). The Bag tab used to build about 9,000
elements because every item row carried the full 124-item list; rows now hold only their own item and fill in
the list when touched (`lazySelect` in `ui/dom.ts`), which took the tab from ~850 ms to ~390 ms on the first visit (most of what's left is loading its
69 icons) and ~130 ms after that, and from ~9,000 elements to ~470. Typing in the Trainer tab no longer recreates the badge and party images on every keystroke.
The sprites are already tiny (all 151 Pokémon icons are 54 KB together), and opening and closing the dialogs
leaves no elements or listeners behind.

## Writing the on-screen text

Every screen explains itself in plain words, so keep it that way when you add a feature:

- One name per thing: **Save** (the button and the act), "the file you opened" (the original, which is never changed),
  "your edited copy", **Party** and **Box 1-12**, **slot** (only for a position inside a box), **Duplicate**, **Swap**,
  **Move**, **Caught** / **Seen**. Money is shown as ¥ everywhere, including the review list.
- Each tab opens with one line saying what it is for, so people know how to use the editor. Anything that needs more
  (the Boxes tab's dragging tips) sits in a collapsed "How ... works" section that stays open across redraws.
- This is a save editor, not a game guide. Say how to use the editor, but don't add reference material about the game:
  no galleries, no tables of rules, no walkthroughs. (A friendship rules table and a chart of every Pikachu reaction
  were tried on the Pikachu card and removed.)
- Explain jargon where it appears, in a one-line note under the heading or field (DVs, EVs, original trainer, growth
  rate), not in a separate manual. Only state game rules you've checked against the disassembly.
- Say why a control is unavailable ("Party full (6 of 6)", "Full (20 of 20)"), not just grey it out.
- Errors say what happened and what to do next. Warnings in the review list start with "Warning:" and name the fix.
- Sentence case, active voice, plain verbs ("Tap", "Pick", "Drop"). A game can describe itself to the shell with
  `editable` (what the editor can change) and `fileHint` (what a valid file looks like) on its module.

## Known limitations

- Tested against synthetic saves built from documented offsets and against two real saves (a Yellow and a Blue, both from
  emulators): they load, save back byte for byte, and every stored party stat and experience value matches the editor's
  formulas. A Red save hasn't been tried, but Red and Blue share one layout. Try copies of your own and report mismatches.
- The built-in tables (base stats, types, growth curves, species ids, every move's type/power/accuracy/PP and name, item
  names) were checked against Pokémon Red and Pokémon Yellow ROMs with `scripts/verify-against-rom.mjs`: all match.
  The same script finds the game code behind the rules the editor relies on: which bits of the options byte hold text
  speed, battle style and animation (and Yellow's sound setting), and the PP Up bonus (one fifth of the base PP each,
  at most 7). Against Yellow it also checks Pikachu's reaction table (friendship and mood limits, which reactions
  repeat), the Celadon Mansion granny's table (the friendship limit and wording of each of her six lines) and Melanie's
  Bulbasaur limit. The ROMs aren't in the repo and the script copies nothing from them.
- Gen 1: English only (Japanese uses different offsets and text encoding). Event flags and map position are left untouched.
- Crystal: English only (1.0 and 1.1 save the same way). Tested against one real Crystal 1.1 save: it loads and saves
  back byte for byte, and an edited copy (playing as the girl, money, a held item, a nickname, the GS Ball) loads and
  plays in the real game, as does the Crystal sample. Offsets come from the pokecrystal disassembly's symbol file. The
  Battle Tower, Mobile Adapter data and Mystery Gift are left untouched, as are the things listed for Gold and Silver below.
- Gold / Silver: English only. Tested against one real Gold save:
  it loads and saves back byte for byte, and an edited copy (badges, money, a shiny Pokémon holding an item, a renamed
  box, a Pokémon moved out of a box) loads and plays in the real game (checked in an emulator with
  `scripts/boot-gen2-save.py`), as does the sample. Offsets come from the pokegold disassembly's symbol file. Event
  flags, map position, the clock, the Day-Care and the Pokégear are left untouched.
- A Pokémon's stats can be a point behind the editor's numbers in a real save: the game only recalculates stats when a
  Pokémon levels up, so stat experience earned since then hasn't counted yet. The editor shows both and leaves the
  stored ones alone unless you change the Pokémon.
- Mail can't be given in the editor (the letter is written in the game's mail screen), but a Pokémon already holding
  Mail keeps its letter, and taking the Mail off throws the letter away.
- Gold and Silver saves are identical inside, so the site asks which one yours is.
- Which bit is which in the options byte, and the PP Up rule, are confirmed in the game code (see above). The save
  offsets themselves come from the pokered and pokeyellow disassemblies and match the two real saves.
- Yellow's Pikachu offsets (friendship at 0x271C, mood at 0x271D) come from the pokeyellow disassembly. The ROM check
  finds the game copying the friendship byte to 0x271C, and the offsets match one real Yellow save.
- Mood only changes how Pikachu reacts when you talk to it (the editor shows which reaction, worked out from the game's
  own friendship and mood tables and tested against them for all 65,536 combinations). It also drifts: every step you
  walk moves it 1 closer to 128, so an edited mood fades, and the card says roughly how many steps that takes. The
  reaction wording is plain English for the game's animation names (AngryBolt, BackTurn, Love, ...). The game only
  uses this table when nothing else applies: Pikachu has a fixed reaction when it is asleep or has a status
  condition, in Pokémon Tower, the Pokémon Fan Club, the Pewter Pokémon Center and Bill's house, and for a short
  while after some events (catching a Pokémon, fishing, a Thunderstone, Thunder and Thunderbolt).
- The reaction pictures are Pokémon Yellow's own, cut from the Serebii sheet by `scripts/extract-pikachu.py` into one
  file (`sprites/pikachu.png` in the artwork repository, so the card costs one request however many reactions you look at) and
  credited in `CREDITS.md`. Which reaction shows comes from the game's own tables, not from Serebii,
  which ranks reactions by friendship alone where the game uses friendship and mood together.
- Red and Blue saves are byte-identical in structure, so the site asks which version yours is.
- Names that use the game's "PK" / "MN" symbols show as `{PK}` / `{MN}` in the editor, and the "TRAINER" text some
  Pokémon carry as their original trainer shows as `{TRAINER}`. Type them the same way to put them back. A name that
  isn't touched is written back byte for byte.
- A name field warns, under the box, when what you typed can't be saved as typed: a character the game has no glyph
  for (it would be saved as "?") or more than 10 characters (the rest is dropped).
- Dragging is for mouse, touch and pen; on a touch screen you press and hold for a moment first, so swiping still scrolls.
  There is no keyboard drag, but the Pokémon menu does everything it does.
- A party Pokémon's level is read from its stats block (the byte the game uses), not the "box level" byte next to its
  species, which a real Blue save leaves at 0. That byte is left alone unless you change the level, or the Pokémon goes to a box.
- Bytes after the 32 KB save (some emulators append a clock footer) are kept as they are.
- A species' growth curve (which sets experience from level) is fixed by the game, so the editor uses a table of all 151
  rather than guessing from the save. A glitch species falls back to a guess.
