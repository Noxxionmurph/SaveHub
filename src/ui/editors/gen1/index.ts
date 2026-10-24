// Gen 1 (Red / Blue / Yellow) editor UI. Loaded lazily by the shell via the game module.

import { DEX_NAMES, DEX_TO_INTERNAL, ITEM_CHOICES, itemName, speciesName } from '../../../core/gen1/data.ts';
import { newMon, recalcPartyStats, type BagItem, type Gen1Mon, type Gen1Save } from '../../../core/gen1/save.ts';
import type { EditorHost, MountEditor } from '../../../core/types.ts';
import { askConfirm, clear, field, h, numberInput, selectInput, textInput } from '../../dom.ts';
import { openMonEditor } from './monEditor.ts';

type Tab = 'trainer' | 'bag' | 'party' | 'boxes' | 'dex';
const TABS: { id: Tab; label: string }[] = [
  { id: 'trainer', label: 'Trainer' },
  { id: 'bag', label: 'Bag' },
  { id: 'party', label: 'Party' },
  { id: 'boxes', label: 'Boxes' },
  { id: 'dex', label: 'Pokédex' },
];
const BADGES = ['Boulder', 'Cascade', 'Thunder', 'Rainbow', 'Soul', 'Marsh', 'Volcano', 'Earth'];

