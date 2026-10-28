// Gen 3 (Ruby / Sapphire / Emerald) editor UI. Loaded lazily by the shell via the game modules. Laid out like the
// Gen 2 editor, with what Gen 3 has: the secret ID, the Hoenn badges, the National Pokédex, five bag pockets with
// quantities (Berries among them), boxes of 30 spots that can have gaps, and the 386-Pokémon Pokédex.

import {
  BUTTON_MODES, DEX_COUNT, DEX_NAMES, FRAME_COUNT, HM_COUNT, HOENN_BADGES, TEXT_SPEEDS, TMHM_LABELS, TMHM_MOVES, TM_COUNT,
  baseStatsFor, findPid, genderOf, itemChoices, itemName, moveInfo, speciesName, type Pocket,
} from '../../../core/gen3/data.ts';
import { BOX_SLOTS, BOX_TOTAL, PARTY, PARTY_MAX, REFUSAL_TEXT, countAt, dropMon, monAt, placeName, shiftMon } from '../../../core/gen3/roster.ts';
import {
  BATTLE_POINTS_MAX, BERRY_POWDER_MAX, BOX_NAME_LEN, COINS_MAX, FRONTIER_FACILITIES, MONEY_MAX, PLAYER_NAME_MAX, depositInBox,
  newMon, pocketSizes, type BagItem, type Gen3Mon, type Gen3Save,
} from '../../../core/gen3/save.ts';
import type { MountEditor } from '../../../core/types.ts';
import { clear, field, h, lazySelect, numberInput, selectInput, toast } from '../../dom.ts';
import { enableDrag } from '../../drag.ts';
import { dexTab as sharedDexTab } from '../../dexTab.ts';
import { choiceRow, stepRow } from '../../gameChoice.ts';
import { badgeIcon, itemIcon, itemIconUrl, setIconSrc } from '../../sprites.ts';
import { typeChips } from '../../typeChip.ts';
import { monHpBar } from './hpBar.ts';
import { discPath, itemSpritePath } from './itemSprites.ts';
import { genderMark, monLabel, monPic, shinyMark } from './monBits.ts';
import { openMonEditor } from './monEditor.ts';
import { openMonMenu } from './monMenu.ts';
import { nameField } from './nameField.ts';

type Tab = 'trainer' | 'bag' | 'party' | 'boxes' | 'dex';
const TABS: { id: Tab; label: string }[] = [
  { id: 'trainer', label: 'Trainer' },
  { id: 'bag', label: 'Bag' },
  { id: 'party', label: 'Party' },
  { id: 'boxes', label: 'Boxes' },
  { id: 'dex', label: 'Pokédex' },
];

type Options = { value: number; label: string }[];
const RARE_CANDY = 68;
const ULTRA_BALL = 2;
const MACH_BIKE = 259;
const ORAN_BERRY = 139;
/** Wurmple, a Hoenn starting point for a new Pokémon. */
const NEW_MON_SPECIES = 265;

const popcount = (n: number) => { let c = 0; for (let v = n & 0xff; v; v &= v - 1) c++; return c; };

