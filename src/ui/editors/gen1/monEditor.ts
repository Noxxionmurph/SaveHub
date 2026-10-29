// Pokémon editor dialog.

import {
  DEX_NAMES, DEX_TO_INTERNAL, INTERNAL_TO_DEX, MOVE_NAMES, baseStatsFor, expForLevel, growthOf, guessGrowth,
  speciesName,
} from '../../../core/gen1/data.ts';
import {
  applySpeciesTypes, calcStats, defaultNickname, hpDv, recalcPartyStats, type Gen1Mon,
} from '../../../core/gen1/save.ts';
import { askConfirm, clear, field, h, numberInput, selectInput } from '../../dom.ts';
import { maxPp, moveInfo } from '../../../core/gen1/moves.ts';
import { pokemonIcon, typeIcon } from '../../sprites.ts';
import { monHpBar } from './hpBar.ts';
import { nameField } from './nameField.ts';
import { typeChips } from '../../typeChip.ts';

const SPECIES_OPTIONS = DEX_NAMES.map((name, i) => ({
  value: DEX_TO_INTERNAL[i + 1],
  label: `#${String(i + 1).padStart(3, '0')} ${name}`,
}));
const MOVE_OPTIONS = MOVE_NAMES.map((name, i) => ({ value: i, label: i === 0 ? '— (none)' : name }));
const STAT_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', spe: 'Spe', spc: 'Spc' } as const;
const STATUS_OPTIONS = [
  { value: 0, label: 'Healthy' }, { value: 4, label: 'Asleep' }, { value: 8, label: 'Poisoned' },
  { value: 16, label: 'Burned' }, { value: 32, label: 'Frozen' }, { value: 64, label: 'Paralyzed' },
];

export interface MonEditorOptions {
  mon: Gen1Mon;
  party: boolean;
  /** Called once the window has closed. `changed` is whether the Pokémon now differs from how it was when the window opened. */
  onDone: (changed: boolean) => void;
  /** Called just before onDone when the ✕ closes the window, so a Pokémon that was only just added can be taken back out. */
  onDiscard?: () => void;
}

/** A comparable picture of a Pokémon (raw name bytes included), to tell whether anything was edited. */
const fingerprint = (mon: Gen1Mon): string => JSON.stringify(mon, (_key, v) => (v instanceof Uint8Array ? Array.from(v) : v));

