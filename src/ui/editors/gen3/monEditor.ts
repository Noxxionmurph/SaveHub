// Pokémon editor dialog for Ruby, Sapphire and Emerald. Laid out like the Gen 2 one, with what Gen 3 changed: the
// personality value (nature, gender, shininess and Unown's form all come from it), abilities, IVs 0-31, EVs 0-255 with
// a 510 total, the ball it was caught in, and where, at what level and in which game it was met.

import {
  ABILITY_NAMES, BALLS, DEX_NAMES, EV_MAX, EV_TOTAL_MAX, GAMES_OF_ORIGIN, LANGUAGES, MOVE_NAMES, NATURE_NAMES, UNOWN,
  UNOWN_FORMS, baseStatsFor, calcStats, expForLevel, findPid, genderOf, growthOf, hasTwoGenders, isMail, isShiny,
  itemChoices, itemName, levelForExp, maxPp, moveInfo, natureEffect, natureOf, placeChoices, placeName, pokerusState,
  speciesName, unownForm, type Gen3Game, type Ivs, type PidWish, type StatKey,
} from '../../../core/gen3/data.ts';
import {
  CONTEST_CATEGORIES, CONTEST_RANKS, GIFT_RIBBONS, SINGLE_RIBBONS, contestRank, contestRibbonId, hasRibbon, ribbonCount, setContestRank,
  setRibbon,
} from '../../../core/gen3/ribbons.ts';
import { defaultNickname, recalcPartyStats, type Gen3Mon } from '../../../core/gen3/save.ts';
import { field, h, lazySelect, numberInput, selectInput } from '../../dom.ts';
import { monDialog } from '../../monDialog.ts';
import { gen3RibbonIcon, itemIcon, itemIconUrl, setIconSrc, shinyIcon, typeIcon } from '../../sprites.ts';
import { typeChips } from '../../typeChip.ts';
import { monHpBar } from './hpBar.ts';
import { itemSpritePath } from './itemSprites.ts';
import { genderMark, monIcon, shinyBadge } from './monBits.ts';
import { nameField } from './nameField.ts';

const SPECIES_OPTIONS = DEX_NAMES.map((name, i) => ({ value: i + 1, label: `#${String(i + 1).padStart(3, '0')} ${name}` }));
const MOVE_OPTIONS = MOVE_NAMES.map((name, i) => ({ value: i, label: i === 0 ? '— (none)' : name }));
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const STAT_LABELS: Record<StatKey, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const NATURE_OPTIONS = NATURE_NAMES.map((name, i) => {
  const e = natureEffect(i);
  return { value: i, label: e ? `${name} (+${STAT_LABELS[e.up]} −${STAT_LABELS[e.down]})` : name };
});
const BALL_OPTIONS = BALLS.map((b) => ({ value: b.id, label: b.name }));
// pokeemerald include/constants/battle.h: bits 0-2 are turns asleep, then poison, burn, freeze, paralysis, bad poison.
const STATUS_OPTIONS = [
  { value: 0, label: 'Healthy' }, { value: 3, label: 'Asleep' }, { value: 8, label: 'Poisoned' }, { value: 16, label: 'Burned' },
  { value: 32, label: 'Frozen' }, { value: 64, label: 'Paralyzed' }, { value: 128, label: 'Badly poisoned' },
];
const statusOptions = (current: number) => (STATUS_OPTIONS.some((o) => o.value === current) ? STATUS_OPTIONS
  : [...STATUS_OPTIONS, { value: current, label: current & 7 ? `Asleep (${current & 7} turns)` : `Other (${current})` }]);
const POKERUS_OPTIONS = [
  { value: 'none', label: 'Never had it' }, { value: 'infected', label: 'Infected' }, { value: 'cured', label: 'Cured' },
];
const keep = <T extends string | number>(list: { value: T; label: string }[], v: T, label: string) =>
  (list.some((o) => o.value === v) ? list : [...list, { value: v, label }]);

/** What a Pokémon can be given to hold. Mail is left out: only the game can write a letter (see heldOptions). */
const holdOptions = (game: Gen3Game) => [{ value: 0, label: '— (nothing)' },
  ...itemChoices(['item', 'ball', 'berry'], game).filter((c) => !isMail(c.id)).map((c) => ({ value: c.id, label: c.name }))];
