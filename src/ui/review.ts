// The "review your changes" dialog shown before Save: what will differ from the file the user opened.

import type { ChangeGroup } from '../core/types.ts';
import { h } from './dom.ts';

/**
 * Resolves true if the user chooses to save. `unlisted` means the bytes differ even though the game
 * had nothing to list (for example, checksums that get recalculated).
 */
export function askReview(groups: ChangeGroup[], unlisted: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const nothing = groups.length === 0 && !unlisted;
    const total = groups.reduce((n, g) => n + g.lines.length + (g.more ?? 0), 0);
    const list = groups.length
      ? h('div', { class: 'lcd review-list', tabIndex: 0, role: 'region', 'aria-label': 'Changes to save' },
        groups.map((g) => h('section', {},
          h('h3', {}, g.title),
          h('ul', {}, g.lines.map((l) => h('li', {}, l)), g.more ? h('li', { class: 'more' }, `…and ${g.more} more`) : null))))
      : null;

    const dlg = h('dialog', { class: 'review-dialog', 'aria-labelledby': 'review-title' },
      h('div', { class: 'dialog-body' },
        h('h2', { id: 'review-title' }, nothing ? 'No changes yet' : 'Review your changes'),
        h('p', { class: 'muted review-sub' }, nothing
          ? "You haven't edited anything, so saving gives you an identical copy."
          : `${total ? `${total} ${total === 1 ? 'change' : 'changes'}. ` : ''}Saving makes a new file. The one you opened isn't changed.`),
        list,
        !groups.length && unlisted
          ? h('p', { class: 'review-sub' }, 'Nothing you edited, but the file will be tidied up (for example, checksums are recalculated).')
          : null,
        h('div', { class: 'button-row end' },
          h('button', { onclick: () => dlg.close('no') }, nothing ? 'Cancel' : 'Keep editing'),
          h('button', { class: 'primary', onclick: () => dlg.close('yes') }, nothing ? 'Save anyway' : 'Save'))));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}
