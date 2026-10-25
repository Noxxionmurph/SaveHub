// Gen 1 (Red / Blue / Yellow) editor UI. Loaded lazily by the shell via the game module.

import {
  BADGE_NAMES, DEX_NAMES, DEX_TO_INTERNAL, INTERNAL_TO_DEX, ITEM_CHOICES, TEXT_SPEEDS, baseStatsFor, itemName, speciesName,
} from '../../../core/gen1/data.ts';
import { BOX_MAX, BOX_TOTAL, PARTY, PARTY_MAX, REFUSAL_TEXT, dropMon, listAt, placeName, shiftMon } from '../../../core/gen1/roster.ts';
import { newMon, recalcPartyStats, type BagItem, type Gen1Mon, type Gen1Save } from '../../../core/gen1/save.ts';
import type { EditorHost, MountEditor } from '../../../core/types.ts';
import { clear, field, h, lazySelect, numberInput, selectInput, toast } from '../../dom.ts';
import { enableDrag } from '../../drag.ts';
import { badgeIcon, itemIcon, itemIconUrl, pokemonIcon, setIconSrc } from '../../sprites.ts';
import { itemSpritePath } from './itemSprites.ts';
import { choiceRow } from './gameChoice.ts';
import { monHpBar } from './hpBar.ts';
import { openMonEditor } from './monEditor.ts';
import { openMonMenu } from './monMenu.ts';
import { nameField } from './nameField.ts';
import { pikachuCard } from './pikachuCard.ts';
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
/** One shared array, so the item picker's markup is built once and cloned for every bag row. */
const ITEM_OPTIONS = ITEM_CHOICES.map((c) => ({ value: c.id, label: c.name }));

/** A short line at the top of a tab that says what it is for. */
const intro = (...children: (Node | string)[]) => h('p', { class: 'tab-intro' }, ...children);

