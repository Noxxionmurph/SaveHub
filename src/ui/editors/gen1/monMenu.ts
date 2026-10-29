// The action sheet for one Pokémon (see ui/monMenu.ts), with Red, Blue and Yellow's rules from core/gen1/roster.ts.

import { INTERNAL_TO_DEX, baseStatsFor, speciesName } from '../../../core/gen1/data.ts';
import * as roster from '../../../core/gen1/roster.ts';
import type { Gen1Mon, Gen1Save } from '../../../core/gen1/save.ts';
import { openMonMenu as openSheet, type MonLook, type MonMenuOptions, type Roster } from '../../monMenu.ts';
import { pokemonIcon } from '../../sprites.ts';
import { typeChips } from '../../typeChip.ts';

const ROSTER: Roster<Gen1Save, Gen1Mon> = {
  ...roster,
  monAt: (s, where, index) => roster.listAt(s, where)[index],
  // Gen 1 only asks that the party keeps one Pokémon.
  partyLeaveRefusal: (s) => (s.party.length <= 1 ? 'last-party' : null),
  lastIndex: (s, where) => roster.listAt(s, where).length - 1,
};

const LOOK: MonLook<Gen1Mon> = {
  name: (mon) => {
    const species = speciesName(mon.species);
    return mon.nickname && mon.nickname.toUpperCase() !== species.toUpperCase() ? mon.nickname : species;
  },
  icon: (mon) => pokemonIcon(INTERNAL_TO_DEX[mon.species], 'big'),
  marks: () => null,
  species: (mon) => speciesName(mon.species),
  plain: () => false,
  types: (mon) => typeChips(baseStatsFor(mon.species)),
  canEdit: () => true,
};

export const openMonMenu = (opts: MonMenuOptions<Gen1Save>): void => openSheet(ROSTER, LOOK, opts);
