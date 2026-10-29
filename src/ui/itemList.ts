// One bag pocket (or the PC's item storage) as a card, for every generation: a row per item with its picture, a picker,
// a quantity and a Remove button, then an add button. Each editor says which items the pocket can hold.

import type { BagItem } from '../core/bytes.ts';
import { clear, h, lazySelect, numberInput, refocusAfterRemove } from './dom.ts';
import { itemIcon, itemIconUrl, setIconSrc } from './sprites.ts';

export interface ItemListSpec {
  title: string;
  /** The pocket's items, edited in place. */
  items: BagItem[];
  /** How many different items fit, and how many of one item. */
  slots: number;
  maxCount: number;
  /** The items the picker offers. One the file holds that isn't among them is added for its row. */
  options: { value: number; label: string }[];
  nameOf(id: number): string;
  spritePath(id: number): string;
  /** The item a new row starts as. */
  fresh(): number;
  /** Start a new row as an item the pocket doesn't hold yet, when `fresh()` is already there. */
  unique?: boolean;
  markDirty(): void;
}

export function itemList(spec: ItemListSpec): HTMLElement {
  const { title, items, slots, options } = spec;
  const wrap = h('section', { class: 'card' });
  const draw = () => {
    clear(wrap);
    wrap.append(
      h('h3', {}, title, h('span', { class: 'muted count' }, `${items.length}/${slots}`)),
      ...items.map((it, i) => {
        const icon = itemIcon(spec.spritePath(it.id));
        return h('div', { class: 'item-row' },
          icon,
          lazySelect(options.some((c) => c.value === it.id) ? options : [{ value: it.id, label: spec.nameOf(it.id) }, ...options],
            it.id, (v) => { it.id = Number(v); setIconSrc(icon, itemIconUrl(spec.spritePath(it.id))); spec.markDirty(); },
            { 'aria-label': `${title}, item ${i + 1}` }),
          numberInput(it.count, 1, Math.max(spec.maxCount, it.count), (v) => { it.count = v; spec.markDirty(); }, { 'aria-label': `Quantity of item ${i + 1}` }),
          h('button', {
            class: 'icon', 'aria-label': `Remove item ${i + 1}`,
            onclick: () => { items.splice(i, 1); spec.markDirty(); draw(); refocusAfterRemove(wrap, (n) => `Remove item ${n + 1}`, i); },
          }, '✕'),
        );
      }),
      h('button', {
        disabled: items.length >= slots,
        onclick: () => {
          const has = (id: number) => items.some((it) => it.id === id);
          const id = !spec.unique || !has(spec.fresh()) ? spec.fresh() : options.find((o) => !has(o.value))?.value ?? spec.fresh();
          items.push({ id, count: 1 });
          spec.markDirty(); draw();
        },
      }, items.length >= slots ? `Full (${slots} of ${slots})` : '+ Add item'),
    );
  };
  draw();
  return wrap;
}
