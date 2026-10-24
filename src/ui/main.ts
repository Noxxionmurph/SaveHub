// Game-agnostic site shell: pick a file, identify the game, lazy-load that game's editor, export.
// Nothing here knows about any particular game.

import { GAMES, detectGames, gamesByFamily, type Match } from '../core/registry.ts';
import type { ChangeGroup, EditableSave, EditorHost, GameIdentity, GameModule, SummaryLine } from '../core/types.ts';
import { initArt } from './art.ts';
import { cartridge } from './brand.ts';
import { askConfirm, clear, h, toast } from './dom.ts';
import { trackPixelRatio } from './pixels.ts';
import { askReview } from './review.ts';
import { pictureIcon } from './sprites.ts';
import { makeZip } from './zip.ts';

const root = document.getElementById('app')!;
let fileName = 'save.sav';
let dirty = false;
let saveButton: HTMLElement | null = null;
const APP_NAME = 'SaveForge';
const REPO = 'https://github.com/Noxxionmurph/SaveHub';

/** Tracks unsaved edits, and shows them as a dot on the Save button. */
function setDirty(on: boolean): void {
  dirty = on;
  saveButton?.classList.toggle('dirty', on);
  saveButton?.setAttribute('aria-label', on ? 'Save edited file (you have unsaved changes)' : 'Save edited file');
}
const host: EditorHost = { markDirty: () => setDirty(true) };

// ---------- file handling ----------

async function loadFile(file: File): Promise<void> {
  const data = new Uint8Array(await file.arrayBuffer());
  fileName = file.name;
  const matches = detectGames(data);
  if (matches.length === 1) await openGame(matches[0].module, data);
  else renderChooser(data, matches);
}

/** "Pokémon: Red / Blue / Yellow", for places that list a whole module (chooser, errors). */
function moduleLabel(g: GameModule): string {
  const short = g.games.map((n) => (n.startsWith(`${g.family} `) ? n.slice(g.family.length + 1) : n));
  return `${g.family}: ${short.join(' / ')}`;
}

const setPageTitle = (name?: string) => { document.title = name ? `${name} · ${APP_NAME}` : APP_NAME; };

/**
 * Style the page as the handheld the open game ran on (see GameModule.theme and the data-console rules in styles.css).
 * Adding ?console=gb, ?console=gbc or ?console=gba to the address forces one for every screen, to preview a theme.
 */
const CONSOLES = ['gb', 'gbc', 'gba'] as const;
const forcedConsole = CONSOLES.find((c) => c === new URLSearchParams(location.search).get('console'));
function applyConsole(game?: GameModule): void {
  const wanted = forcedConsole ?? game?.theme ?? 'gb';
  if (wanted === 'gb') delete document.documentElement.dataset.console;
  else document.documentElement.dataset.console = wanted;
}

function exportName(): string {
  const m = fileName.match(/^(.*?)(\.[^./\\]+)?$/);
  return `${m?.[1] || 'save'}-edited${m?.[2] ?? '.sav'}`;
}

interface DownloadsApi { save(req: { filename: string; data: Uint8Array }): Promise<{ status: string }> }

/**
 * Hosted viewers block downloads a page starts itself and offer a "downloads" capability instead.
 * It only accepts allow-listed extensions (.sav isn't one), so the save travels inside a .zip.
 * Resolves null on a normal website, where a plain download link works.
 */
const hostedDownloads: Promise<DownloadsApi | null> = (async () => {
  try {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
    return ((await c?.use?.('downloads')) as DownloadsApi | null | undefined) ?? null;
  } catch { return null; }
})();

async function download(save: EditableSave): Promise<void> {
  const bytes = save.serialize();
  const name = exportName();
  const hosted = await hostedDownloads;
  if (hosted) {
    try {
      await hosted.save({ filename: `${name}.zip`, data: makeZip(name, bytes) });
      setDirty(false);
      toast(`Saved ${name}.zip. Unzip it to get your edited save. The file you opened is unchanged.`);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'declined') toast(`Couldn't save the file (${code ?? 'unknown error'}).`);
    }
    return;
  }
  const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  setDirty(false);
  toast(`Saved ${name}. Look in your downloads. The file you opened is unchanged.`);
}

const sameBytes = (x: Uint8Array, y: Uint8Array) => x.length === y.length && x.every((v, i) => v === y[i]);

