// Pokémon type chips, colored by type.
import type { BaseStats } from '../../../core/gen1/data.ts';
import { h } from '../../dom.ts';

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#a8a77a', Fire: '#ee8130', Water: '#6390f0', Electric: '#f7d02c', Grass: '#7ac74c',
  Ice: '#96d9d6', Fighting: '#c22e28', Poison: '#a33ea1', Ground: '#e2bf65', Flying: '#a98ff3',
  Psychic: '#f95587', Bug: '#a6b91a', Rock: '#b6a136', Ghost: '#735797', Dragon: '#6f35fc',
};

/** Black or white text, whichever reads better on `hex`. */
function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1d2129' : '#ffffff';
}

export function typeChips(base: BaseStats | null): HTMLElement {
  const types = base ? (base.type2 !== base.type1 ? [base.type1, base.type2] : [base.type1]) : [];
  return h('span', { class: 'mon-types' }, types.map((t) => {
    const chip = h('span', { class: 'type-chip' }, t);
    const color = TYPE_COLORS[t] ?? '#888888';
    chip.style.background = color;
    chip.style.color = inkFor(color);
    return chip;
  }));
}
