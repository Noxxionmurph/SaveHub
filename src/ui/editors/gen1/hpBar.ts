// The HP bar drawn the way the game draws it (see core/gen1/hp.ts for the rules, ui/hpBar.ts for the drawing).

import * as rules from '../../../core/gen1/hp.ts';
import { calcStats, type Gen1Mon } from '../../../core/gen1/save.ts';
import { drawHpBar } from '../../hpBar.ts';

/** The most HP this Pokémon can have: a party Pokémon stores it, a box Pokémon's is worked out. 0 if it can't be known. */
export function maxHpOf(mon: Gen1Mon, party: boolean): number {
  return party ? mon.maxHp : calcStats(mon.species, mon.level, mon.dvs, mon.evs)?.hp ?? 0;
}

/** The bar for a Pokémon in its current state. */
export const monHpBar = (mon: Gen1Mon, party: boolean, cls = '', meter = false): HTMLElement | null =>
  drawHpBar(rules, mon.hp, maxHpOf(mon, party), cls, meter);
