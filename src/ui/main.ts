// Game-agnostic site shell: pick a file, identify the game, lazy-load that game's editor, export.
// Nothing here knows about any particular game.

import { GAMES, detectGames, gamesByFamily, type Match } from '../core/registry.ts';
import type { EditableSave, EditorHost, GameIdentity, GameModule } from '../core/types.ts';
import { askConfirm, clear, h, toast } from './dom.ts';
import { makeZip } from './zip.ts';

const root = document.getElementById('app')!;
let fileName = 'save.sav';
let dirty = false;
const APP_NAME = 'SaveForge';
const host: EditorHost = { markDirty: () => { dirty = true; } };

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
      dirty = false;
      toast(`Saved ${name}.zip. Unzip it to get your save file.`);
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
  dirty = false;
}

function pickFile(): void {
  const input = h('input', { type: 'file' });
  input.addEventListener('change', () => { if (input.files?.[0]) void loadFile(input.files[0]); });
  input.click();
}

async function openGame(game: GameModule, data: Uint8Array): Promise<void> {
  let save: EditableSave;
  try {
    save = game.load(data);
  } catch (e) {
    renderError(`Couldn't open this file as ${moduleLabel(game)}.`, e instanceof Error ? e.message : String(e), () => renderChooser(data, detectGames(data)));
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
        h('span', { class: 'muted' }, chosen ? 'Version:' : 'Which version is yours?'),
        ...names.map((n) => h('button', {
          class: n === chosen ? 'chip-btn on' : 'chip-btn', 'aria-pressed': String(n === chosen),
          onclick: () => { chosen = n; drawName(); },
        }, n.startsWith(`${game.family} `) ? n.slice(game.family.length + 1) : n)),
      );
    }
  };
  drawName();

  const dlNote = h('p', { class: 'muted dl-note' });
  void hostedDownloads.then((d) => { if (d) dlNote.textContent = 'Download gives you a .zip containing your edited save (this host only allows certain file types). Unzip it in your Files app.'; });

  clear(root);
  root.append(
    h('header', { class: 'topbar' },
      h('div', {},
        h('p', { class: 'brand' }, APP_NAME),
        nameEl,
        h('p', { class: 'muted' }, `${fileName} · ${game.platform}${identity.note && names.length > 1 ? ` · ${identity.note}` : ''}`),
        picker),
      h('div', { class: 'button-row' },
        h('button', { onclick: async () => { if (!dirty || await askConfirm('Discard unsaved changes?', 'Discard')) { dirty = false; setPageTitle(); renderWelcome(); } } }, 'Close'),
        h('button', { class: 'primary', onclick: () => void download(save) }, 'Download'),
      ),
      dlNote),
    container,
  );
  try {
    const mount = await game.loadEditor();
    clear(container);
    dirty = false;
    mount(container, save, host);
  } catch (e) {
    renderError('The editor failed to load.', e instanceof Error ? e.message : String(e), renderWelcome);
  }
}

// ---------- screens ----------

function renderWelcome(): void {
  setPageTitle();
  clear(root);
  const drop = h('div', { class: 'drop', tabIndex: 0, role: 'button', onclick: pickFile },
    h('strong', {}, 'Open a save file'),
    h('span', { class: 'muted' }, 'Drop a save here, or tap to browse. The game is detected automatically.'),
  );
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFile(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('over');
    const f = e.dataTransfer?.files?.[0];
    if (f) void loadFile(f);
  });
  root.append(
    h('header', { class: 'hero' },
      h('h1', {}, 'SaveForge'),
      h('p', { class: 'muted' }, 'Save editor for classic games. Runs entirely in your browser: your save never leaves your device.')),
    drop,
    h('p', { class: 'notice' }, 'Always keep a backup of the original save file before editing.'),
    h('section', { class: 'supported' },
      h('h3', {}, 'Supported games'),
      ...[...gamesByFamily()].map(([family, games]) =>
        h('div', { class: 'family' }, h('strong', {}, family),
          h('ul', {}, games.flatMap((g) => g.games.map((name) =>
            h('li', {}, `${name} `, h('span', { class: 'muted' }, g.platform)))))))
    ),
  );
}

/** Shown when a file matches no game, or more than one. The user decides; load() validates. */
function renderChooser(data: Uint8Array, matches: Match[]): void {
  clear(root);
  const ambiguous = matches.length > 1;
  const candidates = matches.length ? matches.map((m) => m.module) : GAMES;
  root.append(
    h('header', { class: 'hero' }, h('h1', {}, 'SaveForge')),
    h('div', { class: ambiguous ? 'notice-box' : 'error' },
      h('strong', {}, ambiguous ? 'This file could be more than one game' : "Couldn't identify this file"),
      h('p', {}, ambiguous
        ? 'Pick the game it belongs to.'
        : `${fileName} is ${data.length.toLocaleString()} bytes and didn't match any supported game's checksum or layout. It may be corrupted, a different region or version, or a game that isn't supported yet. If you know which game it is, you can try opening it anyway; the checksum is recalculated on export.`),
      h('div', { class: 'game-list' }, candidates.map((g) =>
        h('button', { onclick: () => void openGame(g, data) }, moduleLabel(g), h('span', { class: 'muted' }, ` ${g.platform}`)))),
      h('div', { class: 'button-row' }, h('button', { onclick: renderWelcome }, 'Back'))),
  );
}

function renderError(title: string, detail: string, back: () => void): void {
  clear(root);
  root.append(
    h('header', { class: 'hero' }, h('h1', {}, 'SaveForge')),
    h('div', { class: 'error' },
      h('strong', {}, title),
      h('p', {}, detail),
      h('div', { class: 'button-row' }, h('button', { onclick: back }, 'Back'))),
  );
}

window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
renderWelcome();