const heldOptions = (game: Gen3Game, current: number) => keep(holdOptions(game), current, itemName(current));

export interface MonEditorOptions {
  mon: Gen3Mon;
  party: boolean;
  game: Gen3Game;
  /** Called once the window has closed. `changed` is whether the Pokémon now differs from how it was when the window opened. */
  onDone: (changed: boolean) => void;
  /** Called just before onDone when the ✕ closes the window, so a Pokémon that was only just added can be taken back out. */
  onDiscard?: () => void;
}


export function openMonEditor({ mon, party, game, onDone, onDiscard }: MonEditorOptions): void {
  const expAt = (level: number) => expForLevel(growthOf(mon.species), level);
  const win = monDialog({ mon, label: (m) => m.nickname || speciesName(m.species), render, onDone, onDiscard });
  const refresh = win.refresh;
  const touched = () => { if (party) recalcPartyStats(mon); };
  /** A new personality value with these traits; the rest of the Pokémon stays as it is. */
  const repersonalise = (wish: PidWish) => { mon.pid = findPid(mon.species, mon.otId, mon.pid, wish); touched(); refresh(); };

  /** Hatch it, or turn it back into an egg. The game names an egg EGG and counts its hatching down in the friendship byte. */
  const setEgg = (egg: boolean) => {
    const hadDefaultName = mon.nickname === defaultNickname(mon.species, mon.isEgg, speciesName(mon.species));
    mon.isEgg = egg;
    if (hadDefaultName) mon.nickname = defaultNickname(mon.species, egg, speciesName(mon.species));
    mon.friendship = egg ? baseStatsFor(mon.species)?.eggCycles ?? 20 : 120;
    if (egg) { mon.level = 5; mon.exp = expAt(5); mon.status = 0; mon.metLevel = 0; }
    if (party) recalcPartyStats(mon, true);
    refresh();
  };

  /** The ribbons, as the PokéNav shows them: each contest category's four ranks in a row, then the rest. */
  function ribbonSection(): Node {
    const count = h('span', { class: 'muted count' });
    const buttons: { btn: HTMLButtonElement; earned: () => boolean }[] = [];
    const paint = () => {
      for (const b of buttons) b.btn.setAttribute('aria-pressed', String(b.earned()));
      count.textContent = String(ribbonCount(mon.ribbons));
    };
    const ribbon = (id: number, title: string, earned: () => boolean, toggle: () => void, label?: string) => {
      const btn = h('button', { class: 'ribbon-btn', type: 'button', title, 'aria-label': title },
        gen3RibbonIcon(id), label ? h('span', { class: 'ribbon-name' }, label) : null) as HTMLButtonElement;
      btn.addEventListener('click', () => { toggle(); paint(); });
      buttons.push({ btn, earned });
      return btn;
    };
    // A contest rank includes the ranks below it, as in the game: tapping a rank you hold takes it (and those above) away.
    const contestRows = CONTEST_CATEGORIES.map((cat, c) => h('div', { class: 'ribbon-row' },
      h('span', { class: 'ribbon-cat' }, cat),
      CONTEST_RANKS.map((rank, i) => ribbon(contestRibbonId(c, i + 1), `${cat} Ribbon, ${rank} Rank`,
        () => contestRank(mon.ribbons, c) > i,
        () => { mon.ribbons = setContestRank(mon.ribbons, c, contestRank(mon.ribbons, c) > i ? i : i + 1); }))));
    const single = SINGLE_RIBBONS.map((r) => ribbon(r.id, `${r.name} Ribbon: ${r.how}`, () => hasRibbon(mon.ribbons, r.bit),
      () => { mon.ribbons = setRibbon(mon.ribbons, r.bit, !hasRibbon(mon.ribbons, r.bit)); }, r.name));
    // The event ribbons. Which event each stands for is kept once per save, and the PokéNav leaves its description blank
    // for one the save hasn't been told about (pokeemerald: pokenav_ribbons_summary.c), but shows the ribbon.
    const gifts = GIFT_RIBBONS.map((r) => ribbon(r.id, `${r.name} Ribbon (event)`, () => hasRibbon(mon.ribbons, r.bit),
      () => { mon.ribbons = setRibbon(mon.ribbons, r.bit, !hasRibbon(mon.ribbons, r.bit)); }, r.name));
    const setAll = (on: boolean) => {
      let v = mon.ribbons;
      for (let c = 0; c < 5; c++) v = setContestRank(v, c, on ? 4 : 0);
      for (const r of SINGLE_RIBBONS) v = setRibbon(v, r.bit, on);
      if (!on) for (const r of GIFT_RIBBONS) v = setRibbon(v, r.bit, false);
      mon.ribbons = v;
      paint();
    };
    paint();
    return h('div', { class: 'ribbons' },
      h('h3', {}, 'Ribbons', count),
      h('div', { class: 'ribbon-contest' }, contestRows),
      h('div', { class: 'ribbon-grid' }, single, gifts),
      h('div', { class: 'button-row' },
        h('button', { type: 'button', onclick: () => setAll(true) }, 'All ribbons'),
        h('button', { type: 'button', onclick: () => setAll(false) }, 'Clear ribbons')));
  }

  function render(): (Node | null)[] {
    const base = baseStatsFor(mon.species);
    const nature = natureOf(mon.pid);
    const calc = calcStats(mon.species, mon.level, mon.ivs, mon.evs, nature);
    const shiny = isShiny(mon.otId, mon.pid);
    const gender = genderOf(mon.species, mon.pid);
    const effect = natureEffect(nature);
    const evTotal = STAT_KEYS.reduce((n, k) => n + mon.evs[k], 0);
    const abilities = base?.abilities ?? [0, 0];

    const moveRow = (i: number): HTMLElement => {
      const redraw = () => row.replaceWith((row = build()));
      const setUps = (n: number) => {
        const id = mon.moves[i];
        const before = maxPp(id, mon.ppUps[i]);
        mon.ppUps[i] = n;
        const after = maxPp(id, n);
        mon.pp[i] = Math.max(0, Math.min(after, mon.pp[i] + after - before));
        redraw();
      };
      const build = (): HTMLElement => {
        const id = mon.moves[i];
        const info = moveInfo(id);
        const ups = mon.ppUps[i];
        return h('div', { class: 'move-row' },
          h('div', { class: 'move-pick' },
            info ? typeIcon(info.type, 'move-type') : h('span', { class: 'move-type blank', 'aria-hidden': 'true' }),
            selectInput(keep(MOVE_OPTIONS, id, `Move ${id}`), id, (v) => {
              mon.moves[i] = Number(v);
              mon.pp[i] = maxPp(mon.moves[i], mon.ppUps[i]);
              redraw();
            }, { 'aria-label': `Move ${i + 1}` })),
          h('div', { class: 'move-nums' },
            h('div', { class: 'inline-field' },
              h('span', { class: 'field-label' }, 'PP'),
              h('output', { class: 'lcd pp-value', 'aria-label': 'PP' }, id ? String(mon.pp[i]) : '–'),
              h('span', { class: 'max-pp' }, id ? `Max ${maxPp(id, ups)}` : '')),
            h('div', { class: 'inline-field' },
              h('span', { class: 'field-label' }, 'PP Up'),
              h('div', { class: 'stepper', role: 'group', 'aria-label': 'PP Up' },
                h('button', { class: 'icon', 'aria-label': 'Fewer PP Ups', disabled: !id || ups <= 0, onclick: () => setUps(ups - 1) }, '−'),
                h('output', { class: 'lcd stepper-value', 'aria-label': 'PP Ups used' }, id ? String(ups) : '–'),
                h('button', { class: 'icon', 'aria-label': 'More PP Ups', disabled: !id || ups >= 3, onclick: () => setUps(ups + 1) }, '+')))));
      };
      let row = build();
      return row;
    };

    const ivInputs = STAT_KEYS.map((k) =>
      field(STAT_LABELS[k], numberInput(mon.ivs[k], 0, 31, (v) => { mon.ivs[k] = v; touched(); refresh(); })));
    const evInputs = STAT_KEYS.map((k) =>
      field(STAT_LABELS[k], numberInput(mon.evs[k], 0, EV_MAX, (v) => { mon.evs[k] = v; touched(); refresh(); })));

    const shown: Record<StatKey, string | number> = mon.isEgg
      ? { hp: '—', atk: '—', def: '—', spa: '—', spd: '—', spe: '—' }
      : party
        ? { hp: `${mon.hp}/${mon.maxHp}`, atk: mon.atk, def: mon.def, spa: mon.spa, spd: mon.spd, spe: mon.spe }
        : calc ?? { hp: '—', atk: '—', def: '—', spa: '—', spd: '—', spe: '—' };
    // The nature's raised stat in red and lowered one in blue, as on the game's summary screen.
    const statClass = (k: StatKey) => (mon.isEgg ? '' : effect?.up === k ? 'nature-up' : effect?.down === k ? 'nature-down' : '');

    const heldIcon = itemIcon(itemSpritePath(mon.item), mon.item ? '' : 'none');
    const heldPicker = lazySelect(heldOptions(game, mon.item), mon.item, (v) => {
      mon.item = Number(v);
      heldIcon.classList.toggle('none', !mon.item);
      setIconSrc(heldIcon, itemIconUrl(itemSpritePath(mon.item)));
    }, { 'aria-label': 'Held item' });

    const places = placeChoices(game).map((p) => ({ value: p.id, label: p.name }));
    const title = mon.isEgg ? 'Egg' : mon.nickname || speciesName(mon.species);

    const eggRow = h('label', { class: 'check-row' },
      h('input', { type: 'checkbox', checked: mon.isEgg, onchange: (e: Event) => setEgg((e.target as HTMLInputElement).checked) }),
      h('span', {}, 'It’s an egg'),
      h('span', { class: 'muted' }, mon.isEgg ? ' Untick to hatch it now.' : ''));
    const lv = mon.isEgg ? 'Egg' : `Lv ${mon.level}`;

    return [
      h('div', { class: 'mon-head' },
        h('div', { class: 'mon-id' },
          monIcon(mon, 'big'),
          h('div', {},
            h('h2', { id: 'mon-title' }, title, ' ', mon.isEgg ? null : genderMark(gender), shiny && !mon.isEgg ? shinyBadge() : null),
            h('p', { class: 'muted' }, mon.isEgg ? `Will hatch into ${speciesName(mon.species)}` : `#${String(mon.species).padStart(3, '0')} ${speciesName(mon.species)}`,
              mon.isEgg ? null : [' · ', h('span', { class: 'nowrap' }, NATURE_NAMES[nature])],
              mon.species === UNOWN && !mon.isEgg ? [' · ', h('span', { class: 'nowrap' }, `form ${unownForm(mon.pid)}`)] : null),
            h('div', { class: 'mon-head-meta' }, h('span', { class: 'lcd lv lv-inline' }, lv), typeChips(base)),
            (() => { const bar = monHpBar(mon, party, '', true); return bar ? h('div', { class: 'hp-row' }, h('span', { class: 'hp-label', 'aria-hidden': 'true' }, 'HP'), bar) : null; })())),
        h('span', { class: 'lcd lv' }, lv)),
      h('dl', { class: 'lcd stats six', 'aria-label': party ? 'Current stats' : 'Calculated stats' },
        STAT_KEYS.map((k) => h('div', { class: statClass(k) }, h('dt', {}, STAT_LABELS[k]), h('dd', {}, String(shown[k]))))),

      mon.isEgg ? eggRow : null,

      h('div', { class: 'grid' },
        field(mon.isEgg ? 'Hatches into' : 'Species', selectInput(keep(SPECIES_OPTIONS, mon.species, `Species ${mon.species}`), mon.species, (v) => {
          const hadDefaultName = !mon.nickname || mon.nickname === defaultNickname(mon.species, mon.isEgg, speciesName(mon.species));
          mon.species = Number(v);
          if (hadDefaultName) mon.nickname = defaultNickname(mon.species, mon.isEgg, speciesName(mon.species));
          // Experience stays, so the level follows the new species' growth rate, as evolving does in the game.
          mon.level = levelForExp(growthOf(mon.species), mon.exp);
          if (party) recalcPartyStats(mon, mon.isEgg);
          refresh();
        })),
        nameField('Nickname', mon.nickname, (v) => { mon.nickname = v; }),
        field('Level', numberInput(mon.level, 1, 100, (v) => { mon.level = v; mon.exp = expAt(v); touched(); refresh(); })),
        field('Experience', numberInput(mon.exp, 0, expAt(100), (v) => {
          mon.exp = v; mon.level = levelForExp(growthOf(mon.species), v); touched(); refresh();
        })),
        party && !mon.isEgg ? field('Status', selectInput(statusOptions(mon.status), mon.status, (v) => { mon.status = Number(v); })) : null,
        party && !mon.isEgg ? field('Current HP', numberInput(mon.hp, 0, mon.maxHp, (v) => { mon.hp = v; refresh(); })) : null,
        mon.isEgg
          ? field('Egg cycles left', numberInput(mon.friendship, 0, 255, (v) => { mon.friendship = v; }), 'Each cycle is 256 steps.')
          : field('Friendship', numberInput(mon.friendship, 0, 255, (v) => { mon.friendship = v; })),
        h('div', { class: 'field' },
          h('span', { class: 'field-label' }, 'Held item'),
          h('div', { class: 'item-row bare' }, heldIcon, heldPicker),
          isMail(mon.item) ? h('span', { class: 'field-hint' }, 'Mail can only be written in the game.') : null),
        abilities[1]
          ? field('Ability', selectInput(abilities.map((a, i) => ({ value: i, label: ABILITY_NAMES[a] })), mon.abilityBit ? 1 : 0,
            (v) => { mon.abilityBit = Number(v); }))
          : h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Ability'), h('output', { class: 'derived' }, ABILITY_NAMES[abilities[0]] ?? '—')),
        field('Poké Ball', selectInput(keep(BALL_OPTIONS, mon.ball, `Ball ${mon.ball}`), mon.ball, (v) => { mon.ball = Number(v); })),
        field('Pokérus', selectInput(POKERUS_OPTIONS, pokerusState(mon.pokerus), (v) => {
          // Strain 1 for 2 days; cured keeps the strain with no days left.
          mon.pokerus = v === 'none' ? 0 : v === 'cured' ? (mon.pokerus & 0xf0 || 0x10) : (mon.pokerus & 0x0f ? mon.pokerus : 0x12);
        })),
      ),

      h('h3', {}, mon.isEgg ? 'Moves it hatches with' : 'Moves'),
      h('div', { class: 'moves' }, [0, 1, 2, 3].map(moveRow)),

      h('h3', {}, 'Nature and looks'),
      h('p', { class: 'muted section-note' }, 'Nature, gender, shininess and Unown’s form all come from one hidden number, so changing one picks a new number that keeps the others.'),
      h('div', { class: 'grid' },
        field('Nature', selectInput(NATURE_OPTIONS, nature, (v) => repersonalise({ nature: Number(v) }))),
        hasTwoGenders(mon.species)
          ? field('Gender', selectInput([{ value: 'male', label: '♂ Male' }, { value: 'female', label: '♀ Female' }], gender,
            (v) => repersonalise({ gender: v as 'male' | 'female' })))
          : h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Gender'),
            h('output', { class: 'derived' }, gender === 'male' ? '♂ Always male' : gender === 'female' ? '♀ Always female' : 'None')),
        h('div', { class: 'field' },
          h('span', { class: 'field-label' }, 'Shiny'),
          h('label', { class: 'check-row shiny-toggle' },
            h('input', { type: 'checkbox', checked: shiny, onchange: () => repersonalise({ shiny: !shiny }) }),
            h('span', {}, shinyIcon(), ' Shiny'))),
        mon.species === UNOWN
          ? field('Unown form', selectInput([...UNOWN_FORMS].map((l) => ({ value: l, label: l })), unownForm(mon.pid),
            (v) => repersonalise({ unown: v })))
          : null,
      ),

      h('h3', {}, 'IVs'),
      h('p', { class: 'muted section-note' }, 'Hidden genes, 0 to 31. Higher is better.'),
      h('div', { class: 'grid compact cols6 ivs' }, ivInputs),
      h('h3', {}, 'EVs', h('span', { class: `muted count${evTotal > EV_TOTAL_MAX ? ' warn' : ''}` }, `${evTotal}/${EV_TOTAL_MAX}`)),
      h('p', { class: 'muted section-note' }, 'Earned in battle, 0 to 255 each and 510 in all. Every 4 points add 1 to the stat at level 100.'),
      h('div', { class: 'grid compact cols6 evs' }, evInputs),

      party && !mon.isEgg
        ? h('div', {},
          h('h3', {}, 'Battle stats'),
          h('div', { class: 'grid compact cols6' },
            field('Max HP', numberInput(mon.maxHp, 1, 999, (v) => { mon.maxHp = v; mon.hp = Math.min(mon.hp, v); refresh(); })),
            field('Attack', numberInput(mon.atk, 1, 999, (v) => { mon.atk = v; })),
            field('Defense', numberInput(mon.def, 1, 999, (v) => { mon.def = v; })),
            field('Sp. Atk', numberInput(mon.spa, 1, 999, (v) => { mon.spa = v; })),
            field('Sp. Def', numberInput(mon.spd, 1, 999, (v) => { mon.spd = v; })),
            field('Speed', numberInput(mon.spe, 1, 999, (v) => { mon.spe = v; })),
          ),
          calc ? h('p', { class: 'muted' },
            `The game would work out HP ${calc.hp}, Atk ${calc.atk}, Def ${calc.def}, SpA ${calc.spa}, SpD ${calc.spd}, Spe ${calc.spe}.`) : null)
        : null,

      h('h3', {}, 'Origin'),
      h('div', { class: 'grid' },
        nameField('Original trainer', mon.otName, (v) => { mon.otName = v; }, undefined, 7),
        field('OT gender', selectInput([{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }], mon.otGender,
          (v) => { mon.otGender = v === 'female' ? 'female' : 'male'; })),
        field('OT ID', numberInput(mon.otId & 0xffff, 0, 65535, (v) => { mon.otId = ((mon.otId & 0xffff0000) | v) >>> 0; refresh(); })),
        field('OT secret ID', numberInput(mon.otId >>> 16, 0, 65535, (v) => { mon.otId = ((v << 16) | (mon.otId & 0xffff)) >>> 0; refresh(); }),
          'Not yours means traded. Shininess depends on it.'),
        field('Met at', selectInput(keep(places, mon.metLocation, placeName(mon.metLocation)), mon.metLocation, (v) => { mon.metLocation = Number(v); })),
        field('Met at level', numberInput(mon.metLevel, 0, 100, (v) => { mon.metLevel = v; }), '0 means it hatched.'),
        field('Game', selectInput(keep([...GAMES_OF_ORIGIN], mon.metGame, `Game ${mon.metGame}`), mon.metGame, (v) => { mon.metGame = Number(v); })),
        field('Language', selectInput(keep([...LANGUAGES], mon.language, `Language ${mon.language}`), mon.language, (v) => { mon.language = Number(v); })),
      ),

      mon.isEgg ? null : eggRow,

      mon.isEgg ? null : ribbonSection(),

      h('h3', {}, 'Shortcuts'),
      h('div', { class: 'button-row' },
        h('button', { onclick: () => { mon.ivs = { hp: 31, atk: 31, def: 31, spe: 31, spa: 31, spd: 31 } satisfies Ivs; touched(); refresh(); } }, 'Max IVs'),
        h('button', { onclick: () => { mon.evs = { hp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0 }; touched(); refresh(); } }, 'Clear EVs'),
        mon.isEgg ? null : h('button', { onclick: () => { mon.friendship = 255; refresh(); } }, 'Max friendship'),
        h('button', { onclick: () => { mon.pp = mon.moves.map((m, i) => maxPp(m, mon.ppUps[i])) as Gen3Mon['pp']; refresh(); } }, 'Restore PP'),
        party && !mon.isEgg ? h('button', { onclick: () => { mon.status = 0; recalcPartyStats(mon, true); refresh(); } }, 'Heal and recalculate stats') : null,
      ),
      h('div', { class: 'dialog-foot' },
        h('span', { class: 'muted' }, 'Done keeps your changes; the ✕ at the top throws them away.'),
        h('button', { class: 'primary', onclick: win.close }, 'Done'),
      ),
    ];
  }

  win.open();
}
