// Gen 2 (Gold / Silver / Crystal) editor UI. Loaded lazily by the shell via the game modules. Laid out like the Gen 1
// editor, with what Gold and Silver added: sixteen badges, Mom's savings, the four bag pockets, held items, eggs,
// shininess and gender, fourteen named boxes and the 251-Pokémon Pokédex. Crystal adds the player's gender, its four
// new key items and a record of where each Pokémon was caught.

import { popcount } from '../../../core/bytes.ts';
import {
  DEX_COUNT, DEX_NAMES, HM_COUNT, JOHTO_BADGES, KANTO_BADGES, PRINT_SHADES, TEXT_SPEEDS, TMHM_LABELS, TMHM_MOVES, TM_COUNT,
  baseStatsFor, genderOf, itemChoices, itemName, moveInfo, speciesName, type ItemSet, type Pocket,
} from '../../../core/gen2/data.ts';
import { BOX_MAX, BOX_TOTAL, PARTY, PARTY_MAX, REFUSAL_TEXT, dropMon, listAt, placeName, shiftMon } from '../../../core/gen2/roster.ts';
import {
  BAG_MAX, BOX_NAME_LEN, COINS_MAX, MONEY_MAX, PLAYER_NAME_MAX, depositInBox, newMon, type BagItem, type Gen2Mon, type Gen2Save,
} from '../../../core/gen2/save.ts';
import type { MountEditor } from '../../../core/types.ts';
import { clear, field, h, lazySelect, numberInput, refocusAfterRemove, selectInput, toast } from '../../dom.ts';
import { enableDrag } from '../../drag.ts';
import { dexTab as sharedDexTab } from '../../dexTab.ts';
import { choiceRow, stepRow } from '../../gameChoice.ts';
import { itemList } from '../../itemList.ts';
import { badgeIcon, itemIcon, itemIconUrl, setIconSrc } from '../../sprites.ts';
import { tabBar, tabPanel } from '../../tabs.ts';
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
/** One shared options array per picker, so each picker's markup is built once and cloned for every row. */
const pickerCache = new Map<ItemSet, { item: Options; ball: Options; key: Options; pc: Options }>();
function pickers(set: ItemSet) {
  let p = pickerCache.get(set);
  if (!p) {
    const of = (...pockets: Pocket[]) => itemChoices(pockets, set).map((c) => ({ value: c.id, label: c.name }));
    // The PC takes anything except TMs and HMs (pokegold: the PC's deposit screen offers only the other three pockets).
    p = { item: of('item'), ball: of('ball'), key: of('key'), pc: of('item', 'ball', 'key') };
    pickerCache.set(set, p);
  }
  return p;
}

const RARE_CANDY = 0x20;
const ULTRA_BALL = 0x02;


