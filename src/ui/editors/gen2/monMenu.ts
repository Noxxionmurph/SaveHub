// The action sheet for one Pokémon: edit, move to another place, copy, reorder, remove.
// The rules live in core/gen2/roster.ts; this only asks and reports.

import { baseStatsFor, speciesName } from '../../../core/gen2/data.ts';
import {
  ALL_PLACES, PARTY, REFUSAL_TEXT, capacityOf, copyMon, listAt, moveMon, partyLeaveRefusal, placeName, removeMon, shiftMon, spaceAt, type Refusal,
} from '../../../core/gen2/roster.ts';
import type { Gen2Save } from '../../../core/gen2/save.ts';
import { askConfirm, clear, h, toast } from '../../dom.ts';
import { typeChips } from '../../typeChip.ts';
import { monIcon, monLabel } from './monBits.ts';

export interface MonMenuOptions {
  save: Gen2Save;
  /** PARTY or a box index. */
  where: number;
  index: number;
  /** Open the full editor for this Pokémon. */
  onEdit: () => void;
  /** Something changed (lists were rearranged); redraw. */
  onChange: () => void;
}

export function openMonMenu({ save, where, index, onEdit, onChange }: MonMenuOptions): void {
  const mon = listAt(save, where)[index];
  if (!mon) return;
  const name = monLabel(mon);
  const species = mon.isEgg ? `Egg (${speciesName(mon.species)})` : speciesName(mon.species);
  const dlg = h('dialog', { class: 'sheet-dialog', 'aria-label': `${name}: actions` });
  const body = h('div', { class: 'dialog-body' });
  dlg.append(body);

  // Messages about a refused change go inside the sheet: a toast would sit behind the open dialog.
  const note = h('p', { class: 'sheet-note', role: 'alert' });
  const finish = (message: string) => { dlg.close(); toast(message); onChange(); };
  const refuse = (r: Refusal) => { note.textContent = REFUSAL_TEXT[r]; };
  /** append() would print "null" for an absent node, so filter first. */
  const put = (...nodes: (Node | null)[]) => { clear(body); body.append(...nodes.filter((n): n is Node => n !== null)); };

  const header = () => h('div', { class: 'sheet-head' },
    monIcon(mon, 'big'),
    h('div', {},
      h('h2', {}, name),
      h('p', { class: 'muted' }, `${species}${mon.isEgg ? '' : ` · Lv ${mon.level}`} · ${placeName(where)}${where === PARTY ? ` ${index + 1}` : `, slot ${index + 1}`}`),
      mon.isEgg ? null : typeChips(baseStatsFor(mon.species))));

  function actions(): void {
    note.textContent = '';
    const list = listAt(save, where);
    put(
      header(),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'primary', onclick: () => { dlg.close(); onEdit(); } }, 'Edit'),
        h('button', { onclick: destinations }, 'Move to…'),
        h('button', {
          onclick: () => {
            const r = copyMon(save, where, index);
            if (typeof r === 'string') return refuse(r);
            finish(r.where === where ? `Duplicated ${name}.` : `Duplicated ${name} into ${placeName(r.where)} because ${placeName(where)} is full.`);
          },
        }, 'Duplicate'),
        // Party members have arrows on the Party tab; boxes don't, so the menu keeps them for boxes.
        where === PARTY ? null : h('div', { class: 'sheet-pair' },
          h('button', { disabled: index === 0, onclick: () => { shiftMon(save, where, index, -1); finish(`Moved ${name} up.`); } }, '↑ Earlier'),
          h('button', { disabled: index >= list.length - 1, onclick: () => { shiftMon(save, where, index, 1); finish(`Moved ${name} down.`); } }, '↓ Later')),
        h('button', {
          class: 'danger',
          onclick: async () => {
            if (where === PARTY) { const r = partyLeaveRefusal(save, index); if (r) return refuse(r); }
            dlg.close();
            if (!await askConfirm(`Remove ${name} from ${placeName(where)}?`, 'Remove')) return;
            const r = removeMon(save, where, index);
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
    const leave = where === PARTY ? partyLeaveRefusal(save, index) : null;
    put(
      header(),
      h('h3', {}, 'Move to'),
      h('p', { class: 'muted' }, 'Pick where to send it. The numbers show how many Pokémon are already in each place.'),
      h('div', { class: 'dest-list' }, ALL_PLACES.filter((w) => w !== where).map((w) => {
        const free = spaceAt(save, w);
        const blocked = free <= 0 || leave !== null;
        return h('button', {
          class: 'dest', disabled: blocked,
          onclick: () => {
            const r = moveMon(save, where, index, w);
            if (r) refuse(r); else finish(`Moved ${name} to ${placeName(w)}.`);
          },
        }, h('span', {}, placeName(w)),
        h('span', { class: 'muted' }, free <= 0 ? 'Full' : `${capacityOf(w) - free}/${capacityOf(w)}`));
      })),
      leave ? h('p', { class: 'muted' }, REFUSAL_TEXT[leave]) : null,
      note,
      h('div', { class: 'button-row end' }, h('button', { onclick: actions }, 'Back')),
    );
  }

  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  actions();
  dlg.showModal();
}
