// The HP bar drawn the way Ruby, Sapphire and Emerald draw it (see core/gen3/hp.ts for the rules). Eggs have no HP.

import { HP_BAR_PIXELS, hpBarColour, hpBarPixels } from '../../../core/gen3/hp.ts';
import { statsOf, type Gen3Mon } from '../../../core/gen3/save.ts';
import { h } from '../../dom.ts';

/** The most HP this Pokémon can have: a party Pokémon stores it, a box Pokémon's is worked out. 0 if it can't be known. */
export const maxHpOf = (mon: Gen3Mon, party: boolean): number => statsOf(mon, party)?.hp ?? 0;

/** The bar. `meter` makes it readable to a screen reader on its own (the Pokémon window); in lists it is a picture. */
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

/** The bar for a Pokémon in its current state (none for an egg or a Bad Egg). A box Pokémon is shown at full HP. */
export const monHpBar = (mon: Gen3Mon, party: boolean, cls = '', meter = false): HTMLElement | null => {
  if (mon.isEgg || mon.bad) return null;
  const max = maxHpOf(mon, party);
  return hpBar(party ? mon.hp : max, max, cls, meter);
};