export const mountGen1Editor: MountEditor<Gen1Save> = (container, s, host) => {
  let tab: Tab = 'trainer';
  let boxView = s.currentBoxIndex;
  const markDirty = () => host.markDirty();

  const render = () => {
    clear(container);
    container.append(
      h('nav', { class: 'tabs', role: 'tablist' }, TABS.map((t) =>
        h('button', {
          role: 'tab', class: t.id === tab ? 'tab active' : 'tab', 'aria-selected': String(t.id === tab),
          onclick: () => { tab = t.id; render(); },
        }, t.label))),
      h('main', { class: 'panel' }, renderTab()),
    );
  };

  function renderTab(): Node {
    switch (tab) {
      case 'trainer': return trainerTab();
      case 'bag': return bagTab();
      case 'party': return partyTab();
      case 'boxes': return boxesTab();
      case 'dex': return dexTab();
    }
  }

  // ---------- trainer ----------

  function trainerTab(): Node {
    return h('div', {},
      h('div', { class: 'grid' },
        field('Trainer name', textInput(s.trainerName, 10, (v) => { s.trainerName = v; markDirty(); }), 'In-game limit is 7 characters'),
        field('Rival name', textInput(s.rivalName, 10, (v) => { s.rivalName = v; markDirty(); })),
        field('Trainer ID', numberInput(s.trainerId, 0, 65535, (v) => { s.trainerId = v; markDirty(); })),
        field('Money (¥)', numberInput(s.money, 0, 999999, (v) => { s.money = v; markDirty(); })),
        field('Game Corner coins', numberInput(s.coins, 0, 9999, (v) => { s.coins = v; markDirty(); })),
      ),
      h('h3', {}, 'Play time'),
      h('div', { class: 'grid compact' },
        field('Hours', numberInput(s.playHours, 0, 255, (v) => { s.playHours = v; markDirty(); })),
        field('Minutes', numberInput(s.playMinutes, 0, 59, (v) => { s.playMinutes = v; markDirty(); })),
        field('Seconds', numberInput(s.playSeconds, 0, 59, (v) => { s.playSeconds = v; markDirty(); })),
      ),
      h('h3', {}, 'Badges'),
      h('div', { class: 'badges' }, BADGES.map((name, i) => {
        const box = h('input', { type: 'checkbox', checked: Boolean((s.badges >> i) & 1) });
        box.addEventListener('change', () => {
          s.badges = box.checked ? s.badges | (1 << i) : s.badges & ~(1 << i);
          markDirty();
        });
        return h('label', { class: 'chip' }, box, name);
      })),
      h('div', { class: 'button-row' },
        h('button', { onclick: () => { s.badges = 0xff; markDirty(); render(); } }, 'All badges'),
        h('button', { onclick: () => { s.money = 999999; s.coins = 9999; markDirty(); render(); } }, 'Max money & coins'),
      ),
    );
  }

  // ---------- bag ----------

  function itemList(title: string, items: BagItem[], max: number): Node {
    const wrap = h('section', { class: 'card' });
    const draw = () => {
      clear(wrap);
      wrap.append(
        h('h3', {}, `${title} `, h('span', { class: 'muted' }, `${items.length}/${max}`)),
        ...items.map((it, i) => h('div', { class: 'item-row' },
          selectInput(
            ITEM_CHOICES.some((c) => c.id === it.id) ? ITEM_CHOICES.map((c) => ({ value: c.id, label: c.name }))
              : [{ value: it.id, label: itemName(it.id) }, ...ITEM_CHOICES.map((c) => ({ value: c.id, label: c.name }))],
            it.id, (v) => { it.id = Number(v); markDirty(); }),
          numberInput(it.count, 1, 99, (v) => { it.count = v; markDirty(); }, { 'aria-label': 'Quantity' }),
          h('button', { class: 'icon', 'aria-label': 'Remove', onclick: () => { items.splice(i, 1); markDirty(); draw(); } }, '✕'),
        )),
        h('button', {
          disabled: items.length >= max,
          onclick: () => { items.push({ id: 0x28, count: 99 }); markDirty(); draw(); },
        }, '+ Add item'),
      );
    };
    draw();
    return wrap;
  }

  const bagTab = () => h('div', { class: 'two-col' }, itemList('Bag', s.bag, 20), itemList('PC item storage', s.pcItems, 50));

  // ---------- Pokémon lists ----------

  function monCard(mon: Gen1Mon, onOpen: () => void, extra: Node[] = []): HTMLElement {
    const name = speciesName(mon.species);
    const showNick = mon.nickname && mon.nickname.toLowerCase() !== name.toLowerCase();
    return h('div', { class: 'mon' },
      h('button', { class: 'mon-main', onclick: onOpen },
        h('span', { class: 'mon-name' }, showNick ? `${mon.nickname} ` : name,
          showNick ? h('span', { class: 'muted' }, `(${name})`) : null),
        h('span', { class: 'muted' }, `Lv ${mon.level}`),
      ),
      ...extra,
    );
  }

  function monList(mons: Gen1Mon[], max: number, party: boolean): Node {
    const wrap = h('div', { class: 'mon-list' });
    const draw = () => {
      clear(wrap);
      mons.forEach((mon, i) => {
        wrap.append(monCard(
          mon,
          () => openMonEditor({ mon, party, onDone: () => { markDirty(); draw(); } }),
          [
            h('button', { class: 'icon', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { [mons[i - 1], mons[i]] = [mons[i], mons[i - 1]]; markDirty(); draw(); } }, '↑'),
            h('button', { class: 'icon', 'aria-label': 'Move down', disabled: i === mons.length - 1, onclick: () => { [mons[i + 1], mons[i]] = [mons[i], mons[i + 1]]; markDirty(); draw(); } }, '↓'),
            h('button', { class: 'icon', 'aria-label': 'Delete', onclick: async () => { if (await askConfirm(`Remove ${speciesName(mon.species)}?`, 'Remove')) { mons.splice(i, 1); markDirty(); draw(); } } }, '✕'),
          ],
        ));
      });
      if (!mons.length) wrap.append(h('p', { class: 'muted' }, 'Empty.'));
      wrap.append(h('button', {
        disabled: mons.length >= max,
        onclick: () => {
          const mon = newMon(DEX_TO_INTERNAL[25], 5);
          mon.otName = s.trainerName;
          mon.otId = s.trainerId;
          if (party) recalcPartyStats(mon, true);
          mons.push(mon);
          markDirty();
          openMonEditor({ mon, party, onDone: () => { markDirty(); draw(); } });
          draw();
        },
      }, `+ Add Pokémon (${mons.length}/${max})`));
    };
    draw();
    return wrap;
  }

  const partyTab = () => h('div', {},
    h('p', { class: 'muted' }, 'Party Pokémon store their battle stats directly; use “Recalc stats & heal” in the editor after changing level, DVs or EVs.'),
    monList(s.party, 6, true));

  function boxesTab(): Node {
    const holder = h('div');
    const draw = () => {
      clear(holder);
      holder.append(
        h('div', { class: 'box-picker' },
          field('Box', selectInput(
            Array.from({ length: 12 }, (_, i) => ({
              value: i,
              label: `Box ${i + 1}${i === s.currentBoxIndex ? ' (current)' : ''} — ${s.boxes[i]?.length ?? 0}/20`,
            })), boxView, (v) => { boxView = Number(v); draw(); })),
        ),
        monList((s.boxes[boxView] ??= []), 20, false),
      );
    };
    draw();
    return holder;
  }

  // ---------- Pokédex ----------

  function dexTab(): Node {
    const wrap = h('div');
    const draw = () => {
      clear(wrap);
      const owned = DEX_NAMES.filter((_, i) => s.isOwned(i + 1)).length;
      const seen = DEX_NAMES.filter((_, i) => s.isSeen(i + 1)).length;
      wrap.append(
        h('p', { class: 'muted' }, `Owned ${owned}/151 · Seen ${seen}/151`),
        h('div', { class: 'button-row' },
          h('button', { onclick: () => { DEX_NAMES.forEach((_, i) => s.setOwned(i + 1, true)); markDirty(); draw(); } }, 'Complete Pokédex'),
          h('button', { onclick: () => { DEX_NAMES.forEach((_, i) => s.setSeen(i + 1, true)); markDirty(); draw(); } }, 'Mark all seen'),
          h('button', { onclick: () => { DEX_NAMES.forEach((_, i) => s.setSeen(i + 1, false)); markDirty(); draw(); } }, 'Clear'),
        ),
        h('div', { class: 'dex-grid' }, DEX_NAMES.map((name, i) => {
          const n = i + 1;
          const own = Boolean(s.isOwned(n)), see = Boolean(s.isSeen(n));
          return h('div', { class: `dex ${own ? 'owned' : see ? 'seen' : ''}` },
            h('span', { class: 'dex-name' }, `#${String(n).padStart(3, '0')} ${name}`),
            h('span', { class: 'dex-actions' },
              h('button', { class: see ? 'toggle on' : 'toggle', title: 'Seen', onclick: () => { s.setSeen(n, !see); markDirty(); draw(); } }, 'Seen'),
              h('button', { class: own ? 'toggle on' : 'toggle', title: 'Owned', onclick: () => { s.setOwned(n, !own); markDirty(); draw(); } }, 'Own'),
            ));
        })),
      );
    };
    draw();
    return wrap;
  }

  render();
};

export type { EditorHost };
