// The action sheet for one Pokémon (see ui/monMenu.ts), with Gold, Silver and Crystal's rules from core/gen2/roster.ts.

import { baseStatsFor, speciesName } from '../../../core/gen2/data.ts';
import * as roster from '../../../core/gen2/roster.ts';
import type { Gen2Mon, Gen2Save } from '../../../core/gen2/save.ts';
import { openMonMenu as openSheet, type MonLook, type MonMenuOptions, type Roster } from '../../monMenu.ts';
import { typeChips } from '../../typeChip.ts';
import { monIcon, monLabel, shinyMark } from './monBits.ts';

const ROSTER: Roster<Gen2Save, Gen2Mon> = {
  ...roster,
  monAt: (s, where, index) => roster.listAt(s, where)[index],
  lastIndex: (s, where) => roster.listAt(s, where).length - 1,
};

const LOOK: MonLook<Gen2Mon> = {
  name: monLabel,
  icon: (mon) => monIcon(mon, 'big'),
  marks: shinyMark,
  species: (mon) => (mon.isEgg ? `Egg (${speciesName(mon.species)})` : speciesName(mon.species)),
  plain: (mon) => mon.isEgg,
  types: (mon) => typeChips(baseStatsFor(mon.species)),
  canEdit: () => true,
};

export const openMonMenu = (opts: MonMenuOptions<Gen2Save>): void => openSheet(ROSTER, LOOK, opts);
