// Pokémon Yellow only: the starter Pikachu's friendship and mood, how it will react when you talk to it, and whether
// the game still counts it as yours.

import {
  FRIENDSHIP_EVENTS, MOOD_NEUTRAL, REACTIONS, REACTION_ROWS, friendshipLabel, moodLabel, pikachuReactionInfo,
} from '../../../core/gen1/data.ts';
import { PIKACHU_INTERNAL, type Gen1Mon, type Gen1Save } from '../../../core/gen1/save.ts';
import { clear, h, numberInput } from '../../dom.ts';
import { pikachuPic, pokemonIcon, setPikachuPic } from '../../sprites.ts';

export interface PikachuCardHost {
  markDirty(): void;
  /** Register a redraw that runs whenever another part of the Trainer tab changes (name, Trainer ID, party). */
  onRefresh(fn: () => void): void;
  monLabel(m: Gen1Mon): string;
}

const MOOD_COLUMNS = [
  { name: 'Upset', range: 'below 128' },
  { name: 'Neutral', range: '128' },
  { name: 'Cheerful', range: 'above 128' },
] as const;

const rowLabel = (r: { from: number; upTo: number }) => `${r.from}–${r.upTo}`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
/** Which of the three friendship columns in the rules table applies. */
const amountColumn = (friendship: number) => (friendship < 100 ? 0 : friendship < 200 ? 1 : 2);

