// Gen 1 (Red / Blue / Yellow) editor UI. Loaded lazily by the shell via the game module.

import {
  DEX_NAMES, DEX_TO_INTERNAL, INTERNAL_TO_DEX, ITEM_CHOICES, baseStatsFor, itemName, speciesName,
} from '../../../core/gen1/data.ts';
import { newMon, recalcPartyStats, type BagItem, type Gen1Mon, type Gen1Save } from '../../../core/gen1/save.ts';
import type { EditorHost, MountEditor } from '../../../core/types.ts';
import { askConfirm, clear, field, h, numberInput, selectInput, textInput } from '../../dom.ts';
import { badgeIcon, itemIcon, itemIconUrl, pokemonIcon, setIconSrc } from '../../sprites.ts';
import { itemSpritePath } from './itemSprites.ts';
import { openMonEditor } from './monEditor.ts';
import { typeChips } from './typeChip.ts';

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
  /** Redraws the trainer-card summary; set while the Trainer tab is showing. */
  let refreshOverview: () => void = () => {};
  const edited = () => { markDirty(); refreshOverview(); };

  const render = () => {
    refreshOverview = () => {};
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

  const popcount = (n: number) => { let c = 0; for (let v = n & 0xff; v; v &= v - 1) c++; return c; };
  const monLabel = (mon: Gen1Mon) => (mon.nickname && mon.nickname.toLowerCase() !== speciesName(mon.species).toLowerCase() ? mon.nickname : speciesName(mon.species));

  /** The in-game trainer card at a glance, plus the party as icons (tap one to edit it). */
  function overview(): HTMLElement {
    const wrap = h('section', { class: 'card overview' });
    const stat = (label: string, value: string) => h('div', {}, h('dt', {}, label), h('dd', {}, value));
    const draw = () => {
      clear(wrap);
      wrap.append(
        h('div', { class: 'lcd tcard' },
          h('div', { class: 'tcard-top' },
            h('span', { class: 'tcard-name' }, s.trainerName || '—'),
            h('span', { class: 'tcard-id' }, `ID ${String(s.trainerId).padStart(5, '0')}`)),
          h('dl', { class: 'tcard-stats' },
            stat('Money', `¥${s.money.toLocaleString('en-US')}`),
            stat('Coins', s.coins.toLocaleString('en-US')),
            stat('Time', `${s.playHours}:${String(s.playMinutes).padStart(2, '0')}`),
            stat('Badges', `${popcount(s.badges)}/8`)),
          h('div', { class: 'tcard-badges', role: 'img', 'aria-label': `${popcount(s.badges)} of 8 badges earned` },
            BADGES.map((_, i) => badgeIcon(i + 1, (s.badges >> i) & 1 ? 'earned' : ''))),
        ),
        h('div', { class: 'party-strip', role: 'group', 'aria-label': 'Party' }, Array.from({ length: 6 }, (_, i) => {
          const mon = s.party[i];
          if (!mon) return h('span', { class: 'party-slot empty', 'aria-hidden': 'true' });
          return h('button', {
            class: 'party-slot', 'aria-label': `${monLabel(mon)}, level ${mon.level}. Edit`,
            onclick: () => openMonEditor({ mon, party: true, onDone: () => { markDirty(); draw(); } }),
          }, pokemonIcon(INTERNAL_TO_DEX[mon.species]),
          h('span', { class: 'slot-name' }, monLabel(mon)),
          h('span', { class: 'lv-tag' }, `Lv ${mon.level}`));
        })),
      );
    };
    refreshOverview = draw;
    draw();
    return wrap;
  }

  function trainerTab(): Node {
    const badgeRow = h('div', { class: 'badge-grid' }, BADGES.map((name, i) => {
      const btn = h('button', { class: 'badge-btn', 'aria-pressed': String(Boolean((s.badges >> i) & 1)) },
        h('span', { class: 'gem', 'aria-hidden': 'true' }, badgeIcon(i + 1)), name);
      btn.addEventListener('click', () => {
        s.badges ^= 1 << i;
        btn.setAttribute('aria-pressed', String(Boolean((s.badges >> i) & 1)));
        edited();
      });
      return btn;
    }));
    return h('div', { class: 'stack' },
      overview(),
      h('section', { class: 'card' },
        h('h3', {}, 'Trainer'),
        h('div', { class: 'grid' },
          field('Trainer name', textInput(s.trainerName, 10, (v) => { s.trainerName = v; edited(); }), 'In-game limit is 7 characters'),
          field('Rival name', textInput(s.rivalName, 10, (v) => { s.rivalName = v; markDirty(); })),
          field('Trainer ID', numberInput(s.trainerId, 0, 65535, (v) => { s.trainerId = v; edited(); })),
          field('Money (¥)', numberInput(s.money, 0, 999999, (v) => { s.money = v; edited(); })),
          field('Game Corner coins', numberInput(s.coins, 0, 9999, (v) => { s.coins = v; edited(); })),
        ),
        h('div', { class: 'button-row' },
          h('button', { onclick: () => { s.money = 999999; s.coins = 9999; markDirty(); render(); } }, 'Max money & coins'),
        )),
      h('section', { class: 'card' },
        h('h3', {}, 'Play time'),
        h('div', { class: 'grid compact' },
          field('Hours', numberInput(s.playHours, 0, 255, (v) => { s.playHours = v; edited(); })),
          field('Minutes', numberInput(s.playMinutes, 0, 59, (v) => { s.playMinutes = v; edited(); })),
          field('Seconds', numberInput(s.playSeconds, 0, 59, (v) => { s.playSeconds = v; markDirty(); })),
        )),
      h('section', { class: 'card' },
        h('h3', {}, 'Badges'),
        badgeRow,
        h('div', { class: 'button-row' },
          h('button', { onclick: () => { s.badges = 0xff; markDirty(); render(); } }, 'All badges'),
          h('button', { onclick: () => { s.badges = 0; markDirty(); render(); } }, 'Clear badges'),
        )),
    );
  }

  // ---------- bag ----------

  function itemList(title: string, items: BagItem[], max: number): Node {
    const wrap = h('section', { class: 'card' });
    const draw = () => {
      clear(wrap);
      wrap.append(
        h('h3', {}, title, h('span', { class: 'muted count' }, `${items.length}/${max}`)),
        ...items.map((it, i) => {
          const icon = itemIcon(itemSpritePath(it.id));
          return h('div', { class: 'item-row' },
            icon,
            selectInput(
              ITEM_CHOICES.some((c) => c.id === it.id) ? ITEM_CHOICES.map((c) => ({ value: c.id, label: c.name }))
                : [{ value: it.id, label: itemName(it.id) }, ...ITEM_CHOICES.map((c) => ({ value: c.id, label: c.name }))],
              it.id, (v) => { it.id = Number(v); setIconSrc(icon, itemIconUrl(itemSpritePath(it.id))); markDirty(); }),
            numberInput(it.count, 1, 99, (v) => { it.count = v; markDirty(); }, { 'aria-label': 'Quantity' }),
            h('button', { class: 'icon', 'aria-label': 'Remove', onclick: () => { items.splice(i, 1); markDirty(); draw(); } }, '✕'),
          );
        }),
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
    const dex = INTERNAL_TO_DEX[mon.species];
    const showNick = mon.nickname && mon.nickname.toLowerCase() !== name.toLowerCase();
    return h('div', { class: 'mon' },
      h('button', { class: 'mon-main', onclick: onOpen },
        pokemonIcon(dex),
        h('span', { class: 'mon-title' },
          dex ? h('span', { class: 'mon-dex' }, `#${String(dex).padStart(3, '0')}`) : null,
          h('span', { class: 'mon-name' }, showNick ? `${mon.nickname} ` : name),
          showNick ? h('span', { class: 'muted' }, `(${name})`) : null),
        h('span', { class: 'mon-meta' },
          h('span', { class: 'lcd lv' }, `Lv ${mon.level}`),
          typeChips(baseStatsFor(mon.species))),
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
      if (!mons.length) wrap.append(h('p', { class: 'muted' }, 'No Pokémon here yet.'));
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
    type DexState = 'unseen' | 'seen' | 'owned';
    const stateOf = (n: number): DexState => (s.isOwned(n) ? 'owned' : s.isSeen(n) ? 'seen' : 'unseen');
    const summary = h('p', { class: 'lcd dex-summary' });
    const paintSummary = () => {
      const owned = DEX_NAMES.filter((_, i) => s.isOwned(i + 1)).length;
      const seen = DEX_NAMES.filter((_, i) => s.isSeen(i + 1)).length;
      summary.textContent = `Owned ${owned}/151 · Seen ${seen}/151`;
    };
    const tiles = DEX_NAMES.map((name, i) => {
      const n = i + 1;
      const tile = h('button', { class: 'dex-tile' },
        pokemonIcon(n),
        itemIcon('ball/poke', 'dex-ball'),
        h('span', { class: 'dex-no' }, `#${String(n).padStart(3, '0')}`),
        h('span', { class: 'dex-name' }, name));
      const paint = () => {
        const st = stateOf(n);
        tile.className = `dex-tile ${st}`;
        tile.setAttribute('aria-label', `#${n} ${name}: ${st}. Tap to change.`);
      };
      tile.addEventListener('click', () => {
        const st = stateOf(n);
        if (st === 'unseen') s.setSeen(n, true);
        else if (st === 'seen') s.setOwned(n, true);
        else s.setSeen(n, false);
        markDirty(); paint(); paintSummary();
      });
      paint();
      return { tile, paint };
    });
    const repaint = () => { tiles.forEach((t) => t.paint()); paintSummary(); };
    paintSummary();
    return h('div', {},
      summary,
      h('p', { class: 'muted dex-hint' }, 'Tap a Pokémon to cycle it: unseen, seen, owned.'),
      h('div', { class: 'button-row' },
        h('button', { onclick: () => { DEX_NAMES.forEach((_, i) => s.setOwned(i + 1, true)); markDirty(); repaint(); } }, 'Complete Pokédex'),
        h('button', { onclick: () => { DEX_NAMES.forEach((_, i) => s.setSeen(i + 1, true)); markDirty(); repaint(); } }, 'Mark all seen'),
        h('button', { onclick: () => { DEX_NAMES.forEach((_, i) => s.setSeen(i + 1, false)); markDirty(); repaint(); } }, 'Clear'),
      ),
      h('div', { class: 'dex-grid' }, tiles.map((t) => t.tile)),
    );
  }

  render();
};

export type { EditorHost };
