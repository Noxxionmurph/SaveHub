// A Pokémon's types as the games label them: each type's name in its coloured box.
import { h } from './dom.ts';
import { typeLabel } from './sprites.ts';

/** One label per type (a single-type Pokémon gets one). The label carries the name, so no text sits beside it. */
export function typeChips(base: { type1: string; type2: string } | null): HTMLElement {
  const types = base ? (base.type2 !== base.type1 ? [base.type1, base.type2] : [base.type1]) : [];
  return h('span', { class: 'mon-types' }, types.map((t) => typeLabel(t)));
}
