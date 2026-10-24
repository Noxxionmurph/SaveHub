// The HP bar drawn the way the game draws it (see core/gen1/hp.ts for the rules): a short bar that fills with HP and
// goes green, yellow, then red.

import { HP_BAR_PIXELS, hpBarColour, hpBarPixels } from '../../../core/gen1/hp.ts';
import { calcStats, type Gen1Mon } from '../../../core/gen1/save.ts';
import { h } from '../../dom.ts';

/** The most HP this Pokémon can have: a party Pokémon stores it, a box Pokémon's is worked out. 0 if it can't be known. */
export function maxHpOf(mon: Gen1Mon, party: boolean): number {
  return party ? mon.maxHp : calcStats(mon.species, mon.level, mon.dvs, mon.evs)?.hp ?? 0;
}

/**
 * The bar. `meter` makes it readable to a screen reader on its own (the Pokémon window); in lists it is a picture,
 * since the HP is in the readout. Returns null when the maximum isn't known, so there is nothing to draw.
 */
export function hpBar(hp: number, maxHp: number, cls = '', meter = false): HTMLElement | null {
  if (!(maxHp > 0)) return null;
  const px = hpBarPixels(hp, maxHp);
  const bar = h('span', {
    class: `hp-bar hp-${hpBarColour(px)} ${cls}`.trim(),
    ...(meter
      ? { role: 'meter', 'aria-label': 'HP', 'aria-valuemin': 0, 'aria-valuemax': maxHp, 'aria-valuenow': Math.min(Math.max(hp, 0), maxHp) }
      : { 'aria-hidden': 'true' }),
    dataset: { px: String(px) },
  }, h('span', { class: 'hp-fill' }));
  bar.style.setProperty('--fill', `${((px / HP_BAR_PIXELS) * 100).toFixed(2)}%`);
  return bar;
}

/** The bar for a Pokémon in its current state. */
export const monHpBar = (mon: Gen1Mon, party: boolean, cls = '', meter = false): HTMLElement | null =>
  hpBar(mon.hp, maxHpOf(mon, party), cls, meter);