export const mountGen1Editor: MountEditor<Gen1Save> = (container, s, host) => {
  let tab: Tab = 'trainer';
  let boxView = s.currentBoxIndex;
  /** The trainer card types itself in the first time it is drawn after a file opens, and not on every return to the tab. */
  let cardIntroPlayed = false;
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
    // Built once. Typing in a field only rewrites these text nodes and badge classes; the party icons are
    // redrawn only when the party itself changes, so no image is recreated per keystroke.
    const stat = (label: string) => { const dd = h('dd'); return { node: h('div', {}, h('dt', {}, label), dd), dd }; };
    const name = h('span', { class: 'tcard-name' });
    const id = h('span', { class: 'tcard-id' });
    const money = stat('Money');
    const coins = stat('Coins');
    const time = stat('Time');
    const badges = stat('Badges');
    const badgeRow = h('div', { class: 'tcard-badges', role: 'img' }, BADGES.map((_, i) => h('span', { class: 'badge-slot' }, badgeIcon(i + 1))));
    const strip = h('div', { class: 'party-strip', role: 'group', 'aria-label': 'Party' });

    const paintCard = () => {
      name.textContent = s.trainerName || '—';
      id.textContent = `ID ${String(s.trainerId).padStart(5, '0')}`;
      money.dd.textContent = `¥${s.money.toLocaleString('en-US')}`;
      coins.dd.textContent = s.coins.toLocaleString('en-US');
      time.dd.textContent = `${s.playHours}:${String(s.playMinutes).padStart(2, '0')}`;
      badges.dd.textContent = `${popcount(s.badges)}/8`;
      badgeRow.setAttribute('aria-label', `${popcount(s.badges)} of 8 badges earned`);
      Array.from(badgeRow.children).forEach((slot, i) => slot.classList.toggle('earned', Boolean((s.badges >> i) & 1)));
    };
    const paintParty = () => {
      clear(strip);
      strip.append(...Array.from({ length: 6 }, (_, i) => {
        const mon = s.party[i];
        if (!mon) return h('span', { class: 'party-slot empty', 'aria-hidden': 'true' });
        return h('button', {
          class: 'party-slot', 'aria-label': `${monLabel(mon)}, level ${mon.level}. Edit`,
          onclick: () => openMonEditor({ mon, party: true, onDone: (changed) => { if (changed) edited(); paintParty(); } }),
        }, pokemonIcon(INTERNAL_TO_DEX[mon.species]),
        h('span', { class: 'slot-name' }, monLabel(mon)),
        h('span', { class: 'lv-tag' }, `Lv ${mon.level}`),
        monHpBar(mon, true, 'small'));
      }));
    };
    refreshers.push(paintCard);
    paintCard();
    paintParty();
    const card = h('section', { class: 'card overview' },
      h('div', { class: `lcd tcard${cardIntroPlayed ? '' : ' boot'}` },
        h('div', { class: 'tcard-top' }, name, id),
        h('dl', { class: 'tcard-stats' }, money.node, coins.node, time.node, badges.node),
        badgeRow),
      strip);
    cardIntroPlayed = true;
    return card;
  }

  function trainerTab(): Node {
    // On a phone the eight badges share one row and their names are not drawn (there is no room), so this line
    // names the ones you have, and the name stays on each button for screen readers and as a tooltip.
    const caption = h('p', { class: 'muted badge-caption', 'aria-live': 'polite' });
    const paintCaption = () => {
      const earned = BADGES.filter((_, i) => (s.badges >> i) & 1);
      caption.textContent = earned.length === 0 ? 'No badges earned yet.'
        : earned.length === BADGES.length ? 'All eight badges earned.' : `Earned: ${earned.join(', ')}.`;
    };
    paintCaption();
    const badgeRow = h('div', { class: 'badge-grid' }, BADGES.map((name, i) => {
      const btn = h('button', { class: 'badge-btn', title: name, 'aria-pressed': String(Boolean((s.badges >> i) & 1)) },
        h('span', { class: 'gem', 'aria-hidden': 'true' }, badgeIcon(i + 1)), h('span', { class: 'badge-name' }, name));
      btn.addEventListener('click', () => {
        s.badges ^= 1 << i;
        btn.setAttribute('aria-pressed', String(Boolean((s.badges >> i) & 1)));
        paintCaption();
        edited();
      });
      return btn;
    }));
    return h('div', { class: 'stack' },
      intro('Your trainer card, money, badges and game settings. Edit any field. Nothing is written to a file until you tap Save.'),
      overview(),
      // The fields follow the trainer card above: name, ID, money, coins, time, badges.
      h('section', { class: 'card' },
        h('h3', {}, 'Trainer'),
        h('p', { class: 'muted card-note' }, 'The game shows up to 7 characters of a name. Type {PK} or {MN} for the PK and MN symbols.'),
        h('div', { class: 'grid pair' },
          nameField('Trainer name', s.trainerName, (v) => { s.trainerName = v; edited(); }),
          nameField('Rival name', s.rivalName, (v) => { s.rivalName = v; markDirty(); }),
        ),
        h('div', { class: 'grid one' },
          field('Trainer ID', numberInput(s.trainerId, 0, 65535, (v) => { s.trainerId = v; edited(); }),
            'Pokémon you caught remember this number. If you change it, they count as traded: they earn extra experience, but may ignore your orders at higher levels.'),
        ),
        h('div', { class: 'grid pair' },
          field('Money (¥)', numberInput(s.money, 0, 999999, (v) => { s.money = v; edited(); }), 'Up to ¥999,999.'),
          field('Game Corner coins', numberInput(s.coins, 0, 9999, (v) => { s.coins = v; edited(); }), 'Up to 9,999.'),
        ),
        h('div', { class: 'button-row' },
          h('button', { onclick: () => { s.money = 999999; s.coins = 9999; markDirty(); render(); } }, 'Max money & coins'),
        ),
        h('div', { class: 'subgroup' },
          h('h4', {}, 'Play time'),
          h('div', { class: 'grid trio' },
            field('Hours', numberInput(s.playHours, 0, 255, (v) => { s.playHours = v; edited(); })),
            field('Minutes', numberInput(s.playMinutes, 0, 59, (v) => { s.playMinutes = v; edited(); })),
            field('Seconds', numberInput(s.playSeconds, 0, 59, (v) => { s.playSeconds = v; markDirty(); })),
          ))),
      h('section', { class: 'card' },
        h('h3', {}, 'Badges'),
        h('p', { class: 'muted card-note' }, 'Tap a badge to earn it or take it away.'),
        badgeRow,
        caption,
        h('div', { class: 'button-row' },
          h('button', { onclick: () => { s.badges = 0xff; markDirty(); render(); } }, 'All badges'),
          h('button', { onclick: () => { s.badges = 0; markDirty(); render(); } }, 'Clear badges'),
        )),
      optionsCard(),
    );
  }


  /** Pokémon Yellow only, under the party list: the starter Pikachu's friendship and mood (see pikachuCard.ts). */
  function pikachuSection(onRefresh: (fn: () => void) => void): Node | null {
    if (!s.isYellow) return null;
    return pikachuCard(s, { markDirty, onRefresh, monLabel });
  }

  /** The three settings from the in-game OPTION menu. */
  function optionsCard(): Node {
    const speeds = TEXT_SPEEDS.map((t) => ({ value: t.value, label: t.label }));
    // A value the menu can't produce (rare) stays selectable so it isn't silently changed.
    if (!speeds.some((t) => t.value === s.options.textSpeed)) speeds.push({ value: s.options.textSpeed, label: `Custom (${s.options.textSpeed})` });
    return h('section', { class: 'card' },
      h('h3', {}, 'Game options'),
      h('p', { class: 'muted card-note' }, 'The same settings as OPTION in the game’s start menu. Text speed is how fast text appears.'),
      h('div', { class: 'lcd options-window' },
        choiceRow('Text speed', speeds.map((t) => ({ value: String(t.value), label: t.label })), String(s.options.textSpeed),
          (v) => { s.options.textSpeed = Number(v); edited(); }),
        choiceRow('Battle animations', [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }],
          s.options.battleAnimationsOff ? 'off' : 'on', (v) => { s.options.battleAnimationsOff = v === 'off'; edited(); }),
        choiceRow('Battle style', [{ value: 'shift', label: 'Shift' }, { value: 'set', label: 'Set' }],
          s.options.battleStyleSet ? 'set' : 'shift', (v) => { s.options.battleStyleSet = v === 'set'; edited(); }),
      ),
      h('p', { class: 'muted section-note' },
        'Animations Off skips the move animations in battle. Shift asks if you want to switch Pokémon after you knock one out; Set doesn’t ask.'));
  }

  // ---------- bag ----------

  function itemList(title: string, note: string, items: BagItem[], max: number): Node {
    const wrap = h('section', { class: 'card' });
    const draw = () => {
      clear(wrap);
      wrap.append(
        h('h3', {}, title, h('span', { class: 'muted count' }, `${items.length}/${max}`)),
        note ? h('p', { class: 'muted card-note' }, note) : null,
        ...items.map((it, i) => {
          const icon = itemIcon(itemSpritePath(it.id));
          return h('div', { class: 'item-row' },
            icon,
            lazySelect(
              ITEM_CHOICES.some((c) => c.id === it.id) ? ITEM_OPTIONS : [{ value: it.id, label: itemName(it.id) }, ...ITEM_OPTIONS],
              it.id, (v) => { it.id = Number(v); setIconSrc(icon, itemIconUrl(itemSpritePath(it.id))); markDirty(); }),
            numberInput(it.count, 1, 99, (v) => { it.count = v; markDirty(); }, { 'aria-label': 'Quantity' }),
            h('button', { class: 'icon', 'aria-label': 'Remove', onclick: () => { items.splice(i, 1); markDirty(); draw(); } }, '✕'),
          );
        }),
        h('button', {
          disabled: items.length >= max,
          onclick: () => { items.push({ id: 0x28, count: 99 }); markDirty(); draw(); },
        }, items.length >= max ? `Full (${max} of ${max})` : '+ Add item'),
      );
    };
    draw();
    return wrap;
  }

  const bagTab = () => h('div', {},
    intro('Pick an item, set how many (1 to 99), or tap ✕ to remove it. Only items the game can really hold are listed.'),
    h('div', { class: 'two-col' },
      itemList('Bag', 'What you carry. It holds up to 20 different items.', s.bag, 20),
      itemList('PC item storage', 'Items stored in your PC. It holds up to 50 different items.', s.pcItems, 50)));

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
        monHpBar(mon, true, 'in-card'),
      ),
      ...extra,
    );
  }

  /** Open the editor for a Pokémon, then redraw whatever list it is in. */
  function editMon(where: number, index: number, redraw: () => void): void {
    const mon = listAt(s, where)[index];
    if (mon) openMonEditor({ mon, party: where === PARTY, onDone: (changed) => { if (changed) markDirty(); redraw(); } });
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
    /** Things below the list (the Pikachu card's starter status) that depend on who is in the party. */
    const afterDraw: (() => void)[] = [];
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
      if (!s.party.length) wrap.append(h('p', { class: 'muted' }, 'Your party is empty. The game needs at least one Pokémon, so add one.'));
      wrap.append(h('button', {
        disabled: s.party.length >= PARTY_MAX,
        onclick: () => {
          s.party.push(freshMon(true));
          markDirty();
          editMon(PARTY, s.party.length - 1, draw);
          draw();
        },
      }, s.party.length >= PARTY_MAX ? `Party full (${PARTY_MAX} of ${PARTY_MAX})` : `+ Add Pokémon (${s.party.length}/${PARTY_MAX})`));
      afterDraw.forEach((f) => f());
    };
    draw();
    return h('div', { class: 'stack' },
      intro('Up to 6 Pokémon. The first one battles first, so use the arrows to change the order. Tap a Pokémon to edit it, or ⋯ to move, duplicate or remove it.'),
      wrap,
      pikachuSection((fn) => afterDraw.push(fn)));
  }

  function boxesTab(): Node {
    const holder = h('div', { class: 'boxes' });
    /** The part that is rebuilt on every change; the intro and tips above it stay put, so an opened tip stays open. */
    const body = h('div');
    const step = (d: number) => { boxView = (boxView + d + BOX_TOTAL) % BOX_TOTAL; draw(); };
    const slotKey = (where: number, index: number) => `${where}:${index}`;
    const parseKey = (key: string) => { const [where, index] = key.split(':').map(Number); return { where, index }; };

    // Drag one Pokémon onto another to swap them, or onto an empty spot to move it to the end. The listeners sit
    // on `holder`, which survives redraws, so the grid can be rebuilt while a drag is in progress.
    const drag = enableDrag({
      root: holder,
      pick: '[data-pick]',
      drop: '[data-slot], [data-nav]',
      onNav: step,
      onDrop: (fromKey, toKey) => {
        const from = parseKey(fromKey);
        const to = parseKey(toKey);
        const a = listAt(s, from.where)[from.index];
        const b = listAt(s, to.where)[to.index];
        const r = dropMon(s, from, to);
        if (typeof r === 'string') { toast(REFUSAL_TEXT[r]); return; }
        markDirty();
        draw();
        const A = a ? monLabel(a) : 'Pokémon';
        toast(r.kind === 'swap' && b ? `Swapped ${A} and ${monLabel(b)}.` : `Moved ${A} to ${placeName(to.where)}.`);
      },
    });

    /** One spot in the party row or the box grid. */
    const cellFor = (where: number, i: number): HTMLElement => {
      const list = listAt(s, where);
      const mon = list[i];
      const key = slotKey(where, i);
      if (mon) {
        return h('button', {
          class: drag.lifted() === key ? 'box-cell lifted' : 'box-cell',
          'aria-label': `${monLabel(mon)}, level ${mon.level}, ${placeName(where)}${where === PARTY ? ' ' : ', slot '}${i + 1}. Actions`,
          dataset: { slot: key, pick: '' },
          onclick: () => menuFor(where, i, draw),
        }, pokemonIcon(INTERNAL_TO_DEX[mon.species]),
        h('span', { class: 'lv-tag' }, `Lv ${mon.level}`),
        monHpBar(mon, where === PARTY, 'small'));
      }
      // Only the first empty slot of a box gets a + button: boxes are packed, the game has no gaps. The other
      // empty spots still accept a drop, which puts the Pokémon at the end.
      if (where !== PARTY && i === list.length) {
        return h('button', {
          class: 'box-cell add', 'aria-label': `Add a Pokémon to Box ${where + 1}`, dataset: { slot: key },
          onclick: () => { list.push(freshMon(false)); markDirty(); editMon(where, list.length - 1, draw); draw(); },
        }, h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'));
      }
      return h('span', { class: 'box-cell empty', 'aria-hidden': 'true', dataset: { slot: key } });
    };

    const draw = () => {
      clear(body);
      const list = listAt(s, boxView);
      const picker = selectInput(
        Array.from({ length: BOX_TOTAL }, (_, i) => ({
          value: i,
          label: `Box ${i + 1}${i === s.currentBoxIndex ? ' (current)' : ''} · ${listAt(s, i).length}/${BOX_MAX}`,
        })), boxView, (v) => { boxView = Number(v); draw(); });
      picker.setAttribute('aria-label', 'Choose a box');

      body.append(
        h('div', { class: 'box-party', role: 'group', 'aria-label': `Party, ${s.party.length} of ${PARTY_MAX}` },
          h('span', { class: 'box-label' }, `Party ${s.party.length}/${PARTY_MAX}`),
          h('div', { class: 'party-cells' }, Array.from({ length: PARTY_MAX }, (_, i) => cellFor(PARTY, i)))),
        h('div', { class: 'box-nav' },
          h('button', { class: 'icon', 'aria-label': 'Previous box', dataset: { nav: '-1' }, onclick: () => step(-1) }, '‹'),
          picker,
          h('button', { class: 'icon', 'aria-label': 'Next box', dataset: { nav: '1' }, onclick: () => step(1) }, '›')),
        h('div', { class: 'box-grid', role: 'group', 'aria-label': `Box ${boxView + 1}, ${list.length} of ${BOX_MAX}` },
          Array.from({ length: BOX_MAX }, (_, i) => cellFor(boxView, i))),
      );
    };
    holder.append(
      intro('Your party and PC boxes. Tap a Pokémon to edit, move, duplicate or remove it, or drag one onto another to swap them.'),
      h('details', { class: 'tips' },
        h('summary', {}, 'How dragging works'),
        h('ul', {},
          h('li', {}, 'Drop a Pokémon on another one to swap them, in a box or with your party.'),
          h('li', {}, 'Drop it on an empty spot to move it to the end of that box or your party.'),
          h('li', {}, 'On a touch screen, press and hold for a moment before dragging. A quick swipe still scrolls the page.'),
          h('li', {}, 'While dragging, hold over ‹ or › to turn to another box.'),
          h('li', {}, 'Your party always keeps at least one Pokémon. “(current)” marks the box where new catches go.'))),
      body);
    draw();
    return holder;
  }

  // ---------- Pokédex ----------

  function dexTab(): Node {
    type DexState = 'unseen' | 'seen' | 'owned';
    const stateOf = (n: number): DexState => (s.isOwned(n) ? 'owned' : s.isSeen(n) ? 'seen' : 'unseen');
    // The game's own SEEN / OWN window.
    const seenEl = h('dd'), ownEl = h('dd');
    const summary = h('div', { class: 'lcd dex-summary', role: 'group' },
      h('dl', {}, h('div', {}, h('dt', {}, 'Seen'), seenEl), h('div', {}, h('dt', {}, 'Own'), ownEl)));
    const paintSummary = () => {
      const owned = DEX_NAMES.filter((_, i) => s.isOwned(i + 1)).length;
      const seen = DEX_NAMES.filter((_, i) => s.isSeen(i + 1)).length;
      seenEl.textContent = `${seen}/151`;
      ownEl.textContent = `${owned}/151`;
      summary.setAttribute('aria-label', `Seen ${seen} of 151, owned ${owned} of 151`);
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
      intro('Tap a Pokémon to cycle it: not seen, then seen, then owned. A dark shape is not seen, colour is seen, and a highlighted tile with a Poké Ball is owned.'),
      summary,
      h('div', { class: 'button-row' },
        h('button', { onclick: () => { DEX_NAMES.forEach((_, i) => s.setOwned(i + 1, true)); markDirty(); repaint(); } }, 'Own all 151'),
        h('button', { onclick: () => { DEX_NAMES.forEach((_, i) => s.setSeen(i + 1, true)); markDirty(); repaint(); } }, 'Mark all seen'),
        h('button', { onclick: () => { DEX_NAMES.forEach((_, i) => s.setSeen(i + 1, false)); markDirty(); repaint(); } }, 'Clear all'),
      ),
      h('div', { class: 'dex-grid' }, tiles.map((t) => t.tile)),
    );
  }

  render();
};

export type { EditorHost };