/** Save button: show what changed first (for games that can say), then write the file. */
async function reviewThenSave(game: GameModule, save: EditableSave, original: Uint8Array): Promise<void> {
  if (save.describeChanges) {
    let groups: ChangeGroup[] = [];
    try { groups = save.describeChanges(game.load(original)); } catch { groups = []; }
    let summary: SummaryLine[] = [];
    try { summary = save.summary?.() ?? []; } catch { summary = []; }
    if (!await askReview(groups, !sameBytes(save.serialize(), original), summary)) return;
  }
  await download(save);
}

async function openSample(game: GameModule): Promise<void> {
  try {
    const sample = await game.sample!();
    fileName = sample.fileName;
    await openGame(game, sample.data, true);
  } catch (e) {
    renderError("Couldn't build the sample save.", `${e instanceof Error ? e.message : String(e)} Reload the page and try again.`, renderWelcome);
  }
}

function pickFile(): void {
  const input = h('input', { type: 'file' });
  input.addEventListener('change', () => { if (input.files?.[0]) void loadFile(input.files[0]); });
  input.click();
}

// ---------- shared pieces ----------

function wordmark(size = 28): HTMLElement {
  return h('div', { class: 'wordmark' }, cartridge(size), h('span', { class: 'wordmark-text' }, APP_NAME));
}

const externalLink = (href: string, label: string) =>
  h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);

// ---------- editor ----------

async function openGame(game: GameModule, data: Uint8Array, isSample = false): Promise<void> {
  let save: EditableSave;
  try {
    save = game.load(data);
  } catch (e) {
    renderError(`Couldn't open this file as ${moduleLabel(game)}.`, `${e instanceof Error ? e.message : String(e)} It may be damaged or from a different game.`, () => renderChooser(data, detectGames(data)));
    return;
  }
  const container = h('div', { class: 'editor' }, h('p', { class: 'muted' }, 'Loading editor…'));
  let identity: GameIdentity;
  try { identity = game.identify?.(data) ?? { names: game.games }; } catch { identity = { names: game.games }; }
  const names = identity.names.length ? identity.names : game.games;

  // Exactly one name = the file settled it. Several = the format can't say, so the user confirms.
  let chosen: string | null = names.length === 1 ? names[0] : null;
  const nameEl = h('h1', { class: 'game-name' });
  const picker = h('div', { class: 'version-pick', role: 'group', 'aria-label': 'Which version is this save from?' });
  const drawName = () => {
    // Unconfirmed: "Pokémon Red / Blue / Yellow" (shared family prefix written once).
    const title = chosen ?? names.map((n, i) => (i > 0 && n.startsWith(`${game.family} `) ? n.slice(game.family.length + 1) : n)).join(' / ');
    nameEl.textContent = title;
    setPageTitle(chosen ?? undefined);
    clear(picker);
    if (names.length > 1) {
      picker.append(
        h('span', { class: 'muted' }, chosen ? 'Version:' : 'Which game is this save from?'),
        ...names.map((n) => h('button', {
          class: n === chosen ? 'chip-btn on' : 'chip-btn', 'aria-pressed': String(n === chosen),
          onclick: () => { chosen = n; drawName(); },
        }, n.startsWith(`${game.family} `) ? n.slice(game.family.length + 1) : n)),
      );
    }
  };
  drawName();
  applyConsole(game);

  const dlNote = h('p', { class: 'muted dl-note' });
  void hostedDownloads.then((d) => { if (d) dlNote.textContent = 'This page can only download certain file types, so Save gives you a .zip with your edited file inside. Unzip it in your Files app.'; });

  clear(root);
  root.append(
    h('header', { class: 'editor-head' },
      h('div', { class: 'editor-bar' },
        wordmark(22),
        h('div', { class: 'bar-actions' },
          h('button', { onclick: async () => { if (!dirty || await askConfirm('Close this file? Your edits since the last save will be lost.', 'Close file')) { setDirty(false); saveButton = null; setPageTitle(); renderWelcome(); } } }, 'Close file'),
          saveButton = h('button', { class: 'primary save-btn', 'aria-label': 'Save edited file', onclick: () => void reviewThenSave(game, save, data) }, 'Save'),
        )),
      nameEl,
      h('p', { class: 'muted file-line' }, h('span', {}, fileName), h('span', {}, game.platform)),
      isSample ? h('p', { class: 'sample-note' }, 'This is a made-up sample save. Edit anything, then tap Save to see the list of changes. Nothing leaves your device.') : null,
      picker,
      identity.note && names.length > 1 ? h('p', { class: 'muted version-note' }, identity.note) : null,
      dlNote),
    container,
    siteFooter(),
  );
  try {
    const mount = await game.loadEditor();
    clear(container);
    setDirty(false);
    mount(container, save, host);
  } catch (e) {
    renderError("The editor didn't load.", `${e instanceof Error ? e.message : String(e)} Check your connection, then reload the page.`, renderWelcome);
  }
}

