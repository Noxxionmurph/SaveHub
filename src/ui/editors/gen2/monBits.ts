// Small pieces every Gold / Silver Pokémon list shares: its icon (an egg, or Unown's own letter), its gender sign and
// the name to show.

import { UNOWN, isShiny, speciesName, unownLetter, type Gender } from '../../../core/gen2/data.ts';
import type { Gen2Mon } from '../../../core/gen2/save.ts';
import { h } from '../../dom.ts';
import { eggIcon, itemIcon, pokemonIcon, shinyIcon } from '../../sprites.ts';
import { itemSpritePath } from './itemSprites.ts';

/** The box icon: an egg for an egg, Unown in its letter, otherwise the species, in its shiny colours if it's shiny. */
export function monIcon(mon: Gen2Mon, cls = ''): HTMLElement {
  if (mon.isEgg) return eggIcon(cls);
  const form = mon.species === UNOWN ? unownLetter(mon.dvs).toLowerCase() : '';
  return pokemonIcon(mon.species <= 251 ? mon.species : 0, cls, form === 'a' ? '' : form, isShiny(mon.dvs));
}

/** The picture with any held item on its corner, as on the games' party screens. Hovering the item shows its name in a
 * bubble (styles.css); screen readers get the same words. */
export function monPic(mon: Gen2Mon, itemName: (id: number) => string): HTMLElement {
  return h('span', { class: 'mon-pic' }, monIcon(mon),
    mon.item ? h('span', { class: 'held', dataset: { name: itemName(mon.item) } }, itemIcon(itemSpritePath(mon.item)),
      h('span', { class: 'sr-only' }, `Holding ${itemName(mon.item)}`)) : null);
}

/** ♂ or ♀ in the game's colours, or nothing for a genderless Pokémon. */
export function genderMark(g: Gender): HTMLElement | null {
  if (g === 'none') return null;
  return h('span', { class: `gender ${g}`, title: g === 'male' ? 'Male' : 'Female' }, g === 'male' ? '♂' : '♀',
    h('span', { class: 'sr-only' }, g === 'male' ? 'Male' : 'Female'));
}

/** The shiny sparkles, labelled for screen readers. */
export const shinyBadge = (): HTMLElement => h('span', { class: 'shiny-star', title: 'Shiny' }, shinyIcon(), h('span', { class: 'sr-only' }, 'Shiny'));

/** The shiny sparkles for a shiny Pokémon (eggs don't show them until they hatch). */
export const shinyMark = (mon: Gen2Mon): HTMLElement | null => (!mon.isEgg && isShiny(mon.dvs) ? shinyBadge() : null);

/** The name a list shows: the nickname when it differs from the species name, "Egg" for an egg. */
export function monLabel(mon: Gen2Mon): string {
  if (mon.isEgg) return 'Egg';
  const name = speciesName(mon.species);
  return mon.nickname && mon.nickname.toLowerCase() !== name.toLowerCase() ? mon.nickname : name;
}
