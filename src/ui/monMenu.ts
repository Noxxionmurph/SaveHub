// The action sheet for one Pokémon, for every generation: edit, move to another place, copy, reorder, remove.
// Each game's roster.ts holds the rules and editors/<game>/monMenu.ts says how its Pokémon look; this only asks and reports.

import { askConfirm, clear, h, toast } from './dom.ts';

/** What a game's roster.ts provides. A place is PARTY or a box index. */
export interface Roster<S, M> {
  PARTY: number;
  ALL_PLACES: readonly number[];
  REFUSAL_TEXT: Readonly<Record<string, string>>;
  monAt(s: S, where: number, index: number): M | null | undefined;
  capacityOf(where: number): number;
  spaceAt(s: S, where: number): number;
  placeName(where: number): string;
  moveMon(s: S, from: number, index: number, to: number): string | null;
  removeMon(s: S, from: number, index: number): string | null;
  copyMon(s: S, from: number, index: number): { where: number; index: number } | string;
  shiftMon(s: S, where: number, index: number, delta: -1 | 1): boolean;
  /** Why this party member can't leave the party (the last one, or the last that can battle), or null. */
  partyLeaveRefusal(s: S, index: number): string | null;
  /** The last slot a Pokémon here can be moved down to. */
  lastIndex(s: S, where: number): number;
}

/** How a game shows one of its Pokémon at the top of the sheet. */
export interface MonLook<M> {
  name(mon: M): string;
  icon(mon: M): Node;
  /** Extra marks after the name (shiny). */
  marks(mon: M): Node | null;
  /** The species line: "Pikachu", "Egg (Togepi)". */
  species(mon: M): string;
  /** Eggs and Bad Eggs have no level or types to show. */
  plain(mon: M): boolean;
  types(mon: M): Node | null;
  /** A Bad Egg's data is damaged, so it can only be moved or removed. */
  canEdit(mon: M): boolean;
}

export interface MonMenuOptions<S> {
  save: S;
  /** PARTY or a box index. */
  where: number;
  index: number;
  /** Open the full editor for this Pokémon. */
  onEdit: () => void;
  /** Something changed (lists were rearranged); redraw. */
  onChange: () => void;
}

export function openMonMenu<S, M extends { level: number }>(R: Roster<S, M>, look: MonLook<M>, { save, where, index, onEdit, onChange }: MonMenuOptions<S>): void {
  const mon = R.monAt(save, where, index);
  if (!mon) return;
  const name = look.name(mon);
  const dlg = h('dialog', { class: 'sheet-dialog', 'aria-label': `${name}: actions` });
  const body = h('div', { class: 'dialog-body' });
  dlg.append(body);

  // Messages about a refused change go inside the sheet: a toast would sit behind the open dialog.
  const note = h('p', { class: 'sheet-note', role: 'alert' });
  const finish = (message: string) => { dlg.close(); toast(message); onChange(); };
  const refuse = (r: string) => { note.textContent = R.REFUSAL_TEXT[r]; };
  /** append() would print "null" for an absent node, so filter first. */
  const put = (...nodes: (Node | null)[]) => { clear(body); body.append(...nodes.filter((n): n is Node => n !== null)); };

  const header = () => h('div', { class: 'sheet-head' },
    look.icon(mon),
    h('div', {},
      h('h2', {}, name, look.marks(mon)),
      h('p', { class: 'muted' }, `${look.species(mon)}${look.plain(mon) ? '' : ` · Lv ${mon.level}`} · ${R.placeName(where)}${where === R.PARTY ? ` ${index + 1}` : `, slot ${index + 1}`}`),
      look.plain(mon) ? null : look.types(mon)));

  function actions(): void {
    note.textContent = '';
    put(
      header(),
      h('div', { class: 'sheet-actions' },
        look.canEdit(mon!) ? h('button', { class: 'primary', onclick: () => { dlg.close(); onEdit(); } }, 'Edit') : null,
        h('button', { onclick: destinations }, 'Move to…'),
        h('button', {
          onclick: () => {
            const r = R.copyMon(save, where, index);
            if (typeof r === 'string') return refuse(r);
            finish(r.where === where ? `Duplicated ${name}.` : `Duplicated ${name} into ${R.placeName(r.where)} because ${R.placeName(where)} is full.`);
          },
        }, 'Duplicate'),
        // Party members have arrows on the Party tab; boxes don't, so the menu keeps them for boxes.
        where === R.PARTY ? null : h('div', { class: 'sheet-pair' },
          h('button', { disabled: index === 0, onclick: () => { R.shiftMon(save, where, index, -1); finish(`Moved ${name} up.`); } }, '↑ Earlier'),
          h('button', { disabled: index >= R.lastIndex(save, where), onclick: () => { R.shiftMon(save, where, index, 1); finish(`Moved ${name} down.`); } }, '↓ Later')),
        h('button', {
          class: 'danger',
          onclick: async () => {
            if (where === R.PARTY) { const r = R.partyLeaveRefusal(save, index); if (r) return refuse(r); }
            dlg.close();
            if (!await askConfirm(`Remove ${name} from ${R.placeName(where)}?`, 'Remove')) return;
            const r = R.removeMon(save, where, index);
            if (r) return refuse(r);
            toast(`Removed ${name}.`);
            onChange();
          },
        }, 'Remove'),
      ),
      note,
      h('div', { class: 'button-row end' }, h('button', { onclick: () => dlg.close() }, 'Close')),
    );
  }

  function destinations(): void {
    note.textContent = '';
    // Leaving the party can be refused before a place is even picked: it may be the last one that can battle.
    const leave = where === R.PARTY ? R.partyLeaveRefusal(save, index) : null;
    put(
      header(),
      h('h3', {}, 'Move to'),
      h('p', { class: 'muted' }, 'Pick where to send it. The numbers show how many Pokémon are already in each place.'),
      h('div', { class: 'dest-list' }, R.ALL_PLACES.filter((w) => w !== where).map((w) => {
        const free = R.spaceAt(save, w);
        const blocked = free <= 0 || leave !== null;
        return h('button', {
          class: 'dest', disabled: blocked,
          onclick: () => {
            const r = R.moveMon(save, where, index, w);
            if (r) refuse(r); else finish(`Moved ${name} to ${R.placeName(w)}.`);
          },
        }, h('span', {}, R.placeName(w)),
        h('span', { class: 'muted' }, free <= 0 ? 'Full' : `${R.capacityOf(w) - free}/${R.capacityOf(w)}`));
      })),
      leave ? h('p', { class: 'muted' }, R.REFUSAL_TEXT[leave]) : null,
      note,
      h('div', { class: 'button-row end' }, h('button', { onclick: actions }, 'Back')),
    );
  }

  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  actions();
  dlg.showModal();
}
