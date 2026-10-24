// Pokémon type chips: the round type icon, plus the type's name when there's room for it.
import type { BaseStats } from '../../../core/gen1/data.ts';
import { h } from '../../dom.ts';
import { typeIcon } from '../../sprites.ts';

/**
 * `labels: false` shows icons only (for tight spots such as list cards); the name is still there for
 * screen readers and as a tooltip.
 */
export function typeChips(base: BaseStats | null, labels = true): HTMLElement {
  const types = base ? (base.type2 !== base.type1 ? [base.type1, base.type2] : [base.type1]) : [];
  return h('span', { class: 'mon-types' }, types.map((t) =>
    h('span', { class: labels ? 'type-chip' : 'type-chip bare', title: t },
      typeIcon(t),
      labels ? t : h('span', { class: 'sr-only' }, t))));
}
