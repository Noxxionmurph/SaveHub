// Pokémon editor dialog for Gold, Silver and Crystal: Gen 1's, plus what Gen 2 added (held item, friendship, Pokérus, gender,
// shininess, Unown's letter, eggs) and the split of Special into Special Attack and Special Defense. For Crystal it also
// edits the record of where the Pokémon was caught.

import {
  DEX_NAMES, MOVE_NAMES, UNOWN, UNOWN_LETTERS, attackDvForGender, baseStatsFor, dvsForUnownLetter, expForLevel,
  genderOf, growthOf, guessGrowth, hasTwoGenders, hpDv, isMail, isShiny, itemChoices, itemName, maxPp, moveInfo,
  pokerusState, shinyDvs, speciesName, unownLetter,
} from '../../../core/gen2/data.ts';
import { CAUGHT_LEVEL_MAX, LOCATION_CHOICES, decodeCaught, encodeCaught, locationName, type CaughtData } from '../../../core/gen2/caught.ts';
import { calcStats, defaultNickname, recalcPartyStats, type Gen2Game, type Gen2Mon } from '../../../core/gen2/save.ts';
import { field, h, lazySelect, numberInput, selectInput } from '../../dom.ts';
import { monDialog } from '../../monDialog.ts';
import { itemIcon, itemIconUrl, setIconSrc, shinyIcon, typeIcon } from '../../sprites.ts';
import { typeChips } from '../../typeChip.ts';
import { monHpBar } from './hpBar.ts';
import { itemSpritePath } from './itemSprites.ts';
import { monIcon, genderMark, shinyBadge } from './monBits.ts';
import { nameField } from './nameField.ts';

const SPECIES_OPTIONS = DEX_NAMES.map((name, i) => ({ value: i + 1, label: `#${String(i + 1).padStart(3, '0')} ${name}` }));
const MOVE_OPTIONS = MOVE_NAMES.map((name, i) => ({ value: i, label: i === 0 ? '— (none)' : name }));
/** What a Pokémon can be given to hold: the Items and Balls pockets. Mail is left out (see heldOptions). */
const HOLD_CHOICES = itemChoices(['item', 'ball']).filter((c) => !isMail(c.id));
const HOLD_OPTIONS = [{ value: 0, label: '— (nothing)' }, ...HOLD_CHOICES.map((c) => ({ value: c.id, label: c.name }))];
const STAT_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' } as const;
const DV_LABELS = { atk: 'Atk', def: 'Def', spe: 'Spe', spc: 'Spc' } as const;
const EV_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', spe: 'Spe', spc: 'Spc' } as const;
// pokegold constants/battle_constants.asm: bits 0-2 are turns asleep, then poison, burn, freeze, paralysis.
const STATUS_OPTIONS = [
  { value: 0, label: 'Healthy' }, { value: 3, label: 'Asleep' }, { value: 8, label: 'Poisoned' },
  { value: 16, label: 'Burned' }, { value: 32, label: 'Frozen' }, { value: 64, label: 'Paralyzed' },
];
/** The status choices, plus the Pokémon's own value if it isn't one of them (asleep for 1 or 2 turns, say), so it isn't changed by opening the window. */
const statusOptions = (current: number) => (STATUS_OPTIONS.some((o) => o.value === current) ? STATUS_OPTIONS
  : [...STATUS_OPTIONS, { value: current, label: current & 7 ? `Asleep (${current & 7} turns)` : `Other (${current})` }]);
const LOCATION_OPTIONS = LOCATION_CHOICES.map((c) => ({ value: c.id, label: c.name }));
const TIME_OPTIONS = [
  { value: '', label: 'Not recorded' }, { value: 'morning', label: 'Morning' }, { value: 'day', label: 'Day' }, { value: 'night', label: 'Night' },
];
const POKERUS_OPTIONS = [
  { value: 'none', label: 'Never had it' },
  { value: 'infected', label: 'Infected (spreads, doubles stat experience)' },
  { value: 'cured', label: 'Cured (still doubles stat experience)' },
];

/**
 * The held-item picker's choices. Mail is only offered if this Pokémon already holds it: a letter is written in the
 * game's mail screen, and the editor can't write one, so giving Mail here would leave a blank letter.
 */
