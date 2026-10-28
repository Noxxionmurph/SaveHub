// Small pieces every Ruby / Sapphire / Emerald Pokémon list shares: its icon (an egg, or Unown's own form), its gender
// sign and the name to show. The gender sign and shiny sparkles are the Gen 2 editor's.

import { UNOWN, isShiny, speciesName, unownForm } from '../../../core/gen3/data.ts';
import type { Gen3Mon } from '../../../core/gen3/save.ts';
import { h } from '../../dom.ts';
import { eggIcon, itemIcon, pokemonIcon } from '../../sprites.ts';
import { shinyBadge } from '../gen2/monBits.ts';
import { itemSpritePath } from './itemSprites.ts';

export { genderMark, shinyBadge } from '../gen2/monBits.ts';

const FORM_FILE: Record<string, string> = { '!': 'exclamation', '?': 'question' };

/** Unown's form as its icon's file suffix ('' for A). */
const unownFile = (pid: number): string => { const f = unownForm(pid); return f === 'A' ? '' : FORM_FILE[f] ?? f.toLowerCase(); };

/** The box icon: an egg for an egg (or a Bad Egg), Unown in its form, otherwise the species, shiny if it's shiny. */
export function monIcon(mon: Gen3Mon, cls = ''): HTMLElement {
  if (mon.isEgg || mon.bad) return eggIcon(cls);
  return pokemonIcon(mon.species, cls, mon.species === UNOWN ? unownFile(mon.pid) : '', isShiny(mon.otId, mon.pid));
}

/** The picture with any held item just right of it. Hovering the item shows its name; screen readers get the same words. */
export function monPic(mon: Gen3Mon, itemName: (id: number) => string): HTMLElement {
  return h('span', { class: 'mon-pic' }, monIcon(mon),
    mon.item && !mon.bad ? h('span', { class: 'held', dataset: { name: itemName(mon.item) } }, itemIcon(itemSpritePath(mon.item)),
      h('span', { class: 'sr-only' }, `Holding ${itemName(mon.item)}`)) : null);
}

/** The shiny sparkles for a shiny Pokémon (eggs don't show them until they hatch). */
export const shinyMark = (mon: Gen3Mon): HTMLElement | null =>
  (!mon.isEgg && !mon.bad && isShiny(mon.otId, mon.pid) ? shinyBadge() : null);

/** The name a list shows: the nickname when it differs from the species name, "Egg" for an egg. */
export function monLabel(mon: Gen3Mon): string {
  if (mon.bad) return 'Bad Egg';
  if (mon.isEgg) return 'Egg';
  const name = speciesName(mon.species);
  return mon.nickname && mon.nickname.toLowerCase() !== name.toLowerCase() ? mon.nickname : name;
}
