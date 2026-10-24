// Pokémon editor dialog.

import {
  DEX_NAMES, DEX_TO_INTERNAL, GROWTH_RATES, INTERNAL_TO_DEX, MOVE_NAMES, baseStatsFor, expForLevel, guessGrowth,
  speciesName, type Growth,
} from '../../../core/gen1/data.ts';
import {
  applySpeciesTypes, calcStats, defaultNickname, hpDv, recalcPartyStats, type Gen1Mon,
} from '../../../core/gen1/save.ts';
import { clear, field, h, numberInput, selectInput, textInput } from '../../dom.ts';
import { maxPp, moveInfo } from '../../../core/gen1/moves.ts';
import { pokemonIcon, typeIcon } from '../../sprites.ts';
import { typeChips } from './typeChip.ts';

const SPECIES_OPTIONS = DEX_NAMES.map((name, i) => ({
  value: DEX_TO_INTERNAL[i + 1],
  label: `#${String(i + 1).padStart(3, '0')} ${name}`,
}));
const MOVE_OPTIONS = MOVE_NAMES.map((name, i) => ({ value: i, label: i === 0 ? '— (none)' : name }));
const STAT_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', spe: 'Spd', spc: 'Spc' } as const;
const STATUS_OPTIONS = [
  { value: 0, label: 'Healthy' }, { value: 4, label: 'Asleep' }, { value: 8, label: 'Poisoned' },
  { value: 16, label: 'Burned' }, { value: 32, label: 'Frozen' }, { value: 64, label: 'Paralyzed' },
];

export interface MonEditorOptions {
  mon: Gen1Mon;
  party: boolean;
  onDone: () => void;
}

