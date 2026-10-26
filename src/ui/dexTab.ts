// The Pokédex tab both Pokémon editors share: the game's SEEN / CAUGHT totals, a tile per species that cycles
// not seen -> seen -> caught, and a filter and search so a 251-tile grid stays usable on a phone.

import { h } from './dom.ts';
import { itemIcon, pokemonIcon } from './sprites.ts';

/** The four Pokédex calls the tab needs; Gen 1 and Gen 2 saves both have them. */
export interface DexSave {
  isSeen(dex: number): number | boolean;
  isOwned(dex: number): number | boolean;
  setSeen(dex: number, on: boolean): void;
  setOwned(dex: number, on: boolean): void;
}

type DexState = 'unseen' | 'seen' | 'caught';
type Filter = 'all' | DexState;
const LABEL: Record<DexState, string> = { unseen: 'not seen', seen: 'seen', caught: 'caught' };
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'unseen', label: 'Not seen' }, { id: 'seen', label: 'Seen' }, { id: 'caught', label: 'Caught' },
];

// Kept for the page's life, so switching tabs and back doesn't lose what you were looking at.
let filter: Filter = 'all';
let query = '';

export function dexTab(s: DexSave, names: readonly string[], markDirty: () => void): Node {
  const total = names.length;
  const stateOf = (n: number): DexState => (s.isOwned(n) ? 'caught' : s.isSeen(n) ? 'seen' : 'unseen');

  // The game's own SEEN / OWN window (called Caught here, which says what it is).
  const seenEl = h('dd'), caughtEl = h('dd');
  const summary = h('div', { class: 'lcd dex-summary', role: 'group' },
    h('dl', {}, h('div', {}, h('dt', {}, 'Seen'), seenEl), h('div', {}, h('dt', {}, 'Caught'), caughtEl)));
  const paintSummary = () => {
    let seen = 0, caught = 0;
    for (let n = 1; n <= total; n++) { seen += Number(Boolean(s.isSeen(n))); caught += Number(Boolean(s.isOwned(n))); }
    seenEl.textContent = `${seen}/${total}`;
    caughtEl.textContent = `${caught}/${total}`;
    summary.setAttribute('aria-label', `Seen ${seen} of ${total}, caught ${caught} of ${total}`);
  };

  const empty = h('p', { class: 'muted dex-empty', hidden: true }, 'No Pokémon match.');
  const shows = (n: number, name: string) => {
    if (filter !== 'all' && stateOf(n) !== filter) return false;
    const q = query.trim().toLowerCase().replace(/^#/, '');
    if (!q) return true;
    return /^\d+$/.test(q) ? String(n).startsWith(q) || String(n).padStart(3, '0').startsWith(q) : name.toLowerCase().includes(q);
  };
  const applyFilter = () => {
    let any = false;
    tiles.forEach((t) => { t.tile.hidden = !shows(t.n, t.name); any ||= !t.tile.hidden; });
    empty.hidden = any;
  };

  const tiles = names.map((name, i) => {
    const n = i + 1;
    const tile = h('button', { class: 'dex-tile' },
      pokemonIcon(n),
      itemIcon('ball/poke', 'dex-ball'),
      h('span', { class: 'dex-no' }, `#${String(n).padStart(3, '0')}`),
      h('span', { class: 'dex-name' }, name));
    const paint = () => {
      const st = stateOf(n);
      tile.className = `dex-tile ${st}`;
      tile.setAttribute('aria-label', `#${n} ${name}: ${LABEL[st]}. Tap to change.`);
    };
    tile.addEventListener('click', () => {
      const st = stateOf(n);
      if (st === 'unseen') s.setSeen(n, true);
      else if (st === 'seen') s.setOwned(n, true);
      else s.setSeen(n, false);
      // The tile stays put even if it no longer matches the filter, so a second tap still reaches it.
      markDirty(); paint(); paintSummary();
    });
    paint();
    return { tile, paint, n, name };
  });
  const each = (f: (n: number) => void) => {
    for (let n = 1; n <= total; n++) f(n);
    markDirty(); tiles.forEach((t) => t.paint()); paintSummary(); applyFilter();
  };

  const chips = FILTERS.map((f) => h('button', {
    class: f.id === filter ? 'chip-btn on' : 'chip-btn', 'aria-pressed': String(f.id === filter),
    onclick: () => {
      filter = f.id;
      chips.forEach((c, i) => { c.classList.toggle('on', FILTERS[i].id === filter); c.setAttribute('aria-pressed', String(FILTERS[i].id === filter)); });
      applyFilter();
    },
  }, f.label));
  const search = h('input', {
    type: 'search', class: 'dex-search', value: query, placeholder: 'Name or number', 'aria-label': 'Find a Pokémon by name or number',
    oninput: () => { query = search.value; applyFilter(); },
  });

  paintSummary();
  applyFilter();
  return h('div', {},
    h('p', { class: 'tab-intro' },
      'Tap a Pokémon to cycle it: not seen, then seen, then caught. A dark shape is not seen, colour is seen, and a tile '
      + 'with a Poké Ball is caught. Caught only fills in the Pokédex; it doesn\'t give you the Pokémon.'),
    h('div', { class: 'dex-head' },
      summary,
      h('div', { class: 'button-row tight' },
        h('button', { onclick: () => each((n) => s.setOwned(n, true)) }, 'All caught'),
        h('button', { onclick: () => each((n) => s.setSeen(n, true)) }, 'All seen'),
        h('button', { onclick: () => each((n) => s.setSeen(n, false)) }, 'Clear all'))),
    h('div', { class: 'dex-tools' },
      h('div', { class: 'dex-filter', role: 'group', 'aria-label': 'Show' }, chips),
      search),
    h('div', { class: 'dex-grid' }, tiles.map((t) => t.tile)),
    empty,
  );
}
