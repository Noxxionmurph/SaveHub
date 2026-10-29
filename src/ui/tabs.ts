// The tab bar every editor uses, and the panel under it. Picking a tab redraws the editor, which removes the
// button that had focus, so focus is put back on the new tab's button. Arrow keys, Home and End move between tabs.
import { h } from './dom.ts';

export interface TabDef<T extends string> { id: T; label: string }

const tabId = (id: string) => `tab-${id}`;

export function tabBar<T extends string>(tabs: readonly TabDef<T>[], current: T, pick: (id: T) => void): HTMLElement {
  const go = (id: T) => {
    pick(id);
    document.getElementById(tabId(id))?.focus();
  };
  const nav = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Editor sections' }, tabs.map((t) =>
    h('button', {
      id: tabId(t.id), role: 'tab', class: t.id === current ? 'tab active' : 'tab', 'aria-selected': String(t.id === current),
      'aria-controls': 'tab-panel', tabIndex: t.id === current ? 0 : -1,
      onclick: () => go(t.id),
    }, t.label)));
  nav.addEventListener('keydown', (e) => {
    const at = tabs.findIndex((t) => t.id === current);
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    go(tabs[(to + tabs.length) % tabs.length].id);
  });
  return nav;
}

/** The panel for the current tab, named after it (a heading for screen readers, since the cards inside use h3). */
export function tabPanel<T extends string>(tabs: readonly TabDef<T>[], current: T, content: Node): HTMLElement {
  const label = tabs.find((t) => t.id === current)?.label ?? '';
  return h('div', { class: 'panel', id: 'tab-panel', role: 'tabpanel', 'aria-labelledby': tabId(current) },
    h('h2', { class: 'sr-only' }, label), content);
}