export function openMonEditor({ mon, party, onDone }: MonEditorOptions): void {
  let growth: Growth = guessGrowth(mon.level, mon.exp);
  const dialog = h('dialog', { class: 'mon-dialog' });
  const body = h('div', { class: 'dialog-body' });
  dialog.append(body);

  let refreshing = false;
  const refresh = () => {
    if (refreshing) return;
    refreshing = true;
    try { clear(body); body.append(...render().filter((n): n is Node => n !== null)); } finally { refreshing = false; }
  };
  const touched = () => { if (party) recalcPartyStats(mon); };

  function render(): (Node | null)[] {
    const base = baseStatsFor(mon.species);
    const calc = calcStats(mon.species, mon.level, mon.dvs, mon.evs);

    /**
     * One move: type icon and name on the first line; below, the current PP (read-only) and a PP Up stepper
     * side by side, with the move's maximum PP centred underneath both. Each PP Up raises the maximum, and the
     * current PP rises with it, like using a PP Up in the game.
     */
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
            selectInput(MOVE_OPTIONS, id, (v) => {
              mon.moves[i] = Number(v);
              mon.pp[i] = maxPp(mon.moves[i], mon.ppUps[i]); // a newly picked move starts with full PP
              redraw();
            })),
          h('div', { class: 'field' },
            h('span', { class: 'field-label' }, 'PP'),
            h('output', { class: 'lcd pp-value', 'aria-label': 'PP' }, id ? String(mon.pp[i]) : '–')),
          h('div', { class: 'field' },
            h('span', { class: 'field-label' }, 'PP Up'),
            h('div', { class: 'stepper', role: 'group', 'aria-label': 'PP Up' },
              h('button', { class: 'icon', 'aria-label': 'Fewer PP Ups', disabled: !id || ups <= 0, onclick: () => setUps(ups - 1) }, '−'),
              h('output', { class: 'lcd stepper-value', 'aria-label': 'PP Ups used' }, id ? String(ups) : '–'),
              h('button', { class: 'icon', 'aria-label': 'More PP Ups', disabled: !id || ups >= 3, onclick: () => setUps(ups + 1) }, '+'))),
          h('p', { class: 'max-pp' }, id ? `Max PP: ${maxPp(id, ups)}` : ' '));
      };
      let row = build();
      return row;
    };

    const dvInputs = (['atk', 'def', 'spe', 'spc'] as const).map((k) =>
      field(STAT_LABELS[k], numberInput(mon.dvs[k], 0, 15, (v) => { mon.dvs[k] = v; touched(); refresh(); })));
    const evInputs = (['hp', 'atk', 'def', 'spe', 'spc'] as const).map((k) =>
      field(STAT_LABELS[k], numberInput(mon.evs[k], 0, 65535, (v) => { mon.evs[k] = v; touched(); refresh(); })));

    // LCD readout. Party Pokémon store their stats; box Pokémon don't, so those are calculated.
    const shown = party
      ? { hp: `${mon.hp}/${mon.maxHp}`, atk: mon.atk, def: mon.def, spe: mon.spe, spc: mon.spc }
      : calc ? { hp: calc.hp, atk: calc.atk, def: calc.def, spe: calc.spe, spc: calc.spc }
        : { hp: '—', atk: '—', def: '—', spe: '—', spc: '—' };
    const dex = INTERNAL_TO_DEX[mon.species];

    return [
      h('div', { class: 'mon-head' },
        h('div', { class: 'mon-id' },
          pokemonIcon(dex, 'big'),
          h('div', {},
            h('h2', {}, mon.nickname || speciesName(mon.species)),
            h('p', { class: 'muted' }, dex ? `#${String(dex).padStart(3, '0')} ${speciesName(mon.species)}` : speciesName(mon.species)),
            typeChips(base))),
        h('span', { class: 'lcd lv' }, `Lv ${mon.level}`)),
      h('dl', { class: 'lcd stats', 'aria-label': party ? 'Current stats' : 'Calculated stats' },
        (['hp', 'atk', 'def', 'spe', 'spc'] as const).map((k) =>
          h('div', {}, h('dt', {}, STAT_LABELS[k]), h('dd', {}, String(shown[k]))))),
      party ? null : h('p', { class: 'muted stats-note' }, 'Box Pokémon don’t store stats, so these are calculated from level, DVs and EVs.'),
      h('div', { class: 'grid' },
        field('Species', selectInput(SPECIES_OPTIONS, mon.species, (v) => {
          const hadDefaultName = !mon.nickname || mon.nickname === defaultNickname(mon.species);
          mon.species = Number(v);
          if (hadDefaultName) mon.nickname = defaultNickname(mon.species);
          applySpeciesTypes(mon);
          touched();
          refresh();
        }), base ? undefined : 'Unknown species'),
        field('Nickname', textInput(mon.nickname, 10, (v) => { mon.nickname = v; }), 'Up to 10 characters'),
        field('Level', numberInput(mon.level, 1, 100, (v) => {
          mon.level = v;
          mon.exp = expForLevel(growth, v);
          touched();
          refresh();
        }), 'Changing the level also sets experience to match.'),
        field('Growth rate', selectInput(GROWTH_RATES.map((g) => ({ value: g, label: g })), growth, (v) => {
          growth = v as Growth;
        }), 'How fast this Pokémon levels up. The save doesn’t store it, so this is a guess. Fix it if it’s wrong: it sets the experience when you change the level.'),
        field('Experience', numberInput(mon.exp, 0, 0xffffff, (v) => { mon.exp = v; }), 'Total experience points.'),
        field('Status', selectInput(STATUS_OPTIONS, STATUS_OPTIONS.some((s) => s.value === mon.status) ? mon.status : 0,
          (v) => { mon.status = Number(v); })),
        field('Original trainer', textInput(mon.otName, 10, (v) => { mon.otName = v; }), 'The name of whoever caught it.'),
        field('Original trainer ID', numberInput(mon.otId, 0, 65535, (v) => { mon.otId = v; }),
          'If this isn’t your Trainer ID, the game counts this Pokémon as traded.'),
        field('Current HP', numberInput(mon.hp, 0, 999, (v) => { mon.hp = v; })),
      ),

      h('h3', {}, 'Moves'),
      h('p', { class: 'muted section-note' }, 'Each PP Up (0 to 3) raises a move’s maximum PP, and its current PP with it. Picking a different move refills its PP.'),
      h('div', { class: 'moves' }, [0, 1, 2, 3].map(moveRow)),

      h('h3', {}, 'DVs (hidden genes)'),
      h('p', { class: 'muted section-note' }, 'Values from 0 to 15 that help decide the stats. Higher is better. HP’s DV is worked out from the other four.'),
      h('div', { class: 'grid compact' }, dvInputs, h('div', { class: 'readout' }, `HP DV: ${hpDv(mon.dvs)}`)),
      h('h3', {}, 'Stat experience (EVs)'),
      h('p', { class: 'muted section-note' }, 'Training points, 0 to 65,535 for each stat. More raises the stats, and 65,535 is the most that counts.'),
      h('div', { class: 'grid compact' }, evInputs),

      party
        ? h('div', {},
          h('h3', {}, 'Battle stats'),
          h('p', { class: 'muted section-note' }, 'Party Pokémon keep their battle stats in the save. They update when you change level, DVs or EVs, and you can also type your own.'),
          h('div', { class: 'grid compact' },
            field('Max HP', numberInput(mon.maxHp, 1, 999, (v) => { mon.maxHp = v; })),
            field('Attack', numberInput(mon.atk, 1, 999, (v) => { mon.atk = v; })),
            field('Defense', numberInput(mon.def, 1, 999, (v) => { mon.def = v; })),
            field('Speed', numberInput(mon.spe, 1, 999, (v) => { mon.spe = v; })),
            field('Special', numberInput(mon.spc, 1, 999, (v) => { mon.spc = v; })),
          ),
          calc ? h('p', { class: 'muted' },
            `For this level, DVs and EVs the game works out: HP ${calc.hp}, Atk ${calc.atk}, Def ${calc.def}, Spd ${calc.spe}, Spc ${calc.spc}.`) : null,
        )
        : null,

      h('h3', {}, 'Shortcuts'),
      h('div', { class: 'button-row' },
        h('button', { onclick: () => { mon.dvs = { atk: 15, def: 15, spe: 15, spc: 15 }; touched(); refresh(); } }, 'Max DVs'),
        h('button', { onclick: () => { mon.evs = { hp: 65535, atk: 65535, def: 65535, spe: 65535, spc: 65535 }; touched(); refresh(); } }, 'Max EVs'),
        h('button', { onclick: () => { mon.exp = expForLevel(growth, mon.level); refresh(); } }, 'Match exp to level'),
        h('button', { onclick: () => { mon.pp = mon.moves.map((m, i) => maxPp(m, mon.ppUps[i])) as typeof mon.pp; refresh(); } }, 'Restore PP'),
        party ? h('button', { onclick: () => { recalcPartyStats(mon, true); refresh(); } }, 'Heal and recalculate stats') : null,
      ),
      h('p', { class: 'muted section-note' },
        party ? 'Match exp to level sets experience to the lowest amount for the current level. Heal and recalculate stats refills HP and rebuilds the battle stats.'
          : 'Match exp to level sets experience to the lowest amount for the current level.'),
      h('div', { class: 'dialog-foot' },
        h('span', { class: 'muted' }, 'Changes apply as you edit. Tap Save on the main page to write the file.'),
        h('button', { class: 'primary', onclick: () => { dialog.close(); } }, 'Done'),
      ),
    ];
  }

  dialog.addEventListener('close', () => { dialog.remove(); onDone(); });
  document.body.append(dialog);
  refresh();
  dialog.showModal();
}
