// Gen 1 (Red / Blue / Yellow) editor UI. Loaded lazily by the shell via the game module.

import {
  BADGE_NAMES, DEX_NAMES, DEX_TO_INTERNAL, INTERNAL_TO_DEX, ITEM_CHOICES, TEXT_SPEEDS, baseStatsFor, friendshipLabel, itemName, speciesName,
} from '../../../core/gen1/data.ts';
import { BOX_MAX, BOX_TOTAL, PARTY, PARTY_MAX, listAt, shiftMon } from '../../../core/gen1/roster.ts';
import { PIKACHU_INTERNAL, newMon, recalcPartyStats, type BagItem, type Gen1Mon, type Gen1Save } from '../../../core/gen1/save.ts';
import type { EditorHost, MountEditor } from '../../../core/types.ts';
import { clear, field, h, numberInput, selectInput, textInput } from '../../dom.ts';
import { badgeIcon, itemIcon, itemIconUrl, pokemonIcon, setIconSrc } from '../../sprites.ts';
import { itemSpritePath } from './itemSprites.ts';
import { openMonEditor } from './monEditor.ts';
import { openMonMenu } from './monMenu.ts';
import { typeChips } from './typeChip.ts';

type Tab = 'trainer' | 'bag' | 'party' | 'boxes' | 'dex';
const TABS: { id: Tab; label: string }[] = [
  { id: 'trainer', label: 'Trainer' },
  { id: 'bag', label: 'Bag' },
  { id: 'party', label: 'Party' },
  { id: 'boxes', label: 'Boxes' },
  { id: 'dex', label: 'Pokédex' },
];
const BADGES = BADGE_NAMES;

