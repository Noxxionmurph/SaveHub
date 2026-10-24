// A row of choices drawn like a line of the game's OPTION screen: every choice side by side, the chosen one marked
// with the menu cursor. Real radio buttons underneath, so the arrow keys, touch and screen readers all work.

import { h } from '../../dom.ts';

export interface Choice {
  value: string;
  label: string;
}

let rows = 0;

export function choiceRow(label: string, choices: Choice[], current: string, onChange: (value: string) => void): HTMLElement {
  const id = `opt-${++rows}`;
  return h('div', { class: 'opt-row', role: 'radiogroup', 'aria-labelledby': `${id}-label` },
    h('span', { class: 'opt-label', id: `${id}-label` }, label),
    h('div', { class: 'opt-choices' }, choices.map((c) => {
      const input = h('input', { type: 'radio', name: id, value: c.value, checked: c.value === current });
      input.addEventListener('change', () => { if (input.checked) onChange(c.value); });
      return h('label', { class: 'opt-choice' }, input, h('span', {}, c.label));
    })));
}