export function openMonEditor({ mon, party, onDone, onDiscard }: MonEditorOptions): void {
  /** The experience a Pokémon of this species has at a level. The curve is fixed by the species; a glitch species is guessed once, on opening. */
  const guessed = guessGrowth(mon.level, mon.exp);
  const expAt = (level: number) => expForLevel(growthOf(mon.species, guessed), level);
  const dialog = h('dialog', { class: 'mon-dialog', 'aria-labelledby': 'mon-title' });
  const body = h('div', { class: 'dialog-body' });
  dialog.append(body);

  // Edits are applied to `mon` as they're made. Done keeps them. The X at the top right (and Escape) throws them
  // away: it puts the Pokémon back the way it was when this window opened, after asking if anything was changed.
  const original = structuredClone(mon);
  const originalPrint = fingerprint(mon);
  const changed = () => fingerprint(mon) !== originalPrint;
  let discarded = false;
  const discardAndClose = async () => {
    if (changed()) {
      const label = original.nickname || speciesName(original.species);
      if (!await askConfirm(`Discard your changes to ${label}?`, 'Discard', 'Keep editing')) return;
      const target = mon as unknown as Record<string, unknown>;
      for (const key of Object.keys(target)) if (!(key in original)) delete target[key];
      Object.assign(mon, structuredClone(original));
    }
    discarded = true;
    dialog.close();
  };
  // Stays at the top right while the form scrolls, so leaving doesn't mean scrolling down to Done.
  const closeBar = h('div', { class: 'dialog-x-bar' },
    h('button', {
      class: 'dialog-x', type: 'button', title: 'Close without keeping changes', 'aria-label': 'Close without keeping changes',
      onclick: () => { void discardAndClose(); },
    }));

  let refreshing = false;
  const refresh = () => {
    if (refreshing) return;
    refreshing = true;
    try { clear(body); body.append(closeBar, ...render().filter((n): n is Node => n !== null)); } finally { refreshing = false; }
  };
  const touched = () => { if (party) recalcPartyStats(mon); };

  function render(): (Node | null)[] {
    const base = baseStatsFor(mon.species);
    const calc = calcStats(mon.species, mon.level, mon.dvs, mon.evs);
    /** Current HP can't be more than the most the Pokémon has: its stored Max HP, or for a box Pokémon the one it will get. */
    const hpCap = party ? mon.maxHp : calc?.hp ?? 999;
    if (mon.hp > hpCap) mon.hp = hpCap;

    /**
     * One move: type icon and name on the first line; below, on one line, the current PP (read-only) with the
     * move's maximum, and a PP Up stepper. Each PP Up raises the maximum, and the current PP rises with it,
     * like using a PP Up in the game.
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
      field(STAT_LABELS[k], numberInput(mon.dvs[k], 0, 15, (v) => { mon.dvs[k] = v; touched(); refresh(); })));
    /** HP's DV isn't stored; the game works it out from the other four, so it's shown as a fifth, read-only box. */
    const hpDvCell = h('div', { class: 'field' },
      h('span', { class: 'field-label' }, 'HP'),
      h('output', { class: 'derived', 'aria-label': 'HP DV, worked out from the other four' }, String(hpDv(mon.dvs))));
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
            h('h2', { id: 'mon-title' }, mon.nickname || speciesName(mon.species)),
            h('p', { class: 'muted' }, dex ? `#${String(dex).padStart(3, '0')} ${speciesName(mon.species)}` : speciesName(mon.species)),
            // on a narrow phone the level moves down beside the types (styles.css), so the name keeps its room
            h('div', { class: 'mon-head-meta' }, h('span', { class: 'lcd lv lv-inline' }, `Lv ${mon.level}`), typeChips(base)),
            (() => { const bar = monHpBar(mon, party, '', true); return bar ? h('div', { class: 'hp-row' }, h('span', { class: 'hp-label', 'aria-hidden': 'true' }, 'HP'), bar) : null; })())),
        h('span', { class: 'lcd lv' }, `Lv ${mon.level}`)),
      h('dl', { class: 'lcd stats', 'aria-label': party ? 'Current stats' : 'Calculated stats' },
        (['hp', 'atk', 'def', 'spe', 'spc'] as const).map((k) =>
          h('div', {}, h('dt', {}, STAT_LABELS[k]), h('dd', {}, String(shown[k]))))),
      party ? null : h('p', { class: 'muted stats-note' }, 'Box Pokémon don’t store stats, so these are calculated from level, DVs and stat experience.'),
      h('div', { class: 'grid' },
        field('Species', selectInput(SPECIES_OPTIONS, mon.species, (v) => {
          const hadDefaultName = !mon.nickname || mon.nickname === defaultNickname(mon.species);
          mon.species = Number(v);
          if (hadDefaultName) mon.nickname = defaultNickname(mon.species);
          applySpeciesTypes(mon);
          touched();
          refresh();
        }), base ? undefined : 'Unknown species'),
        nameField('Nickname', mon.nickname, (v) => { mon.nickname = v; }),
        field('Level', numberInput(mon.level, 1, 100, (v) => {
          mon.level = v;
          mon.exp = expAt(v);
          touched();
          refresh();
        }), 'Changing the level also sets experience to match.'),
        field('Experience', numberInput(mon.exp, 0, 0xffffff, (v) => { mon.exp = v; })),
        field('Status', selectInput(STATUS_OPTIONS, STATUS_OPTIONS.some((s) => s.value === mon.status) ? mon.status : 0,
          (v) => { mon.status = Number(v); })),
        nameField('Original trainer', mon.otName, (v) => { mon.otName = v; }),
        field('Original trainer ID', numberInput(mon.otId, 0, 65535, (v) => { mon.otId = v; }),
          'If this isn’t your Trainer ID, the game counts this Pokémon as traded.'),
        field('Current HP', numberInput(Math.min(mon.hp, hpCap), 0, hpCap, (v) => { mon.hp = v; refresh(); })),
      ),

      h('h3', {}, 'Moves'),
      h('div', { class: 'moves' }, [0, 1, 2, 3].map(moveRow)),

      h('h3', {}, 'DVs (hidden genes)'),
      h('p', { class: 'muted section-note' }, '0 to 15, higher is better. HP’s DV is worked out from the other four.'),
      h('div', { class: 'grid compact cols5' }, dvInputs, hpDvCell),
      h('h3', {}, 'Stat experience (EVs)'),
      h('p', { class: 'muted section-note' }, '0 to 65,535 for each stat. More raises the stat, and 65,535 is the most that counts.'),
      h('div', { class: 'grid compact cols5' }, evInputs),

      party
        ? h('div', {},
          h('h3', {}, 'Battle stats'),
          h('p', { class: 'muted section-note' }, 'Saved with the Pokémon. They update when you change level, DVs or stat experience, and you can also type your own.'),
          h('div', { class: 'grid compact cols5' },
            field('Max HP', numberInput(mon.maxHp, 1, 999, (v) => { mon.maxHp = v; mon.hp = Math.min(mon.hp, v); refresh(); })),
            field('Attack', numberInput(mon.atk, 1, 999, (v) => { mon.atk = v; })),
            field('Defense', numberInput(mon.def, 1, 999, (v) => { mon.def = v; })),
            field('Speed', numberInput(mon.spe, 1, 999, (v) => { mon.spe = v; })),
            field('Special', numberInput(mon.spc, 1, 999, (v) => { mon.spc = v; })),
          ),
          calc ? h('p', { class: 'muted' },
            `For this level, DVs and stat experience the game works out: HP ${calc.hp}, Atk ${calc.atk}, Def ${calc.def}, Spe ${calc.spe}, Spc ${calc.spc}.`) : null,
        )
        : null,

      h('h3', {}, 'Shortcuts'),
      h('div', { class: 'button-row' },
        h('button', { onclick: () => { mon.dvs = { atk: 15, def: 15, spe: 15, spc: 15 }; touched(); refresh(); } }, 'Max DVs'),
        h('button', { onclick: () => { mon.evs = { hp: 65535, atk: 65535, def: 65535, spe: 65535, spc: 65535 }; touched(); refresh(); } }, 'Max stat experience'),
        h('button', { onclick: () => { mon.exp = expAt(mon.level); refresh(); } }, 'Match exp to level'),
        h('button', { onclick: () => { mon.pp = mon.moves.map((m, i) => maxPp(m, mon.ppUps[i])) as typeof mon.pp; refresh(); } }, 'Restore PP'),
        party ? h('button', { onclick: () => { recalcPartyStats(mon, true); refresh(); } }, 'Heal and recalculate stats') : null,
      ),
      h('div', { class: 'dialog-foot' },
        h('span', { class: 'muted' }, 'Done keeps your changes and the ✕ at the top throws them away. The file is only written when you tap Save on the main page.'),
        h('button', { class: 'primary', onclick: () => { dialog.close(); } }, 'Done'),
      ),
    ];
  }

  // Escape works like the ✕: it asks before throwing edits away, rather than closing and keeping them.
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); void discardAndClose(); });
  dialog.addEventListener('close', () => { dialog.remove(); if (discarded) onDiscard?.(); onDone(changed()); });
  document.body.append(dialog);
  refresh();
  dialog.showModal();
}