export const mountGen3Editor: MountEditor<Gen3Save> = (container, s, host) => {
  let tab: Tab = 'trainer';
  let boxView = s.currentBoxIndex;
  let cardIntroPlayed = false;
  let tmHideHeld = false;
  const of = (...pockets: Pocket[]): Options => itemChoices(pockets, s.game).map((c) => ({ value: c.id, label: c.name }));
  const OPTIONS = { item: of('item'), ball: of('ball'), key: of('key'), berry: of('berry'), pc: of('item', 'ball', 'key', 'berry', 'tmhm') };
  const SIZES = pocketSizes(s.game);
  const markDirty = () => host.markDirty();
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
      case 'dex': return sharedDexTab(s, DEX_NAMES, markDirty);
    }
  }

  // ---------- trainer ----------

  function overview(): HTMLElement {
    const stat = (label: string) => { const dd = h('dd'); return { node: h('div', {}, h('dt', {}, label), dd), dd }; };
    const name = h('span', { class: 'tcard-name' });
    const id = h('span', { class: 'tcard-id' });
    const money = stat('Money');
    const dex = stat('Pokédex');
    const time = stat('Time');
    const badges = stat('Badges');
    const row = h('div', { class: 'tcard-badges', role: 'img' },
      Array.from({ length: 8 }, (_, i) => h('span', { class: 'badge-slot' }, badgeIcon(i + 1, '', 'hoenn'))));
    const strip = h('div', { class: 'party-strip', role: 'group', 'aria-label': 'Party' });

    const paintCard = () => {
      name.textContent = s.trainerName || '—';
      id.textContent = `ID ${String(s.trainerId).padStart(5, '0')}`;
      money.dd.textContent = `¥${s.money.toLocaleString('en-US')}`;
      let owned = 0;
      for (let n = 1; n <= DEX_COUNT; n++) owned += Number(s.isOwned(n));
      dex.dd.textContent = String(owned);
      time.dd.textContent = `${s.playHours}:${String(s.playMinutes).padStart(2, '0')}`;
      badges.dd.textContent = `${popcount(s.badges)}/8`;
      row.setAttribute('aria-label', `${popcount(s.badges)} of 8 badges earned`);
      Array.from(row.children).forEach((slot, i) => slot.classList.toggle('earned', Boolean((s.badges >> i) & 1)));
    };
    const paintParty = () => {
      clear(strip);
      strip.append(...Array.from({ length: 6 }, (_, i) => {
        const mon = s.party[i];
        if (!mon) return h('span', { class: 'party-slot empty', 'aria-hidden': 'true' });
        return h('button', {
          class: 'party-slot', 'aria-label': `${monLabel(mon)}${mon.isEgg ? '' : `, level ${mon.level}`}${shinyMark(mon) ? ', shiny' : ''}${mon.item ? `, holding ${itemName(mon.item)}` : ''}. Edit`,
          onclick: () => editMon(PARTY, i, paintParty, undefined, true),
        }, monPic(mon, itemName),
        h('span', { class: 'slot-name' }, monLabel(mon)),
        shinyMark(mon),
        mon.isEgg || mon.bad ? null : h('span', { class: 'lv-tag' }, `Lv ${mon.level}`),
        monHpBar(mon, true, 'small'));
      }));
    };
    refreshers.push(paintCard);
    paintCard();
    paintParty();
    const card = h('section', { class: 'card overview' },
      h('div', { class: `lcd tcard${cardIntroPlayed ? '' : ' boot'}` },
        h('div', { class: 'tcard-top' }, name, id),
        h('dl', { class: 'tcard-stats' }, money.node, dex.node, time.node, badges.node),
        row),
      strip);
    cardIntroPlayed = true;
    return card;
  }

  function badgeCard(): Node {
    const caption = h('p', { class: 'muted badge-caption', 'aria-live': 'polite' });
    const paintCaption = () => {
      const earned = HOENN_BADGES.filter((_, i) => (s.badges >> i) & 1);
      caption.textContent = earned.length === 0 ? 'No badges earned yet.'
        : earned.length === 8 ? 'All eight badges earned.' : `Earned: ${earned.join(', ')}.`;
    };
    paintCaption();
    const buttons = HOENN_BADGES.map((name, i) => {
      const btn = h('button', { class: 'badge-btn', title: `${name} Badge`, 'aria-pressed': String(Boolean((s.badges >> i) & 1)) },
        h('span', { class: 'gem', 'aria-hidden': 'true' }, badgeIcon(i + 1, '', 'hoenn')), h('span', { class: 'badge-name' }, name));
      btn.addEventListener('click', () => {
        s.badges ^= 1 << i;
        btn.setAttribute('aria-pressed', String(Boolean((s.badges >> i) & 1)));
        paintCaption();
        edited();
      });
      return btn;
    });
    const setAll = (v: number) => {
      s.badges = v;
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(Boolean((v >> i) & 1))));
      paintCaption();
      edited();
    };
    return h('section', { class: 'card' },
      h('h3', {}, 'Badges'),
      h('div', { class: 'badge-grid' }, buttons),
      caption,
      h('div', { class: 'button-row' },
        h('button', { onclick: () => setAll(0xff) }, 'All badges'),
        h('button', { onclick: () => setAll(0) }, 'Clear badges')));
  }

  function trainerTab(): Node {
    return h('div', { class: 'stack' },
      overview(),
      h('section', { class: 'card' },
        h('h3', {}, 'Trainer'),
        h('div', { class: 'grid pair' },
          nameField('Trainer name', s.trainerName, (v) => { s.trainerName = v; edited(); }, undefined, PLAYER_NAME_MAX, true),
        ),
        h('div', { class: 'lcd options-window player-gender' },
          choiceRow('Player', [{ value: 'male', label: 'Boy' }, { value: 'female', label: 'Girl' }], s.gender,
            (v) => { s.gender = v === 'female' ? 'female' : 'male'; markDirty(); })),
        h('div', { class: 'grid pair' },
          field('Trainer ID', numberInput(s.trainerId, 0, 65535, (v) => { s.trainerId = v; edited(); })),
          field('Secret ID', numberInput(s.secretId, 0, 65535, (v) => { s.secretId = v; markDirty(); })),
        ),
        h('p', { class: 'muted section-note' }, 'Change either and your Pokémon count as traded (and their shininess can change).'),
        h('div', { class: 'grid pair money' },
          field('Money (¥)', numberInput(s.money, 0, MONEY_MAX, (v) => { s.money = v; edited(); })),
          field('Game Corner coins', numberInput(s.coins, 0, COINS_MAX, (v) => { s.coins = v; markDirty(); })),
        ),
        h('div', { class: 'button-row' },
          h('button', { onclick: () => { s.money = MONEY_MAX; s.coins = COINS_MAX; markDirty(); render(); } }, 'Max money & coins'),
        ),
        h('div', { class: 'subgroup' },
          h('h4', {}, 'Play time'),
          h('div', { class: 'grid trio' },
            field('Hours', numberInput(s.playHours, 0, 999, (v) => { s.playHours = v; edited(); })),
            field('Minutes', numberInput(s.playMinutes, 0, 59, (v) => { s.playMinutes = v; edited(); })),
            field('Seconds', numberInput(s.playSeconds, 0, 59, (v) => { s.playSeconds = v; markDirty(); })),
          )),
        h('label', { class: 'check-row' },
          h('input', { type: 'checkbox', checked: s.nationalDex, onchange: (e: Event) => { s.nationalDex = (e.target as HTMLInputElement).checked; markDirty(); } }),
          h('span', {}, 'National Pokédex'),
          h('span', { class: 'muted' }, ' Unlocked after the Hall of Fame.'))),
      badgeCard(),
      frontierCard(),
      optionsCard(),
    );
  }

  /** Emerald's Battle Frontier symbols and Battle Points, and its Berry Powder. */
  function frontierCard(): Node | null {
    const f = s.frontier;
    if (!f) return null;
    const levels = [{ value: '0', label: 'None' }, { value: '1', label: 'Silver' }, { value: '2', label: 'Gold' }];
    return h('section', { class: 'card frontier' },
      h('h3', {}, 'Battle Frontier'),
      h('div', { class: 'grid pair' },
        field('Battle Points', numberInput(f.battlePoints, 0, BATTLE_POINTS_MAX, (v) => { f.battlePoints = v; markDirty(); })),
        field('Berry Powder', numberInput(f.berryPowder, 0, BERRY_POWDER_MAX, (v) => { f.berryPowder = v; markDirty(); })),
      ),
      h('div', { class: 'lcd options-window' },
        FRONTIER_FACILITIES.map((name, i) => choiceRow(name.replace('Battle ', ''), levels, String(f.symbols[i]),
          (v) => { f.symbols[i] = Number(v); markDirty(); }))),
      h('div', { class: 'button-row' },
        h('button', { onclick: () => { f.symbols = f.symbols.map(() => 2); markDirty(); render(); } }, 'All gold symbols')));
  }

  /** The settings from the in-game OPTION menu. */
  function optionsCard(): Node {
    const o = s.options;
    const keep = (list: readonly { value: number; label: string }[], v: number) =>
      (list.some((t) => t.value === v) ? [...list] : [...list, { value: v, label: `Custom (${v})` }]).map((t) => ({ value: String(t.value), label: t.label }));
    return h('section', { class: 'card' },
      h('h3', {}, 'Game options'),
      h('div', { class: 'lcd options-window' },
        choiceRow('Text speed', keep(TEXT_SPEEDS, o.textSpeed), String(o.textSpeed), (v) => { o.textSpeed = Number(v); edited(); }),
        choiceRow('Battle scene', [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }], o.battleSceneOff ? 'off' : 'on',
          (v) => { o.battleSceneOff = v === 'off'; edited(); }),
        choiceRow('Battle style', [{ value: 'shift', label: 'Shift' }, { value: 'set', label: 'Set' }], o.battleStyleSet ? 'set' : 'shift',
          (v) => { o.battleStyleSet = v === 'set'; edited(); }),
        choiceRow('Sound', [{ value: 'mono', label: 'Mono' }, { value: 'stereo', label: 'Stereo' }], o.stereo ? 'stereo' : 'mono',
          (v) => { o.stereo = v === 'stereo'; edited(); }),
        choiceRow('Button mode', keep(BUTTON_MODES, o.buttonMode), String(o.buttonMode), (v) => { o.buttonMode = Number(v); edited(); }),
        stepRow('Frame', Array.from({ length: FRAME_COUNT }, (_, i) => ({ value: String(i), label: `Type ${i + 1}` })), String(o.frame),
          (v) => { o.frame = Number(v); edited(); }),
      ));
  }

  // ---------- bag ----------

  function itemList(title: string, items: BagItem[], size: { slots: number; count: number }, options: Options, fresh: () => number): Node {
    const wrap = h('section', { class: 'card' });
    const draw = () => {
      clear(wrap);
      wrap.append(
        h('h3', {}, title, h('span', { class: 'muted count' }, `${items.length}/${size.slots}`)),
        ...items.map((it, i) => {
          const icon = itemIcon(itemSpritePath(it.id));
          return h('div', { class: 'item-row' },
            icon,
            lazySelect(options.some((c) => c.value === it.id) ? options : [{ value: it.id, label: itemName(it.id) }, ...options],
              it.id, (v) => { it.id = Number(v); setIconSrc(icon, itemIconUrl(itemSpritePath(it.id))); markDirty(); }),
            numberInput(it.count, 1, Math.max(size.count, it.count), (v) => { it.count = v; markDirty(); }, { 'aria-label': 'Quantity' }),
            h('button', { class: 'icon', 'aria-label': 'Remove', onclick: () => { items.splice(i, 1); markDirty(); draw(); } }, '✕'),
          );
        }),
        h('button', {
          disabled: items.length >= size.slots,
          onclick: () => {
            const has = (id: number) => items.some((it) => it.id === id);
            const id = !has(fresh()) ? fresh() : options.find((o) => !has(o.value))?.value ?? fresh();
            items.push({ id, count: 1 });
            markDirty(); draw();
          },
        }, items.length >= size.slots ? `Full (${size.slots} of ${size.slots})` : '+ Add item'),
      );
    };
    draw();
    return wrap;
  }

  /** TM/HM pocket: a count for each of the 58. */
  function tmhmCard(): Node {
    const wrap = h('section', { class: 'card' });
    const counts = s.tmCounts();
    const counter = h('span', { class: 'muted count' });
    const paint = () => { counter.textContent = `${counts.filter((n) => n > 0).length}/${TM_COUNT + HM_COUNT}`; };
    const commit = () => { s.setTmCounts(counts); markDirty(); paint(); };
    const rows = TMHM_MOVES.map((move, i) => {
      const info = moveInfo(move);
      const hm = i >= TM_COUNT;
      const input = numberInput(counts[i], 0, hm ? 1 : 99, (v) => { counts[i] = v; commit(); }, { 'aria-label': `${TMHM_LABELS[i]} count` });
      return h('div', { class: 'tm-row', hidden: tmHideHeld && counts[i] > 0 },
        itemIcon(discPath(i)),
        h('span', { class: 'tm-label' }, h('span', { class: 'tm-no' }, TMHM_LABELS[i]), ' ', info?.name ?? `Move ${move}`),
        input);
    });
    const fill = (tm: number | null, hm: number | null) => {
      s.setTmCounts(counts.map((n, i) => (i < TM_COUNT ? tm ?? n : hm ?? n)));
      markDirty();
      render();
    };
    const hideHeld = h('input', {
      type: 'checkbox', checked: tmHideHeld,
      onchange: () => { tmHideHeld = hideHeld.checked; rows.forEach((r, i) => { r.hidden = tmHideHeld && counts[i] > 0; }); },
    });
    paint();
    wrap.append(
      h('h3', {}, 'TMs & HMs pocket', counter),
      h('div', { class: 'button-row' },
        h('button', { onclick: () => fill(99, 1) }, 'All TMs ×99 and HMs'),
        h('button', { onclick: () => fill(null, 1) }, 'All HMs'),
        h('button', { onclick: () => fill(0, 0) }, 'Clear')),
      h('label', { class: 'check-row tm-only' }, hideHeld, 'Hide the ones I already have'),
      h('div', { class: 'tm-grid' }, rows));
    return wrap;
  }

  const bagTab = () => h('div', { class: 'stack' },
    h('div', { class: 'two-col' },
      itemList('Items pocket', s.pockets.item, SIZES.item, OPTIONS.item, () => RARE_CANDY),
      itemList('Poké Balls pocket', s.pockets.ball, SIZES.ball, OPTIONS.ball, () => ULTRA_BALL),
      itemList('Key Items pocket', s.pockets.key, SIZES.key, OPTIONS.key, () => MACH_BIKE),
      itemList('Berries pocket', s.pockets.berry, SIZES.berry, OPTIONS.berry, () => ORAN_BERRY),
      itemList('PC item storage', s.pcItems, SIZES.pc, OPTIONS.pc, () => RARE_CANDY),
    ),
    tmhmCard());

  // ---------- Pokémon lists ----------

  function monCard(mon: Gen3Mon, onOpen: () => void, extra: Node[] = [], before: Node[] = []): HTMLElement {
    const name = speciesName(mon.species);
    const label = monLabel(mon);
    const plain = mon.isEgg || mon.bad;
    return h('div', { class: 'mon' },
      ...before,
      h('button', { class: 'mon-main', onclick: onOpen },
        monPic(mon, itemName),
        h('span', { class: 'mon-title' },
          plain ? null : h('span', { class: 'mon-dex' }, `#${String(mon.species).padStart(3, '0')}`),
          h('span', { class: 'mon-name' }, label, ' '),
          mon.bad ? null : mon.isEgg || label !== name ? h('span', { class: 'muted' }, `(${name})`) : null,
          plain ? null : genderMark(genderOf(mon.species, mon.pid)),
          shinyMark(mon)),
        h('span', { class: 'mon-meta' },
          h('span', { class: 'lcd lv' }, plain ? 'Egg' : `Lv ${mon.level}`),
          plain ? null : typeChips(baseStatsFor(mon.species))),
        monHpBar(mon, true, 'in-card'),
      ),
      ...extra,
    );
  }

  /** Open the Pokémon window, or say why a Bad Egg can't be opened. */
  function editMon(where: number, index: number, redraw: () => void, onDiscard?: () => void, card = false): void {
    const mon = monAt(s, where, index);
    if (!mon) return;
    if (mon.bad) { toast('This is a Bad Egg: its data is damaged, so it can only be moved or removed.'); return; }
    openMonEditor({
      mon, party: where === PARTY, game: s.game, onDiscard,
      onDone: (changed) => { if (changed) (card ? edited : markDirty)(); redraw(); },
    });
  }

  function menuFor(where: number, index: number, redraw: () => void): void {
    openMonMenu({
      save: s, where, index,
      onEdit: () => editMon(where, index, redraw),
      onChange: () => { markDirty(); redraw(); },
    });
  }

  /** A brand-new Pokémon with the trainer as its original owner. */
  function freshMon(party: boolean): Gen3Mon {
    const otId = ((s.secretId << 16) | s.trainerId) >>> 0;
    const pid = findPid(NEW_MON_SPECIES, otId, Math.floor(Math.random() * 0x100000000), { shiny: false });
    const mon = newMon(NEW_MON_SPECIES, 5, { name: s.trainerName, id: otId, gender: s.gender }, s.game, pid, speciesName(NEW_MON_SPECIES));
    if (!party) depositInBox(mon);
    return mon;
  }

  function partyTab(): Node {
    const wrap = h('div', { class: 'mon-list' });
    const draw = (focus?: { index: number; delta: -1 | 1 }) => {
      clear(wrap);
      s.party.forEach((mon, i) => {
        const nudge = (delta: -1 | 1) => () => { if (shiftMon(s, PARTY, i, delta)) { markDirty(); draw({ index: i + delta, delta }); } };
        const label = monLabel(mon);
        wrap.append(monCard(mon, () => editMon(PARTY, i, draw), [
          h('button', { class: 'icon', 'aria-label': `Actions for ${label}`, onclick: () => menuFor(PARTY, i, draw) }, '⋯'),
        ], [
          h('div', { class: 'reorder', role: 'group', 'aria-label': `Move ${label}` },
            h('button', { class: 'icon', 'aria-label': `Move ${label} up`, disabled: i === 0, dataset: { reorder: `${i}:-1` }, onclick: nudge(-1) }, '↑'),
            h('button', { class: 'icon', 'aria-label': `Move ${label} down`, disabled: i === s.party.length - 1, dataset: { reorder: `${i}:1` }, onclick: nudge(1) }, '↓')),
        ]));
      });
      if (focus) {
        const same = wrap.querySelector<HTMLButtonElement>(`[data-reorder="${focus.index}:${focus.delta}"]:not(:disabled)`);
        (same ?? wrap.querySelector<HTMLButtonElement>(`[data-reorder="${focus.index}:${-focus.delta}"]:not(:disabled)`))?.focus();
      }
      if (!s.party.length) wrap.append(h('p', { class: 'muted' }, 'Your party is empty. The game needs at least one Pokémon, so add one.'));
      wrap.append(h('button', {
        disabled: s.party.length >= PARTY_MAX,
        onclick: () => {
          const mon = freshMon(true);
          s.party.push(mon);
          markDirty();
          editMon(PARTY, s.party.length - 1, draw, () => { const i = s.party.indexOf(mon); if (i >= 0) s.party.splice(i, 1); });
          draw();
        },
      }, s.party.length >= PARTY_MAX ? `Party full (${PARTY_MAX} of ${PARTY_MAX})` : `+ Add Pokémon (${s.party.length}/${PARTY_MAX})`));
    };
    draw();
    return h('div', { class: 'stack' }, wrap);
  }

  function boxesTab(): Node {
    const holder = h('div', { class: 'boxes' });
    const body = h('div');
    const step = (d: number) => { boxView = (boxView + d + BOX_TOTAL) % BOX_TOTAL; draw(); };
    const slotKey = (where: number, index: number) => `${where}:${index}`;
    const parseKey = (key: string) => { const [where, index] = key.split(':').map(Number); return { where, index }; };
    const boxLabel = (i: number) => s.boxNames[i] || `Box ${i + 1}`;
    const optionLabel = (i: number) => `${boxLabel(i)}${i === s.currentBoxIndex ? ' (current)' : ''} · ${countAt(s, i)}/${BOX_SLOTS}`;

    const drag = enableDrag({
      root: holder,
      pick: '[data-pick]',
      drop: '[data-slot], [data-nav]',
      onNav: step,
      onDrop: (fromKey, toKey) => {
        const from = parseKey(fromKey);
        const to = parseKey(toKey);
        const a = monAt(s, from.where, from.index);
        const b = monAt(s, to.where, to.index);
        const r = dropMon(s, from, to);
        if (typeof r === 'string') { toast(REFUSAL_TEXT[r]); return; }
        markDirty();
        draw();
        const A = a ? monLabel(a) : 'Pokémon';
        toast(r.kind === 'swap' && b ? `Swapped ${A} and ${monLabel(b)}.` : `Moved ${A} to ${to.where === PARTY ? 'your party' : boxLabel(to.where)}.`);
      },
    });

    const cellFor = (where: number, i: number): HTMLElement => {
      const mon = monAt(s, where, i);
      const key = slotKey(where, i);
      if (mon) {
        return h('button', {
          class: drag.lifted() === key ? 'box-cell lifted' : 'box-cell',
          'aria-label': `${monLabel(mon)}${mon.isEgg || mon.bad ? '' : `, level ${mon.level}`}${shinyMark(mon) ? ', shiny' : ''}${mon.item ? `, holding ${itemName(mon.item)}` : ''}, ${placeName(where)}${where === PARTY ? ' ' : ', spot '}${i + 1}. Actions`,
          dataset: { slot: key, pick: '' },
          onclick: () => menuFor(where, i, draw),
        }, monPic(mon, itemName),
        h('span', { class: 'lv-tag' }, mon.isEgg || mon.bad ? 'Egg' : `Lv ${mon.level}`),
        shinyMark(mon),
        where === PARTY ? monHpBar(mon, true, 'small') : null);
      }
      // A box's empty spots each take a new Pokémon right there; the party's first empty one adds to the end.
      if (where !== PARTY || i === s.party.length) {
        return h('button', {
          class: 'box-cell add', 'aria-label': `Add a Pokémon to ${where === PARTY ? 'your party' : `${boxLabel(where)}, spot ${i + 1}`}`, dataset: { slot: key },
          onclick: () => {
            const fresh = freshMon(where === PARTY);
            if (where === PARTY) s.party.push(fresh); else s.boxes[where][i] = fresh;
            const at = where === PARTY ? s.party.length - 1 : i;
            markDirty();
            editMon(where, at, draw, () => { if (where === PARTY) s.party.splice(s.party.indexOf(fresh), 1); else s.boxes[where][i] = null; });
            draw();
          },
        }, h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'));
      }
      return h('span', { class: 'box-cell empty', 'aria-hidden': 'true', dataset: { slot: key } });
    };

    const draw = () => {
      clear(body);
      const picker = selectInput(Array.from({ length: BOX_TOTAL }, (_, i) => ({ value: i, label: optionLabel(i) })), boxView,
        (v) => { boxView = Number(v); draw(); });
      picker.setAttribute('aria-label', 'Choose a box');
      const shownBox = boxView;
      const rename = nameField(`Name of box ${shownBox + 1}`, s.boxNames[shownBox], (v) => {
        s.boxNames[shownBox] = v;
        markDirty();
        const opt = picker.options[shownBox];
        if (opt) opt.textContent = optionLabel(shownBox);
      }, undefined, BOX_NAME_LEN);
      rename.classList.add('box-name');

      body.append(
        h('div', { class: 'box-party', role: 'group', 'aria-label': `Party, ${s.party.length} of ${PARTY_MAX}` },
          h('span', { class: 'box-label' }, `Party ${s.party.length}/${PARTY_MAX}`),
          h('div', { class: 'party-cells' }, Array.from({ length: PARTY_MAX }, (_, i) => cellFor(PARTY, i)))),
        h('div', { class: 'box-nav' },
          h('button', { class: 'icon', 'aria-label': 'Previous box', dataset: { nav: '-1' }, onclick: () => step(-1) }, '‹'),
          picker,
          h('button', { class: 'icon', 'aria-label': 'Next box', dataset: { nav: '1' }, onclick: () => step(1) }, '›')),
        h('div', { class: 'box-grid thirty', role: 'group', 'aria-label': `${boxLabel(boxView)}, ${countAt(s, boxView)} of ${BOX_SLOTS}` },
          Array.from({ length: BOX_SLOTS }, (_, i) => cellFor(boxView, i))),
        rename,
      );
    };
    holder.append(
      h('details', { class: 'tips' },
        h('summary', {}, 'How dragging works'),
        h('ul', {},
          h('li', {}, 'Drop a Pokémon on another one to swap them, or on an empty spot to move it there.'),
          h('li', {}, 'On a touch screen, press and hold for a moment before dragging.'),
          h('li', {}, 'While dragging, hold over ‹ or › to turn to another box.'),
          h('li', {}, 'As in the game, a Pokémon holding Mail can’t go in a box, and your party keeps one Pokémon that can battle.'))),
      body);
    draw();
    return holder;
  }

  render();
};
