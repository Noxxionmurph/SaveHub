// A row of choices drawn like a line of the game's OPTION screen: every choice side by side, the chosen one marked
// with the menu cursor. Real radio buttons underneath, so the arrow keys, touch and screen readers all work.

import { h } from './dom.ts';

export interface Choice {
  value: string;
  label: string;
}

let rows = 0;

/** `note` is a short line under the choices saying what the setting does. */
export function choiceRow(label: string, choices: Choice[], current: string, onChange: (value: string) => void, note?: string): HTMLElement {
  const id = `opt-${++rows}`;
  return h('div', { class: 'opt-row', role: 'radiogroup', 'aria-labelledby': `${id}-label`, 'aria-describedby': note ? `${id}-note` : undefined },
    h('span', { class: 'opt-label', id: `${id}-label` }, label),
    h('div', { class: 'opt-choices' }, choices.map((c) => {
      const input = h('input', { type: 'radio', name: id, value: c.value, checked: c.value === current });
      input.addEventListener('change', () => { if (input.checked) onChange(c.value); });
      return h('label', { class: 'opt-choice' }, input, h('span', {}, c.label));
    })),
    note ? h('p', { class: 'opt-note', id: `${id}-note` }, note) : null);
}

/**
 * A setting with many values, shown one at a time between arrows, like the game's own ◀ TYPE 1 ▶. Used where a row of
 * every choice would wrap onto several lines (Frame has eight).
 */
export function stepRow(label: string, choices: Choice[], current: string, onChange: (value: string) => void, note?: string): HTMLElement {
  const id = `opt-${++rows}`;
  let at = Math.max(0, choices.findIndex((c) => c.value === current));
  const value = h('output', { class: 'opt-value', 'aria-live': 'polite' }, choices[at].label);
  const step = (by: number) => {
    at = (at + by + choices.length) % choices.length;
    value.textContent = choices[at].label;
    onChange(choices[at].value);
  };
  return h('div', { class: 'opt-row', role: 'group', 'aria-labelledby': `${id}-label`, 'aria-describedby': note ? `${id}-note` : undefined },
    h('span', { class: 'opt-label', id: `${id}-label` }, label),
    h('div', { class: 'opt-choices opt-step' },
      h('button', { class: 'opt-arrow', 'aria-label': `Previous ${label.toLowerCase()}`, onclick: () => step(-1) }, '◀'),
      value,
      h('button', { class: 'opt-arrow', 'aria-label': `Next ${label.toLowerCase()}`, onclick: () => step(1) }, '▶')),
    note ? h('p', { class: 'opt-note', id: `${id}-note` }, note) : null);
}