export const mountGen2Editor: MountEditor<Gen2Save> = (container, s, host) => {
  let tab: Tab = 'trainer';
  let boxView = s.currentBoxIndex;
  let cardIntroPlayed = false;
  let tmHideHeld = false;
  const { item: ITEM_OPTIONS, ball: BALL_OPTIONS, key: KEY_OPTIONS, pc: PC_OPTIONS } = pickers(s.game);
  const nameOf = (id: number) => itemName(id, s.game);
  const markDirty = () => host.markDirty();
  let refreshers: (() => void)[] = [];
  const edited = () => { markDirty(); refreshers.forEach((f) => f()); };

  const render = () => {
    refreshers = [];
    clear(container);
    container.append(
      tabBar(TABS, tab, (id) => { tab = id; render(); }),
      tabPanel(TABS, tab, renderTab()),
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

  const badgeTotal = () => popcount(s.johtoBadges) + popcount(s.kantoBadges);

  function overview(): HTMLElement {
    const stat = (label: string) => { const dd = h('dd'); return { node: h('div', {}, h('dt', {}, label), dd), dd }; };
    const name = h('span', { class: 'tcard-name' });
    const id = h('span', { class: 'tcard-id' });
    const money = stat('Money');
    const dex = stat('Pokédex');
    const time = stat('Time');
    const badges = stat('Badges');
    const row = (region: 'johto' | 'kanto') =>
      h('div', { class: 'tcard-badges', role: 'img' }, Array.from({ length: 8 }, (_, i) => h('span', { class: 'badge-slot' }, badgeIcon(i + 1, '', region))));
    const johto = row('johto');
    const kanto = row('kanto');
    const strip = h('div', { class: 'party-strip', role: 'group', 'aria-label': 'Party' });

    const paintCard = () => {
      name.textContent = s.trainerName || '—';
      id.textContent = `ID ${String(s.trainerId).padStart(5, '0')}`;
      money.dd.textContent = `¥${s.money.toLocaleString('en-US')}`;
      let owned = 0;
      for (let n = 1; n <= DEX_COUNT; n++) owned += Number(s.isOwned(n));
      dex.dd.textContent = String(owned);
      time.dd.textContent = `${s.playHours}:${String(s.playMinutes).padStart(2, '0')}`;
      badges.dd.textContent = `${badgeTotal()}/16`;
      johto.setAttribute('aria-label', `${popcount(s.johtoBadges)} of 8 Johto badges earned`);
      kanto.setAttribute('aria-label', `${popcount(s.kantoBadges)} of 8 Kanto badges earned`);
      Array.from(johto.children).forEach((slot, i) => slot.classList.toggle('earned', Boolean((s.johtoBadges >> i) & 1)));
      Array.from(kanto.children).forEach((slot, i) => slot.classList.toggle('earned', Boolean((s.kantoBadges >> i) & 1)));
    };
    const paintParty = () => {
      clear(strip);
      strip.append(...Array.from({ length: 6 }, (_, i) => {
        const mon = s.party[i];
        if (!mon) return h('span', { class: 'party-slot empty', 'aria-hidden': 'true' });
        return h('button', {
          class: 'party-slot', 'aria-label': `${monLabel(mon)}${mon.isEgg ? '' : `, level ${mon.level}`}${shinyMark(mon) ? ', shiny' : ''}${mon.item ? `, holding ${nameOf(mon.item)}` : ''}. Edit`,
          onclick: () => openMonEditor({ mon, party: true, game: s.game, onDone: (changed) => { if (changed) edited(); paintParty(); } }),
        }, monPic(mon, nameOf),
        h('span', { class: 'slot-name' }, monLabel(mon)),
        shinyMark(mon),
        // An egg's name already says Egg, so it gets no level line
        mon.isEgg ? null : h('span', { class: 'lv-tag' }, `Lv ${mon.level}`),
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
        johto, kanto),
      strip);
    cardIntroPlayed = true;
    return card;
  }

  /** One region's eight badges as toggle buttons, with a line naming the ones you have (the names don't fit on a phone). */
  function badgeCard(title: string, names: readonly string[], region: 'johto' | 'kanto', get: () => number, set: (v: number) => void): Node {
    const caption = h('p', { class: 'muted badge-caption', 'aria-live': 'polite' });
    const paintCaption = () => {
      const earned = names.filter((_, i) => (get() >> i) & 1);
      caption.textContent = earned.length === 0 ? `No ${title} earned yet.`
        : earned.length === names.length ? `All eight ${title} earned.` : `Earned: ${earned.join(', ')}.`;
    };
    paintCaption();
    const buttons = names.map((name, i) => {
      const btn = h('button', { class: 'badge-btn', title: `${name} Badge`, 'aria-pressed': String(Boolean((get() >> i) & 1)) },
        h('span', { class: 'gem', 'aria-hidden': 'true' }, badgeIcon(i + 1, '', region)), h('span', { class: 'badge-name' }, name));
      btn.addEventListener('click', () => {
        set(get() ^ (1 << i));
        btn.setAttribute('aria-pressed', String(Boolean((get() >> i) & 1)));
        paintCaption();
        edited();
      });
      return btn;
    });
    const setAll = (v: number) => {
      set(v);
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(Boolean((v >> i) & 1))));
      paintCaption();
      edited();
    };
    return h('div', { class: 'subgroup' },
      h('h4', {}, title),
      h('div', { class: 'badge-grid' }, buttons),
      caption,
      h('div', { class: 'button-row' },
        // the same words as Gen 1's; the heading above already says which region
        h('button', { onclick: () => setAll(0xff) }, 'All badges'),
        h('button', { onclick: () => setAll(0) }, 'Clear badges')));
  }

  function trainerTab(): Node {
    return h('div', { class: 'stack' },
      overview(),
      h('section', { class: 'card' },
        h('h3', {}, 'Trainer'),
        h('p', { class: 'muted card-note' }, 'Type {PK} or {MN} for the PK and MN symbols.'),
        h('div', { class: 'grid pair' },
          nameField('Trainer name', s.trainerName, (v) => { s.trainerName = v; edited(); }, undefined, PLAYER_NAME_MAX, true),
          nameField('Rival name', s.rivalName, (v) => { s.rivalName = v; markDirty(); }, undefined, PLAYER_NAME_MAX, true),
        ),
        s.playerGender ? h('div', { class: 'lcd options-window player-gender' },
          choiceRow('Player', [{ value: 'boy', label: 'Boy' }, { value: 'girl', label: 'Girl' }], s.playerGender,
            (v) => { s.playerGender = v === 'girl' ? 'girl' : 'boy'; markDirty(); })) : null,
        s.playerGender ? h('p', { class: 'muted section-note' },
          'Pokémon you catch from now on remember which you played as.') : null,
        h('div', { class: 'grid one' },
          field('Trainer ID', numberInput(s.trainerId, 0, 65535, (v) => { s.trainerId = v; edited(); }),
            'Change it and the Pokémon you caught count as traded: more experience, but they may disobey without enough badges.'),
        ),
        h('div', { class: 'grid trio money' },
          field('Money (¥)', numberInput(s.money, 0, MONEY_MAX, (v) => { s.money = v; edited(); })),
          field('Mom’s savings (¥)', numberInput(s.momsMoney, 0, MONEY_MAX, (v) => { s.momsMoney = v; markDirty(); })),
          field('Game Corner coins', numberInput(s.coins, 0, COINS_MAX, (v) => { s.coins = v; markDirty(); })),
        ),
        h('div', { class: 'button-row' },
          h('button', { onclick: () => { s.money = MONEY_MAX; s.momsMoney = MONEY_MAX; s.coins = COINS_MAX; markDirty(); render(); } }, 'Max money & coins'),
        ),
        h('div', { class: 'subgroup' },
          h('h4', {}, 'Play time'),
          h('div', { class: 'grid trio' },
            field('Hours', numberInput(s.playHours, 0, 999, (v) => { s.playHours = v; edited(); })),
            field('Minutes', numberInput(s.playMinutes, 0, 59, (v) => { s.playMinutes = v; edited(); })),
            field('Seconds', numberInput(s.playSeconds, 0, 59, (v) => { s.playSeconds = v; markDirty(); })),
          ))),
      h('section', { class: 'card' },
        h('h3', {}, 'Badges'),
        badgeCard('Johto badges', JOHTO_BADGES, 'johto', () => s.johtoBadges, (v) => { s.johtoBadges = v; }),
        badgeCard('Kanto badges', KANTO_BADGES, 'kanto', () => s.kantoBadges, (v) => { s.kantoBadges = v; })),
      optionsCard(),
    );
  }

  /** The settings from the in-game OPTION menu. */
  function optionsCard(): Node {
    const o = s.options;
    const keep = <T extends { value: number; label: string }>(list: readonly T[], v: number) =>
      list.some((t) => t.value === v) ? [...list] : [...list, { value: v, label: `Custom (${v})` }];
    const onOff = (on: boolean) => (on ? 'on' : 'off');
    return h('section', { class: 'card' },
      h('h3', {}, 'Game options'),
      h('div', { class: 'lcd options-window' },
        choiceRow('Text speed', keep(TEXT_SPEEDS, o.textSpeed).map((t) => ({ value: String(t.value), label: t.label })), String(o.textSpeed),
          (v) => { o.textSpeed = Number(v); edited(); }),
        choiceRow('Battle scene', [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }], onOff(!o.battleSceneOff),
          (v) => { o.battleSceneOff = v === 'off'; edited(); }),
        choiceRow('Battle style', [{ value: 'shift', label: 'Shift' }, { value: 'set', label: 'Set' }], o.battleStyleSet ? 'set' : 'shift',
          (v) => { o.battleStyleSet = v === 'set'; edited(); }),
        choiceRow('Sound', [{ value: 'mono', label: 'Mono' }, { value: 'stereo', label: 'Stereo' }], o.stereo ? 'stereo' : 'mono',
          (v) => { o.stereo = v === 'stereo'; edited(); }),
        stepRow('Print', keep(PRINT_SHADES, o.printShade).map((t) => ({ value: String(t.value), label: t.label })), String(o.printShade),
          (v) => { o.printShade = Number(v); edited(); }, 'How dark the Game Boy Printer prints.'),
        choiceRow('Menu account', [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }], onOff(o.menuAccount),
          (v) => { o.menuAccount = v === 'on'; edited(); }, 'On shows a line explaining each start-menu choice.'),
        stepRow('Frame', Array.from({ length: 8 }, (_, i) => ({ value: String(i), label: `Type ${i + 1}` })), String(o.frame),
          (v) => { o.frame = Number(v); edited(); }),
      ));
  }

  // ---------- bag ----------


  const bagCard = (title: string, items: BagItem[], slots: number, options: Options, fresh: () => number) => itemList({
    title, items, slots, maxCount: 99, options, nameOf, spritePath: itemSpritePath, fresh, markDirty,
  });

  /** The Key Items pocket: one of each, so no quantity. */
  function keyList(): Node {
    const wrap = h('section', { class: 'card' });
    const max = BAG_MAX.keyItems;
    const draw = () => {
      clear(wrap);
      const list = s.keyItems;
      wrap.append(
        h('h3', {}, 'Key Items pocket', h('span', { class: 'muted count' }, `${list.length}/${max}`)),
        ...list.map((id, i) => {
          const icon = itemIcon(itemSpritePath(id));
          return h('div', { class: 'item-row no-count' },
            icon,
            lazySelect(KEY_OPTIONS.some((c) => c.value === id) ? KEY_OPTIONS : [{ value: id, label: nameOf(id) }, ...KEY_OPTIONS],
              id, (v) => { list[i] = Number(v); setIconSrc(icon, itemIconUrl(itemSpritePath(list[i]))); markDirty(); }, { 'aria-label': `Key item ${i + 1}` }),
            h('button', { class: 'icon', 'aria-label': `Remove key item ${i + 1}`, onclick: () => { list.splice(i, 1); markDirty(); draw(); refocusAfterRemove(wrap, (n) => `Remove key item ${n + 1}`, i); } }, '✕'),
          );
        }),
        h('button', {
          disabled: list.length >= max,
          onclick: () => {
            const next = KEY_OPTIONS.find((o) => !list.includes(o.value))?.value ?? KEY_OPTIONS[0].value;
            list.push(next); markDirty(); draw();
          },
        }, list.length >= max ? `Full (${max} of ${max})` : '+ Add key item'),
      );
    };
    draw();
    return wrap;
  }

  /** TM/HM pocket: a count for each of the 57, as the game stores it. */
  function tmhmCard(): Node {
    const wrap = h('section', { class: 'card' });
    const counter = h('span', { class: 'muted count' });
    const paint = () => { counter.textContent = `${s.tmhm.filter((n) => n > 0).length}/${TM_COUNT + HM_COUNT}`; };
    const rows = TMHM_MOVES.map((move, i) => {
      const info = moveInfo(move);
      const hm = i >= TM_COUNT;
      const input = numberInput(s.tmhm[i], 0, hm ? 1 : 99, (v) => { s.tmhm[i] = v; markDirty(); paint(); }, { 'aria-label': `${TMHM_LABELS[i]} count` });
      return h('div', { class: 'tm-row', hidden: tmHideHeld && s.tmhm[i] > 0 },
        itemIcon(discPath(i)),
        h('span', { class: 'tm-label' }, h('span', { class: 'tm-no' }, TMHM_LABELS[i]), ' ', info?.name ?? `Move ${move}`),
        input);
    });
    /** Set every TM to `tm` and every HM to `hm`; null leaves that kind as it is. */
    const fill = (tm: number | null, hm: number | null) => {
      s.tmhm = s.tmhm.map((n, i) => (i < TM_COUNT ? tm ?? n : hm ?? n));
      markDirty();
      render(); // rebuilt rather than patched, so each field's own idea of its value stays right
    };
    // Hides the ones you already have, leaving what's left to get; a count you type stays on screen until you switch
    // this off and on again, so the field doesn't vanish under your finger.
    const hideHeld = h('input', {
      type: 'checkbox', checked: tmHideHeld,
      onchange: () => { tmHideHeld = hideHeld.checked; rows.forEach((r, i) => { r.hidden = tmHideHeld && s.tmhm[i] > 0; }); },
    });
    paint();
    wrap.append(
      h('h3', {}, 'TM/HM pocket', counter),
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
      bagCard('Items pocket', s.items, BAG_MAX.items, ITEM_OPTIONS, () => RARE_CANDY),
      bagCard('Balls pocket', s.balls, BAG_MAX.balls, BALL_OPTIONS, () => ULTRA_BALL),
      keyList(),
      bagCard('PC item storage', s.pcItems, BAG_MAX.pcItems, PC_OPTIONS, () => RARE_CANDY),
    ),
    tmhmCard());

  // ---------- Pokémon lists ----------

  function monCard(mon: Gen2Mon, onOpen: () => void, extra: Node[] = [], before: Node[] = []): HTMLElement {
    const name = speciesName(mon.species);
    const label = monLabel(mon);
    return h('div', { class: 'mon' },
      ...before,
      h('button', { class: 'mon-main', onclick: onOpen },
        // the held item sits on the picture, away from the types
        monPic(mon, nameOf),
        h('span', { class: 'mon-title' },
          mon.isEgg ? null : h('span', { class: 'mon-dex' }, `#${String(mon.species).padStart(3, '0')}`),
          h('span', { class: 'mon-name' }, label, ' '),
          mon.isEgg ? h('span', { class: 'muted' }, `(${name})`) : label !== name ? h('span', { class: 'muted' }, `(${name})`) : null,
          mon.isEgg ? null : genderMark(genderOf(mon.species, mon.dvs)),
          shinyMark(mon)),
        h('span', { class: 'mon-meta' },
          h('span', { class: 'lcd lv' }, mon.isEgg ? 'Egg' : `Lv ${mon.level}`),
          mon.isEgg ? null : typeChips(baseStatsFor(mon.species))),
        monHpBar(mon, true, 'in-card'),
      ),
      ...extra,
    );
  }

  function editMon(where: number, index: number, redraw: () => void, onDiscard?: () => void): void {
    const mon = listAt(s, where)[index];
    if (mon) openMonEditor({ mon, party: where === PARTY, game: s.game, onDiscard, onDone: (changed) => { if (changed) markDirty(); redraw(); } });
  }

  function menuFor(where: number, index: number, redraw: () => void): void {
    openMonMenu({
      save: s, where, index,
      onEdit: () => editMon(where, index, redraw),
      onChange: () => { markDirty(); redraw(); },
    });
  }

  /** A brand-new Pokémon with the trainer as its original owner (Togepi is just a starting point). */
  function freshMon(party: boolean): Gen2Mon {
    const mon = newMon(175, 5);
    mon.otName = s.trainerName;
    mon.otId = s.trainerId;
    if (!party) depositInBox(mon);
    return mon;
  }

  /** Take a just-added Pokémon back out of its list. */
  function takeBack<T>(list: T[], mon: T): void {
    const i = list.indexOf(mon);
    if (i >= 0) list.splice(i, 1);
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
          // closing the new Pokémon's window with ✕ means "never mind": it goes again
          editMon(PARTY, s.party.length - 1, draw, () => takeBack(s.party, mon));
          draw();
        },
      }, s.party.length >= PARTY_MAX ? `Party full (${PARTY_MAX} of ${PARTY_MAX})` : `+ Add Pokémon (${s.party.length}/${PARTY_MAX})`));
    };
    draw();
    return h('div', { class: 'stack' },
      wrap);
  }

  function boxesTab(): Node {
    const holder = h('div', { class: 'boxes' });
    const body = h('div');
    const step = (d: number) => { boxView = (boxView + d + BOX_TOTAL) % BOX_TOTAL; draw(); };
    const slotKey = (where: number, index: number) => `${where}:${index}`;
    const parseKey = (key: string) => { const [where, index] = key.split(':').map(Number); return { where, index }; };
    const boxLabel = (i: number) => s.boxNames[i] || `Box ${i + 1}`;

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
        toast(r.kind === 'swap' && b ? `Swapped ${A} and ${monLabel(b)}.` : `Moved ${A} to ${to.where === PARTY ? 'your party' : boxLabel(to.where)}.`);
      },
    });

    const cellFor = (where: number, i: number): HTMLElement => {
      const list = listAt(s, where);
      const mon = list[i];
      const key = slotKey(where, i);
      if (mon) {
        return h('button', {
          class: drag.lifted() === key ? 'box-cell lifted' : 'box-cell',
          'aria-label': `${monLabel(mon)}${mon.isEgg ? '' : `, level ${mon.level}`}, ${shinyMark(mon) ? ', shiny' : ''}${mon.item ? `, holding ${nameOf(mon.item)}` : ''}, ${placeName(where)}${where === PARTY ? ' ' : ', slot '}${i + 1}. Actions`,
          dataset: { slot: key, pick: '' },
          onclick: () => menuFor(where, i, draw),
        }, monPic(mon, nameOf),
        h('span', { class: 'lv-tag' }, mon.isEgg ? 'Egg' : `Lv ${mon.level}`),
        shinyMark(mon),
        where === PARTY ? monHpBar(mon, true, 'small') : null);
      }
      if (where !== PARTY && i === list.length) {
        return h('button', {
          class: 'box-cell add', 'aria-label': `Add a Pokémon to ${boxLabel(where)}`, dataset: { slot: key },
          onclick: () => { const mon = freshMon(false); list.push(mon); markDirty(); editMon(where, list.length - 1, draw, () => takeBack(list, mon)); draw(); },
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
          label: `${boxLabel(i)}${i === s.currentBoxIndex ? ' (current)' : ''} · ${listAt(s, i).length}/${BOX_MAX}`,
        })), boxView, (v) => { boxView = Number(v); draw(); });
      picker.setAttribute('aria-label', 'Choose a box');
      const shownBox = boxView;
      const rename = nameField(`Name of box ${shownBox + 1}`, s.boxNames[shownBox], (v) => {
        s.boxNames[shownBox] = v;
        markDirty();
        const opt = picker.options[shownBox];
        if (opt) opt.textContent = `${boxLabel(shownBox)}${shownBox === s.currentBoxIndex ? ' (current)' : ''} · ${listAt(s, shownBox).length}/${BOX_MAX}`;
      }, undefined, BOX_NAME_LEN - 1);
      rename.classList.add('box-name');

      body.append(
        h('div', { class: 'box-party', role: 'group', 'aria-label': `Party, ${s.party.length} of ${PARTY_MAX}` },
          h('span', { class: 'box-label' }, `Party ${s.party.length}/${PARTY_MAX}`),
          h('div', { class: 'party-cells' }, Array.from({ length: PARTY_MAX }, (_, i) => cellFor(PARTY, i)))),
        h('div', { class: 'box-nav' },
          h('button', { class: 'icon', 'aria-label': 'Previous box', dataset: { nav: '-1' }, onclick: () => step(-1) }, '‹'),
          picker,
          h('button', { class: 'icon', 'aria-label': 'Next box', dataset: { nav: '1' }, onclick: () => step(1) }, '›')),
        h('div', { class: 'box-grid', role: 'group', 'aria-label': `${boxLabel(boxView)}, ${list.length} of ${BOX_MAX}` },
          Array.from({ length: BOX_MAX }, (_, i) => cellFor(boxView, i))),
        rename,
      );
    };
    holder.append(
      h('details', { class: 'tips' },
        h('summary', {}, 'How dragging works'),
        h('ul', {},
          h('li', {}, 'Drop a Pokémon on another one to swap them, in a box or with your party.'),
          h('li', {}, 'Drop it on an empty spot to move it to the end of that box or your party.'),
          h('li', {}, 'On a touch screen, press and hold for a moment before dragging. A quick swipe still scrolls the page.'),
          h('li', {}, 'While dragging, hold over ‹ or › to turn to another box.'),
          h('li', {}, 'As in the game, a Pokémon holding Mail can’t go in a box, and your party keeps at least one Pokémon that can battle.'),
          h('li', {}, 'A Pokémon taken out of a box is healed, and one put in has its PP restored, just as the game does. “(current)” marks the box where new catches go.'))),
      body);
    draw();
    return holder;
  }

  // ---------- Pokédex ----------

  function dexTab(): Node {
    return sharedDexTab(s, DEX_NAMES, markDirty);
  }

  render();
};