// ---------- screens ----------

/** Example bytes for the "how it works" panel (Gen 1 layout; see src/core/gen1/save.ts). */
const HEX_ROWS: [offset: string, bytes: string, means: string][] = [
  ['0x2598', '80 92 87 50', 'Trainer name: ASH'],
  ['0x2605', '30 39', 'Trainer ID: 12345'],
  ['0x25F3', '00 30 00', 'Money: ¥3,000'],
];

/** "No save handy? Try a sample save" for every game that can build one. */
function sampleRow(): HTMLElement | null {
  const withSample = GAMES.filter((g) => g.sample);
  if (!withSample.length) return null;
  return h('div', { class: 'sample-row' },
    h('span', { class: 'muted' }, 'No save handy?'),
    withSample.map((g) => h('button', { onclick: () => void openSample(g) },
      withSample.length === 1 ? 'Try a sample save' : `Try a sample ${g.family} save`)));
}

function renderWelcome(): void {
  setPageTitle();
  applyConsole();
  clear(root);

  const slot = h('div', { class: 'slot', tabIndex: 0, role: 'button', onclick: pickFile },
    h('div', { class: 'slot-art', 'aria-hidden': 'true' }, cartridge(92, 'slot-cart'), h('div', { class: 'slot-bar' })),
    h('div', { class: 'slot-text' },
      h('strong', {}, 'Open a save file'),
      h('span', { class: 'muted' }, 'Drop a .sav file here, or tap to choose one. SaveForge detects the game for you.'),
      h('span', { class: 'slot-cta' }, 'Choose file'),
    ),
  );
  slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFile(); } });
  slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('over'); });
  slot.addEventListener('dragleave', () => slot.classList.remove('over'));
  slot.addEventListener('drop', (e) => {
    e.preventDefault(); slot.classList.remove('over');
    const f = e.dataTransfer?.files?.[0];
    if (f) void loadFile(f);
  });

  const hex = h('figure', { class: 'lcd hex' },
    h('figcaption', {}, 'Curious how it works? SaveForge recognises a game by the bytes inside the file, not by its name. Here are three values from a Gen 1 Pokémon save.'),
    h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Position'), h('th', {}, 'Bytes'), h('th', {}, 'Means'))),
      h('tbody', {}, HEX_ROWS.map(([offset, bytes, means]) =>
        h('tr', {}, h('td', {}, offset), h('td', {}, bytes), h('td', {}, means))))),
  );

  root.append(
    h('header', { class: 'site-head' }, wordmark(30)),
    h('h1', { class: 'lede' }, 'Edit your retro game saves in the browser.'),
    h('p', { class: 'lede-sub' }, 'Open a save file and SaveForge works out which game it is from and opens the right editor. Everything happens in your browser, so your file is never uploaded.'),
    slot,
    sampleRow(),
    h('p', { class: 'muted notice' }, 'SaveForge never changes the file you open. Saving makes a new copy, but keep a backup anyway.'),

    h('section', { class: 'how' },
      h('h2', {}, 'How it works'),
      h('div', { class: 'how-body' },
        h('ol', { class: 'steps' },
          h('li', {}, h('strong', {}, 'Open your save'), h('span', {}, 'Use the .sav file (the battery save) from your emulator or cartridge dumper. Save states won’t work.')),
          h('li', {}, h('strong', {}, 'Edit what you like'), h('span', {}, 'Use the tabs to change your trainer, items, Pokémon and Pokédex. Checksums, the numbers the game uses to spot damaged saves, are fixed for you.')),
          h('li', {}, h('strong', {}, 'Save and use the new file'), h('span', {}, 'Tap Save, read the list of changes, then download your edited copy. Give it your original file’s name and put it where your game keeps its save.')),
        ),
        hex,
      ),
    ),

    h('section', { class: 'supported' },
      h('h2', {}, 'Supported games'),
      ...[...gamesByFamily()].map(([family, games]) =>
        h('div', { class: 'family' },
          h('h3', {}, family),
          ...games.filter((g) => g.editable).map((g) => h('p', { class: 'muted family-edits' }, h('strong', {}, 'You can edit: '), g.editable)),
          h('ul', { class: 'tiles' }, games.flatMap((g) => g.games.map((name) => {
            const picture = g.icons?.[name];
            const tile = h('li', { class: 'tile' },
              h('span', { class: 'tile-label', 'aria-hidden': 'true' }),
              h('span', { class: 'tile-name' }, name),
              h('span', { class: 'muted tile-platform' }, g.platform),
              picture ? pictureIcon(picture, 68, 56, 'tile-icon') : null);
            const color = g.colors?.[name];
            if (color) tile.style.setProperty('--label', color);
            return tile;
          }))))),
      h('p', { class: 'request' }, 'Want another game? ', externalLink(`${REPO}/issues/new`, 'Request it on GitHub'), '.'),
    ),

    siteFooter(),
  );
}

