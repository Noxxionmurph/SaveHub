// The HP bar drawn the way Gold and Silver draw it (see core/gen2/hp.ts for the rules, ui/hpBar.ts for the drawing).

import * as rules from '../../../core/gen2/hp.ts';
import { calcStats, type Gen2Mon } from '../../../core/gen2/save.ts';
import { drawHpBar } from '../../hpBar.ts';

/** The most HP this Pokémon can have: a party Pokémon stores it, a box Pokémon's is worked out. 0 if it can't be known. */
export function maxHpOf(mon: Gen2Mon, party: boolean): number {
  return party ? mon.maxHp : calcStats(mon.species, mon.level, mon.dvs, mon.evs)?.hp ?? 0;
}

/** The bar for a Pokémon in its current state (none for an egg). A box Pokémon is shown at full HP, as it comes out. */
export const monHpBar = (mon: Gen2Mon, party: boolean, cls = '', meter = false): HTMLElement | null => {
  if (mon.isEgg) return null;
  const max = maxHpOf(mon, party);
  return drawHpBar(rules, party ? mon.hp : max, max, cls, meter);
};