export const mountGen1Editor: MountEditor<Gen1Save> = (container, s, host) => {
  let tab: Tab = 'trainer';
  let boxView = s.currentBoxIndex;
  const markDirty = () => host.markDirty();
  /** Redraw hooks for parts of the Trainer tab that depend on its fields (card summary, starter Pikachu). */
  let refreshers: (() => void)[] = [];
  const edited = () => { markDirty(); refreshers.forEach((f) => f()); };

  const render = () => {
    refreshers = [];
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
    refreshers.push(draw);
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
      pikachuCard(),
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
      optionsCard(),
    );
  }


  /** Pokémon Yellow only: how much your starter Pikachu likes you, and whether the game still counts it as yours. */
  function pikachuCard(): Node | null {
    if (!s.isYellow) return null;
    const label = h('span', { class: 'friend-label' });
    const value = h('output', { class: 'friend-value', 'aria-label': 'Friendship' });
    const slider = h('input', { type: 'range', min: 0, max: 255, step: 1, value: String(s.pikachuFriendship), 'aria-label': 'Friendship' });
    const number = numberInput(s.pikachuFriendship, 0, 255, (v) => set(v), { 'aria-label': 'Friendship number' });
    const paint = () => { value.textContent = String(s.pikachuFriendship); label.textContent = friendshipLabel(s.pikachuFriendship); };
    function set(v: number): void {
      s.pikachuFriendship = v;
      slider.value = String(v);
      number.value = String(v);
      paint();
      markDirty();
    }
    slider.addEventListener('input', () => set(Number(slider.value)));

    const status = h('div', { class: 'starter-status', 'aria-live': 'polite' });
    const drawStatus = () => {
      clear(status);
      const at = s.party.findIndex((m) => s.isStarterPikachu(m));
      if (at >= 0) {
        status.append(h('p', {}, h('strong', {}, 'Starter Pikachu: '), `${monLabel(s.party[at])} (party ${at + 1}). It follows you while it's in your party and hasn't fainted.`));
        return;
      }
      const other = s.party.findIndex((m) => m.species === PIKACHU_INTERNAL);
      if (other < 0) {
        status.append(h('p', {}, h('strong', {}, 'No starter Pikachu in your party. '),
          'The game only counts a Pikachu whose original trainer (OT) is your name and Trainer ID. Put one in your party, then use the button here.'));
        return;
      }
      status.append(
        h('p', {}, h('strong', {}, 'Not your starter. '),
          `${monLabel(s.party[other])}'s original trainer doesn't match your name and Trainer ID, so it won't follow you.`),
        h('button', { onclick: () => { s.makeStarter(s.party[other]); markDirty(); drawStatus(); } }, `Make ${monLabel(s.party[other])} my starter`));
    };
    refreshers.push(drawStatus);
    paint();
    drawStatus();

    return h('section', { class: 'card pikachu-card' },
      h('div', { class: 'card-title' }, pokemonIcon(25, 'card-icon'), h('h3', {}, 'Pikachu')),
      h('div', { class: 'lcd friend' }, h('span', { class: 'friend-head' }, 'Friendship'), value, label),
      h('div', { class: 'friend-controls' }, slider, number),
      h('div', { class: 'button-row' },
        h('button', { onclick: () => set(255) }, 'Max friendship')),
      h('p', { class: 'muted' }, 'The Museum of Science hiker wants 101 or more, and Melanie in Cerulean City only gives her Bulbasaur at 147 or more.'),
      status);
  }

  /** The three settings from the in-game OPTION menu. */
  function optionsCard(): Node {
    const speeds = TEXT_SPEEDS.map((t) => ({ value: t.value, label: t.label }));
    // A value the menu can't produce (rare) stays selectable so it isn't silently changed.
    if (!speeds.some((t) => t.value === s.options.textSpeed)) speeds.push({ value: s.options.textSpeed, label: `Custom (${s.options.textSpeed})` });
    return h('section', { class: 'card' },
      h('h3', {}, 'Game options'),
      h('div', { class: 'grid' },
        field('Text speed', selectInput(speeds, s.options.textSpeed, (v) => { s.options.textSpeed = Number(v); edited(); })),
        field('Battle animations', selectInput([{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }],
          s.options.battleAnimationsOff ? 'off' : 'on', (v) => { s.options.battleAnimationsOff = v === 'off'; edited(); })),
        field('Battle style', selectInput([{ value: 'shift', label: 'Shift' }, { value: 'set', label: 'Set' }],
          s.options.battleStyleSet ? 'set' : 'shift', (v) => { s.options.battleStyleSet = v === 'set'; edited(); }),
        'Shift asks if you want to switch after you knock one out. Set doesn’t.'),
      ));
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

  function monCard(mon: Gen1Mon, onOpen: () => void, extra: Node[] = [], before: Node[] = []): HTMLElement {
    const name = speciesName(mon.species);
    const dex = INTERNAL_TO_DEX[mon.species];
    const showNick = mon.nickname && mon.nickname.toLowerCase() !== name.toLowerCase();
    return h('div', { class: 'mon' },
      ...before,
      h('button', { class: 'mon-main', onclick: onOpen },
        pokemonIcon(dex),
        h('span', { class: 'mon-title' },
          dex ? h('span', { class: 'mon-dex' }, `#${String(dex).padStart(3, '0')}`) : null,
          h('span', { class: 'mon-name' }, showNick ? `${mon.nickname} ` : name),
          showNick ? h('span', { class: 'muted' }, `(${name})`) : null),
        h('span', { class: 'mon-meta' },
          h('span', { class: 'lcd lv' }, `Lv ${mon.level}`),
          typeChips(baseStatsFor(mon.species), false),
          s.isYellow && s.isStarterPikachu(mon) ? h('span', { class: 'tag starter', title: 'Your starter Pikachu' }, 'Starter') : null),
      ),
      ...extra,
    );
  }

  /** Open the editor for a Pokémon, then redraw whatever list it is in. */
  function editMon(where: number, index: number, redraw: () => void): void {
    const mon = listAt(s, where)[index];
    if (mon) openMonEditor({ mon, party: where === PARTY, onDone: () => { markDirty(); redraw(); } });
  }

  function menuFor(where: number, index: number, redraw: () => void): void {
    openMonMenu({
      save: s, where, index,
      onEdit: () => editMon(where, index, redraw),
      onChange: () => { markDirty(); redraw(); },
    });
  }

  /** A brand-new Pokémon with the trainer as its original owner (Pikachu is just a starting point). */
  function freshMon(party: boolean): Gen1Mon {
    const mon = newMon(DEX_TO_INTERNAL[25], 5);
    mon.otName = s.trainerName;
    mon.otId = s.trainerId;
    if (party) recalcPartyStats(mon, true);
    return mon;
  }

  function partyTab(): Node {
    const wrap = h('div', { class: 'mon-list' });
    const draw = (focus?: { index: number; delta: -1 | 1 }) => {
      clear(wrap);
      s.party.forEach((mon, i) => {
        const nudge = (delta: -1 | 1) => () => { if (shiftMon(s, PARTY, i, delta)) { markDirty(); draw({ index: i + delta, delta }); } };
        wrap.append(monCard(mon, () => editMon(PARTY, i, draw), [
          h('button', { class: 'icon', 'aria-label': `Actions for ${monLabel(mon)}`, onclick: () => menuFor(PARTY, i, draw) }, '⋯'),
        ], [
          h('div', { class: 'reorder', role: 'group', 'aria-label': `Move ${monLabel(mon)}` },
            h('button', { class: 'icon', 'aria-label': `Move ${monLabel(mon)} up`, disabled: i === 0, dataset: { reorder: `${i}:-1` }, onclick: nudge(-1) }, '↑'),
            h('button', { class: 'icon', 'aria-label': `Move ${monLabel(mon)} down`, disabled: i === s.party.length - 1, dataset: { reorder: `${i}:1` }, onclick: nudge(1) }, '↓')),
        ]));
      });
      // Keep keyboard focus on the arrow that was just used, so it can be pressed again.
      if (focus) {
        const same = wrap.querySelector<HTMLButtonElement>(`[data-reorder="${focus.index}:${focus.delta}"]:not(:disabled)`);
        (same ?? wrap.querySelector<HTMLButtonElement>(`[data-reorder="${focus.index}:${-focus.delta}"]:not(:disabled)`))?.focus();
      }
      if (!s.party.length) wrap.append(h('p', { class: 'muted' }, 'No Pokémon here yet.'));
      wrap.append(h('button', {
        disabled: s.party.length >= PARTY_MAX,
        onclick: () => {
          s.party.push(freshMon(true));
          markDirty();
          editMon(PARTY, s.party.length - 1, draw);
          draw();
        },
      }, `+ Add Pokémon (${s.party.length}/${PARTY_MAX})`));
    };
    draw();
    return h('div', {},
      h('p', { class: 'muted' }, 'Party Pokémon store their battle stats directly; use “Recalc stats & heal” in the editor after changing level, DVs or EVs. Tap ⋯ to move, copy or remove one.'),
      wrap);
  }

  function boxesTab(): Node {
    const holder = h('div', { class: 'boxes' });
    const draw = () => {
      clear(holder);
      const list = listAt(s, boxView);
      const picker = selectInput(
        Array.from({ length: BOX_TOTAL }, (_, i) => ({
          value: i,
          label: `Box ${i + 1}${i === s.currentBoxIndex ? ' (current)' : ''} · ${listAt(s, i).length}/${BOX_MAX}`,
        })), boxView, (v) => { boxView = Number(v); draw(); });
      picker.setAttribute('aria-label', 'Choose a box');
      const step = (d: number) => { boxView = (boxView + d + BOX_TOTAL) % BOX_TOTAL; draw(); };

      const cells = Array.from({ length: BOX_MAX }, (_, i) => {
        const mon = list[i];
        if (mon) {
          const label = monLabel(mon);
          return h('button', {
            class: 'box-cell', 'aria-label': `${label}, level ${mon.level}, slot ${i + 1}. Actions`,
            onclick: () => menuFor(boxView, i, draw),
          }, pokemonIcon(INTERNAL_TO_DEX[mon.species]),
          h('span', { class: 'lv-tag' }, `Lv ${mon.level}`));
        }
        // Only the first empty slot can take a new Pokémon: boxes are packed, the game has no gaps.
        if (i === list.length) {
          return h('button', {
            class: 'box-cell add', 'aria-label': `Add a Pokémon to Box ${boxView + 1}`,
            onclick: () => { list.push(freshMon(false)); markDirty(); editMon(boxView, list.length - 1, draw); draw(); },
          }, h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'));
        }
        return h('span', { class: 'box-cell empty', 'aria-hidden': 'true' });
      });

      holder.append(
        h('div', { class: 'box-nav' },
          h('button', { class: 'icon', 'aria-label': 'Previous box', onclick: () => step(-1) }, '‹'),
          picker,
          h('button', { class: 'icon', 'aria-label': 'Next box', onclick: () => step(1) }, '›')),
        h('div', { class: 'box-grid', role: 'group', 'aria-label': `Box ${boxView + 1}, ${list.length} of ${BOX_MAX}` }, cells),
        h('p', { class: 'muted box-hint' }, 'Tap a Pokémon to edit it, move it to the party or another box, or copy it.'),
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