export function pikachuCard(s: Gen1Save, host: PikachuCardHost): Node {
  // ---- the preview: what Pikachu does when you talk to it, at the friendship and mood set below ----
  const first = pikachuReactionInfo(s.pikachuFriendship, s.pikachuMood);
  const pic = pikachuPic(first.row, `Pikachu ${first.text}`, true);
  const says = h('p', { class: 'pika-says', 'aria-live': 'polite' });
  const context = h('p', { class: 'pika-context' });
  const preview = h('div', { class: 'pika-preview', role: 'group', 'aria-label': 'How Pikachu reacts when you talk to it' },
    h('div', { class: 'pika-screen' }, pic),
    h('div', { class: 'pika-text' }, h('span', { class: 'pika-kicker' }, 'Talk to it'), says, context));

  // ---- the chart of every reaction and the friendship rules: each is built the first time it is opened ----
  let cells: HTMLElement[][] = [];
  let rulesCells: HTMLElement[][] = [];

  const buildChart = (): HTMLElement => {
    cells = REACTION_ROWS.map((row) => [row.below, row.at, row.above].map((name) => {
      const r = REACTIONS[name];
      return h('td', {}, pikachuPic(r.row, ''), h('span', { class: 'pika-cap' }, r.short));
    }));
    return h('table', { class: 'pika-chart' },
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, 'Friendship')),
        MOOD_COLUMNS.map((c) => h('th', { scope: 'col' }, c.name, h('small', {}, c.range))))),
      h('tbody', {}, REACTION_ROWS.map((row, i) =>
        h('tr', {}, h('th', { scope: 'row' }, rowLabel(row)), cells[i]))));
  };

  const buildRules = (): HTMLElement => {
    rulesCells = [[], [], []];
    const ruleRow = (e: (typeof FRIENDSHIP_EVENTS)[number]) => h('tr', {}, h('th', { scope: 'row' }, e.what),
      e.amounts.map((n, col) => { const td = h('td', { class: n > 0 ? 'up' : n < 0 ? 'down' : '' }, signed(n)); rulesCells[col].push(td); return td; }));
    return h('table', { class: 'pika-rules' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'What happens'), ['0–99', '100–199', '200–255'].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', {},
        h('tr', { class: 'group' }, h('th', { colSpan: 4 }, 'Goes up')), FRIENDSHIP_EVENTS.filter((e) => e.up).map(ruleRow),
        h('tr', { class: 'group' }, h('th', { colSpan: 4 }, 'Goes down')), FRIENDSHIP_EVENTS.filter((e) => !e.up).map(ruleRow)));
  };

  /** A collapsed section whose table does not exist until someone opens it. */
  function lazyTable(summary: string, note: string | null, build: () => HTMLElement): HTMLElement {
    const box = h('details', { class: 'tips' }, h('summary', {}, summary), note ? h('p', { class: 'muted' }, note) : null);
    box.addEventListener('toggle', () => {
      if (!box.open || box.querySelector('table')) return;
      box.append(build());
      paintPreview();
    });
    return box;
  }

  function paintPreview(): void {
    const f = s.pikachuFriendship, m = s.pikachuMood;
    const now = pikachuReactionInfo(f, m);
    setPikachuPic(pic, now.row, `Pikachu ${now.text}`);
    says.textContent = `Pikachu ${now.text}.`;
    context.textContent = `Friendship ${f}, mood ${moodLabel(m).toLowerCase()}`;
    const row = REACTION_ROWS.findIndex((r) => f <= r.upTo);
    const col = m < MOOD_NEUTRAL ? 0 : m === MOOD_NEUTRAL ? 1 : 2;
    cells.forEach((rowCells, i) => rowCells.forEach((td, j) => {
      const on = i === row && j === col;
      td.classList.toggle('now', on);
      if (on) td.setAttribute('aria-current', 'true'); else td.removeAttribute('aria-current');
    }));
    rulesCells.forEach((col, j) => col.forEach((td) => td.classList.toggle('now', j === amountColumn(f))));
  }

  /** A 0 to 255 value shown as a big number and a label, with a slider and a number box that stay in step. */
  function dial(title: string, get: () => number, put: (v: number) => void, describe: (v: number) => string, extra = '') {
    const label = h('span', { class: 'friend-label' });
    const value = h('output', { class: 'friend-value', 'aria-label': title });
    const slider = h('input', { type: 'range', min: 0, max: 255, step: 1, value: String(get()), 'aria-label': title });
    const number = numberInput(get(), 0, 255, (v) => set(v), { 'aria-label': `${title} number` });
    const paint = () => { value.textContent = String(get()); label.textContent = describe(get()); };
    function set(v: number): void {
      put(v);
      slider.value = String(v);
      number.value = String(v);
      paint();
      paintPreview();
      host.markDirty();
    }
    slider.addEventListener('input', () => set(Number(slider.value)));
    paint();
    return {
      set,
      lcd: h('div', { class: `lcd friend ${extra}`.trim() }, h('span', { class: 'friend-head' }, title), value, label),
      controls: h('div', { class: 'friend-controls' }, slider, number),
    };
  }

  const friend = dial('Friendship', () => s.pikachuFriendship, (v) => { s.pikachuFriendship = v; }, friendshipLabel);
  const fade = h('p', { class: 'muted' });
  const mood = dial('Mood', () => s.pikachuMood, (v) => { s.pikachuMood = v; paintFade(); }, moodLabel, 'second');
  function paintFade(): void {
    const steps = Math.abs(s.pikachuMood - MOOD_NEUTRAL);
    fade.hidden = steps === 0;
    fade.textContent = `Walking pulls it back: neutral again after about ${steps} step${steps === 1 ? '' : 's'}.`;
  }

  // ---- whether the game still counts it as your starter ----
  const status = h('div', { class: 'starter-status', 'aria-live': 'polite' });
  const drawStatus = () => {
    clear(status);
    const at = s.party.findIndex((m) => s.isStarterPikachu(m));
    if (at >= 0) {
      status.append(h('p', {}, h('strong', {}, 'Starter Pikachu: '), `${host.monLabel(s.party[at])} (party ${at + 1})`));
      return;
    }
    const other = s.party.findIndex((m) => m.species === PIKACHU_INTERNAL);
    if (other < 0) {
      status.append(h('p', {}, h('strong', {}, 'No Pikachu in your party. '), 'Add one on the Party tab.'));
      return;
    }
    status.append(
      h('p', {}, h('strong', {}, 'Not your starter. '),
        `${host.monLabel(s.party[other])}’s original trainer isn’t you (name and Trainer ID), so it won’t follow you.`),
      h('button', { onclick: () => { s.makeStarter(s.party[other]); host.markDirty(); drawStatus(); } }, `Make ${host.monLabel(s.party[other])} my starter`));
  };
  host.onRefresh(drawStatus);

  paintFade();
  paintPreview();
  drawStatus();

  return h('section', { class: 'card pikachu-card' },
    h('div', { class: 'card-title' }, pokemonIcon(25, 'card-icon'), h('h3', {}, 'Pikachu')),
    preview,
    friend.lcd, friend.controls,
    h('div', { class: 'button-row' }, h('button', { onclick: () => friend.set(255) }, 'Max friendship')),
    h('p', { class: 'muted' }, '101 or more: Museum of Science hiker. 147 or more: Melanie’s Bulbasaur.'),
    mood.lcd, mood.controls,
    h('div', { class: 'button-row' },
      h('button', { onclick: () => mood.set(0) }, 'Upset'),
      h('button', { onclick: () => mood.set(MOOD_NEUTRAL) }, 'Neutral'),
      h('button', { onclick: () => mood.set(255) }, 'Cheerful')),
    fade,
    status,
    lazyTable('All of its reactions',
      'Not used when Pikachu is asleep, has a status condition, or you’re somewhere like Pokémon Tower.', buildChart),
    lazyTable('What raises and lowers friendship', null, buildRules));
}
