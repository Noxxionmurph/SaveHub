// The HP bar drawn the way Ruby, Sapphire and Emerald draw it (see core/gen3/hp.ts for the rules, ui/hpBar.ts for the
// drawing).

import * as rules from '../../../core/gen3/hp.ts';
import { statsOf, type Gen3Mon } from '../../../core/gen3/save.ts';
import { drawHpBar } from '../../hpBar.ts';

/** The most HP this Pokémon can have: a party Pokémon stores it, a box Pokémon's is worked out. 0 if it can't be known. */
export const maxHpOf = (mon: Gen3Mon, party: boolean): number => statsOf(mon, party)?.hp ?? 0;

/** The bar for a Pokémon in its current state (none for an egg or a Bad Egg). A box Pokémon is shown at full HP. */
export const monHpBar = (mon: Gen3Mon, party: boolean, cls = '', meter = false): HTMLElement | null => {
  if (mon.isEgg || mon.bad) return null;
  const max = maxHpOf(mon, party);
  return drawHpBar(rules, party ? mon.hp : max, max, cls, meter);
};