function heldOptions(current: number): { value: number; label: string }[] {
  if (HOLD_OPTIONS.some((o) => o.value === current)) return HOLD_OPTIONS;
  return [{ value: current, label: itemName(current) }, ...HOLD_OPTIONS];
}

export interface MonEditorOptions {
  mon: Gen2Mon;
  party: boolean;
  /** Which game the save is from. Crystal's Pokémon carry a record of where they were caught. */
  game?: Gen2Game;
  /** Called once the window has closed. `changed` is whether the Pokémon now differs from how it was when the window opened. */
  onDone: (changed: boolean) => void;
  /** Called just before onDone when the ✕ closes the window, so a Pokémon that was only just added can be taken back out. */
  onDiscard?: () => void;
}

export function openMonEditor({ mon, party, game = 'gs', onDone, onDiscard }: MonEditorOptions): void {
  const guessed = guessGrowth(mon.level, mon.exp);
  const expAt = (level: number) => expForLevel(growthOf(mon.species, guessed), level);
  const win = monDialog({ mon, label: (m) => m.nickname || speciesName(m.species), render, onDone, onDiscard });
  const refresh = win.refresh;
  const touched = () => { if (party) recalcPartyStats(mon); };
  const setDvs = (dvs: Gen2Mon['dvs']) => { mon.dvs = dvs; touched(); refresh(); };

  /** Hatch it, or turn it back into an egg. The game names an egg EGG and counts its hatching down in the friendship byte. */
  const setEgg = (egg: boolean) => {
    const hadDefaultName = mon.nickname === defaultNickname(mon.species, mon.isEgg);
    mon.isEgg = egg;
    if (hadDefaultName) mon.nickname = defaultNickname(mon.species, egg);
    mon.friendship = egg ? baseStatsFor(mon.species)?.eggCycles ?? 20 : 120; // a hatched Pokémon starts at 120
    if (egg) { mon.level = 5; mon.exp = expAt(5); mon.status = 0; }
    if (party) recalcPartyStats(mon, true);
    refresh();
  };

  function render(): (Node | null)[] {
    const base = baseStatsFor(mon.species);
    const calc = calcStats(mon.species, mon.level, mon.dvs, mon.evs);
    const shiny = isShiny(mon.dvs);
    const gender = genderOf(mon.species, mon.dvs);

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
        const iconType = info?.type;   // Curse's is "???", which has its own icon
        return h('div', { class: 'move-row' },
          h('div', { class: 'move-pick' },
            iconType ? typeIcon(iconType, 'move-type') : h('span', { class: 'move-type blank', 'aria-hidden': 'true' }),
            selectInput(MOVE_OPTIONS, id, (v) => {
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

    const dvInputs = (['atk', 'def', 'spe', 'spc'] as const).map((k) =>
      field(DV_LABELS[k], numberInput(mon.dvs[k], 0, 15, (v) => { setDvs({ ...mon.dvs, [k]: v }); })));
    const hpDvCell = h('div', { class: 'field' },
      h('span', { class: 'field-label' }, 'HP'),
      h('output', { class: 'derived', 'aria-label': 'HP DV, worked out from the other four' }, String(hpDv(mon.dvs))));
    const evInputs = (['hp', 'atk', 'def', 'spe', 'spc'] as const).map((k) =>
      field(EV_LABELS[k], numberInput(mon.evs[k], 0, 65535, (v) => { mon.evs[k] = v; touched(); refresh(); })));

    const keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
    const shown: Record<(typeof keys)[number], string | number> = mon.isEgg
      ? { hp: '—', atk: '—', def: '—', spa: '—', spd: '—', spe: '—' }
      : party
        ? { hp: `${mon.hp}/${mon.maxHp}`, atk: mon.atk, def: mon.def, spa: mon.spa, spd: mon.spd, spe: mon.spe }
        : calc ?? { hp: '—', atk: '—', def: '—', spa: '—', spd: '—', spe: '—' };

    // The held item's picture changes in place, so picking one doesn't redraw (and scroll) the whole window.
    const heldIcon = itemIcon(itemSpritePath(mon.item), mon.item ? '' : 'none');
    const heldPicker = lazySelect(heldOptions(mon.item), mon.item, (v) => {
      mon.item = Number(v);
      if (!isMail(mon.item)) delete mon.mail;
      heldIcon.classList.toggle('none', !mon.item);
      setIconSrc(heldIcon, itemIconUrl(itemSpritePath(mon.item)));
    }, { 'aria-label': 'Held item' });
    const heldNote = isMail(mon.item)
      ? 'It holds Mail with a letter written in the game. Pick another item to throw the letter away.'
      : 'Mail can only be given in the game.';

    const rus = pokerusState(mon.pokerus);
    const caught = decodeCaught(mon.caught);
    const setCaught = (change: Partial<CaughtData>) => { mon.caught = encodeCaught({ ...decodeCaught(mon.caught), ...change }); };
    const locations = LOCATION_OPTIONS.some((o) => o.value === caught.location) ? LOCATION_OPTIONS
      : [...LOCATION_OPTIONS, { value: caught.location, label: locationName(caught.location) }];
    const title = mon.isEgg ? 'Egg' : mon.nickname || speciesName(mon.species);
    // Turning a Pokémon into an egg is rare, so it sits at the bottom; on an egg it's the first thing, to hatch it.
    const eggRow = h('label', { class: 'check-row' },
      h('input', { type: 'checkbox', checked: mon.isEgg, onchange: (e: Event) => setEgg((e.target as HTMLInputElement).checked) }),
      h('span', {}, 'It’s an egg'),
      h('span', { class: 'muted' }, mon.isEgg ? ' Untick to hatch it now.' : ' The species is what will hatch.'));

    return [
      h('div', { class: 'mon-head' },
        h('div', { class: 'mon-id' },
          monIcon(mon, 'big'),
          h('div', {},
            h('h2', { id: 'mon-title' }, title, ' ', mon.isEgg ? null : genderMark(gender), shiny && !mon.isEgg ? shinyBadge() : null),
            h('p', { class: 'muted' }, mon.isEgg ? `Will hatch into ${speciesName(mon.species)}` : `#${String(mon.species).padStart(3, '0')} ${speciesName(mon.species)}`,
              mon.species === UNOWN && !mon.isEgg ? [' · ', h('span', { class: 'nowrap' }, `letter ${unownLetter(mon.dvs)}`)] : null),
            // on a narrow phone the level moves down beside the types (styles.css), so the name keeps its room
            h('div', { class: 'mon-head-meta' }, h('span', { class: 'lcd lv lv-inline' }, mon.isEgg ? 'Egg' : `Lv ${mon.level}`), typeChips(base)),
            (() => { const bar = monHpBar(mon, party, '', true); return bar ? h('div', { class: 'hp-row' }, h('span', { class: 'hp-label', 'aria-hidden': 'true' }, 'HP'), bar) : null; })())),
        h('span', { class: 'lcd lv' }, mon.isEgg ? 'Egg' : `Lv ${mon.level}`)),
      h('dl', { class: 'lcd stats six', 'aria-label': party ? 'Current stats' : 'Calculated stats' },
        keys.map((k) => h('div', {}, h('dt', {}, STAT_LABELS[k]), h('dd', {}, String(shown[k]))))),
      party || mon.isEgg ? null : h('p', { class: 'muted stats-note' }, 'Box Pokémon don’t store stats, so these are calculated from level, DVs and stat experience.'),

      mon.isEgg ? eggRow : null,

      h('div', { class: 'grid' },
        field(mon.isEgg ? 'Hatches into' : 'Species', selectInput(SPECIES_OPTIONS, mon.species, (v) => {
          const hadDefaultName = !mon.nickname || mon.nickname === defaultNickname(mon.species, mon.isEgg);
          mon.species = Number(v);
          if (hadDefaultName) mon.nickname = defaultNickname(mon.species, mon.isEgg);
          if (party) recalcPartyStats(mon, mon.isEgg);
          refresh();
        }), base ? undefined : 'Unknown species'),
        nameField('Nickname', mon.nickname, (v) => { mon.nickname = v; }, mon.isEgg ? 'Eggs are named EGG; it gets the species name when it hatches.' : undefined),
        field('Level', numberInput(mon.level, 1, 100, (v) => {
          mon.level = v;
          mon.exp = expAt(v);
          touched();
          refresh();
        }), mon.isEgg ? 'Eggs hatch at level 5.' : 'Changing the level also sets experience to match.'),
        field('Experience', numberInput(mon.exp, 0, 0xffffff, (v) => { mon.exp = v; })),
        party && !mon.isEgg ? field('Status', selectInput(statusOptions(mon.status), mon.status, (v) => { mon.status = Number(v); })) : null,
        party && !mon.isEgg ? field('Current HP', numberInput(mon.hp, 0, mon.maxHp, (v) => { mon.hp = v; refresh(); })) : null,
        mon.isEgg
          ? field('Egg cycles left', numberInput(mon.friendship, 0, 255, (v) => { mon.friendship = v; }),
            'Each cycle is 256 steps. At 0 it hatches on your next step.')
          : field('Friendship', numberInput(mon.friendship, 0, 255, (v) => { mon.friendship = v; })),
        h('div', { class: 'field' },
          h('span', { class: 'field-label' }, 'Held item'),
          h('div', { class: 'item-row bare' }, heldIcon, heldPicker),
          h('span', { class: 'field-hint' }, heldNote)),
        field('Pokérus', selectInput(POKERUS_OPTIONS, rus, (v) => {
          // Strain 1, which lasts 2 days; cured keeps the strain with no days left.
          mon.pokerus = v === 'none' ? 0 : v === 'cured' ? (mon.pokerus & 0xf0 || 0x10) : (mon.pokerus & 0x0f ? mon.pokerus : 0x12);
        })),
      ),

      h('h3', {}, mon.isEgg ? 'Moves it hatches with' : 'Moves'),
      h('div', { class: 'moves' }, [0, 1, 2, 3].map(moveRow)),

      mon.isEgg ? null : h('h3', {}, 'Looks'),
      mon.isEgg ? null : h('p', { class: 'muted section-note' }, 'In Gen 2, gender, shininess and Unown’s letter all come from the DVs, so these change the DVs below.'),
      mon.isEgg ? null : h('div', { class: 'grid' },
        hasTwoGenders(mon.species)
          ? field('Gender', selectInput([{ value: 'male', label: '♂ Male' }, { value: 'female', label: '♀ Female' }], gender, (v) => {
            setDvs({ ...mon.dvs, atk: attackDvForGender(mon.species, mon.dvs, v as 'male' | 'female') });
          }), 'Changes the Attack DV as little as it can.')
          : h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Gender'),
            h('output', { class: 'derived' }, gender === 'male' ? '♂ Always male' : gender === 'female' ? '♀ Always female' : 'None'), h('span', { class: 'field-hint' }, 'Fixed for this species.')),
        h('div', { class: 'field' },
          h('span', { class: 'field-label' }, 'Shiny'),
          h('label', { class: 'check-row shiny-toggle' },
            h('input', { type: 'checkbox', checked: shiny, onchange: () => setDvs(shiny ? { ...mon.dvs, spc: 11 } : shinyDvs(mon.dvs)) }),
            h('span', {}, shinyIcon(), ' Shiny')),
          h('span', { class: 'field-hint' }, 'Needs Defense, Speed and Special DVs of 10, so a shiny Pokémon can’t have top DVs.')),
        mon.species === UNOWN
          ? field('Unown letter', selectInput([...UNOWN_LETTERS].map((l) => ({ value: l, label: l })), unownLetter(mon.dvs),
            (v) => setDvs(dvsForUnownLetter(mon.dvs, v))), 'A shiny Unown can only be I or V.')
          : null,
      ),

      h('h3', {}, 'DVs (hidden genes)'),
      h('p', { class: 'muted section-note' }, '0 to 15, higher is better. HP’s DV is worked out from the other four, and Special covers Special Attack and Special Defense.'),
      h('div', { class: 'grid compact cols5' }, dvInputs, hpDvCell),
      h('h3', {}, 'Stat experience (EVs)'),
      h('p', { class: 'muted section-note' }, '0 to 65,535 for each stat. More raises the stat, and 65,535 is the most that counts.'),
      h('div', { class: 'grid compact cols5' }, evInputs),

      party && !mon.isEgg
        ? h('div', {},
          h('h3', {}, 'Battle stats'),
          h('p', { class: 'muted section-note' }, 'Saved with the Pokémon. They update when you change level, DVs or stat experience, and you can also type your own.'),
          h('div', { class: 'grid compact cols6' },
            field('Max HP', numberInput(mon.maxHp, 1, 999, (v) => { mon.maxHp = v; mon.hp = Math.min(mon.hp, v); refresh(); })),
            field('Attack', numberInput(mon.atk, 1, 999, (v) => { mon.atk = v; })),
            field('Defense', numberInput(mon.def, 1, 999, (v) => { mon.def = v; })),
            field('Sp. Atk', numberInput(mon.spa, 1, 999, (v) => { mon.spa = v; })),
            field('Sp. Def', numberInput(mon.spd, 1, 999, (v) => { mon.spd = v; })),
            field('Speed', numberInput(mon.spe, 1, 999, (v) => { mon.spe = v; })),
          ),
          calc ? h('p', { class: 'muted' },
            `For this level, DVs and stat experience the game works out: HP ${calc.hp}, Atk ${calc.atk}, Def ${calc.def}, SpA ${calc.spa}, SpD ${calc.spd}, Spe ${calc.spe}.`) : null,
        )
        : null,

      h('h3', {}, game === 'crystal' ? 'Original trainer and where it was caught' : 'Original trainer'),
      game === 'crystal' ? h('p', { class: 'muted section-note' }, 'Crystal writes the place, level and time down when a Pokémon is caught, hatched or given to you. One traded over from Gold or Silver has nothing recorded.') : null,
      h('div', { class: 'grid' },
        nameField('Original trainer', mon.otName, (v) => { mon.otName = v; }, undefined, 7),
        field('Original trainer ID', numberInput(mon.otId, 0, 65535, (v) => { mon.otId = v; }),
          'If this isn’t your Trainer ID, the game counts this Pokémon as traded.'),
        game === 'crystal' ? [
          field('Place', selectInput(locations, caught.location, (v) => setCaught({ location: Number(v) })), 'Gift and Event are what the game records for Pokémon it gives you.'),
          field('Level when caught', numberInput(caught.level, 0, CAUGHT_LEVEL_MAX, (v) => setCaught({ level: v })), 'Eggs record level 1.'),
          field('Time of day', selectInput(TIME_OPTIONS, caught.time ?? '', (v) => setCaught({ time: (v || null) as CaughtData['time'] }))),
          field('Caught by', selectInput([{ value: 'boy', label: 'A boy' }, { value: 'girl', label: 'A girl' }], caught.otGender,
            (v) => setCaught({ otGender: v === 'girl' ? 'girl' : 'boy' }))),
        ] : null,
      ),

      mon.isEgg ? null : eggRow,

      h('h3', {}, 'Shortcuts'),
      h('div', { class: 'button-row' },
        h('button', { onclick: () => setDvs({ atk: 15, def: 15, spe: 15, spc: 15 }) }, 'Max DVs'),
        h('button', { onclick: () => { mon.evs = { hp: 65535, atk: 65535, def: 65535, spe: 65535, spc: 65535 }; touched(); refresh(); } }, 'Max stat experience'),
        mon.isEgg ? null : h('button', { onclick: () => { mon.friendship = 255; refresh(); } }, 'Max friendship'),
        h('button', { onclick: () => { mon.exp = expAt(mon.level); refresh(); } }, 'Match exp to level'),
        h('button', { onclick: () => { mon.pp = mon.moves.map((m, i) => maxPp(m, mon.ppUps[i])) as Gen2Mon['pp']; refresh(); } }, 'Restore PP'),
        party && !mon.isEgg ? h('button', { onclick: () => { mon.status = 0; recalcPartyStats(mon, true); refresh(); } }, 'Heal and recalculate stats') : null,
      ),
      h('p', { class: 'muted section-note' }, 'Max DVs gives the best stats; on a species that can be either gender it also makes it male, and it is never shiny.'),
      h('div', { class: 'dialog-foot' },
        h('span', { class: 'muted' }, 'Done keeps your changes and the ✕ at the top throws them away. The file is only written when you tap Save on the main page.'),
        h('button', { class: 'primary', onclick: win.close }, 'Done'),
      ),
    ];
  }

  win.open();
}
