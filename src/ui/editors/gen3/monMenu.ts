// The action sheet for one Pokémon (see ui/monMenu.ts), with Ruby, Sapphire and Emerald's rules from core/gen3/roster.ts.

import { baseStatsFor, speciesName } from '../../../core/gen3/data.ts';
import * as roster from '../../../core/gen3/roster.ts';
import type { Gen3Mon, Gen3Save } from '../../../core/gen3/save.ts';
import { openMonMenu as openSheet, type MonLook, type MonMenuOptions, type Roster } from '../../monMenu.ts';
import { typeChips } from '../../typeChip.ts';
import { monIcon, monLabel, shinyMark } from './monBits.ts';

const ROSTER: Roster<Gen3Save, Gen3Mon> = {
  ...roster,
  // Boxes keep their gaps, so a box Pokémon can move down to the box's last slot.
  lastIndex: (s, where) => (where === roster.PARTY ? s.party.length - 1 : roster.capacityOf(where) - 1),
};

const LOOK: MonLook<Gen3Mon> = {
  name: monLabel,
  icon: (mon) => monIcon(mon, 'big'),
  marks: shinyMark,
  species: (mon) => (mon.bad ? 'Bad Egg' : mon.isEgg ? `Egg (${speciesName(mon.species)})` : speciesName(mon.species)),
  plain: (mon) => mon.isEgg || Boolean(mon.bad),
  types: (mon) => typeChips(baseStatsFor(mon.species)),
  canEdit: (mon) => !mon.bad,
};

export const openMonMenu = (opts: MonMenuOptions<Gen3Save>): void => openSheet(ROSTER, LOOK, opts);