/** Bottom of every page: what the site is, who it isn't, and how to reach the person who runs it. */
function siteFooter(): HTMLElement {
  return h('footer', { class: 'site-foot' },
    h('span', {}, 'Runs entirely in your browser. Your save never leaves your device.'),
    h('nav', { class: 'foot-links', 'aria-label': 'About this site' },
      externalLink(REPO, 'Source on GitHub'),
      externalLink(`${REPO}/issues`, 'Contact'),
      externalLink(`${REPO}/blob/main/CREDITS.md`, 'Credits')),
    h('p', { class: 'legal' },
      'Unofficial fan tool, free and non-commercial. Not affiliated with or endorsed by Nintendo, Game Freak or Creatures Inc. ',
      'Pokémon and its artwork belong to their owners.'));
}

/** Shown when a file matches no game, or more than one. The user decides; load() validates. */
function renderChooser(data: Uint8Array, matches: Match[]): void {
  clear(root);
  const ambiguous = matches.length > 1;
  const candidates = matches.length ? matches.map((m) => m.module) : GAMES;
  const hints = candidates.map((g) => g.fileHint).filter((x): x is string => Boolean(x));
  root.append(
    h('header', { class: 'site-head' }, wordmark()),
    h('div', { class: ambiguous ? 'notice-box' : 'error' },
      h('strong', {}, ambiguous ? 'This file could be more than one game' : "SaveForge doesn't recognise this file"),
      ambiguous
        ? h('p', {}, 'Pick the game it belongs to. If you pick wrong, the editor may show nonsense, so keep a backup.')
        : h('div', { class: 'why' },
          h('p', {}, `${fileName} is ${data.length.toLocaleString()} bytes. ${hints.join(' ')}`),
          h('ul', {},
            h('li', {}, 'Use the battery save (usually a .sav file), not a save state.'),
            h('li', {}, 'Only the versions listed on the home page are supported, in English.'),
            h('li', {}, 'A damaged save can fail the checks too.')),
          h('p', {}, 'If you are sure which game it is, you can try opening it anyway. If it is the wrong game, the editor may show nonsense, so keep a backup.')),
      h('div', { class: 'game-list' }, candidates.map((g) =>
        h('button', { onclick: () => void openGame(g, data) },
          h('span', {}, ambiguous ? moduleLabel(g) : `Try opening as ${moduleLabel(g)}`), h('span', { class: 'muted' }, g.platform)))),
      h('div', { class: 'button-row' }, h('button', { onclick: renderWelcome }, 'Back to start'))),
  );
}

function renderError(title: string, detail: string, back: () => void): void {
  clear(root);
  root.append(
    h('header', { class: 'site-head' }, wordmark()),
    h('div', { class: 'error' },
      h('strong', {}, title),
      h('p', {}, detail),
      h('div', { class: 'button-row' }, h('button', { onclick: back }, 'Back'))),
  );
}

window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
initArt();
trackPixelRatio();
renderWelcome();
