// The Pokémon window's frame, for every generation: the dialog, the ✕ that stays at its top right, and what closing does.
// Edits are applied to the Pokémon as they're made. Done keeps them. The ✕ (and Escape) throws them away: it puts the
// Pokémon back the way it was when the window opened, after asking if anything was changed.

import { askConfirm, clear, h } from './dom.ts';

export interface MonDialogSpec<M> {
  mon: M;
  /** The name the discard question uses. */
  label(mon: M): string;
  /** The window's contents, drawn again on every refresh. */
  render(): (Node | null)[];
  /** Called once the window has closed. `changed` is whether the Pokémon now differs from how it was when the window opened. */
  onDone(changed: boolean): void;
  /** Called just before onDone when the ✕ closes the window, so a Pokémon that was only just added can be taken back out. */
  onDiscard?(): void;
}

export interface MonDialog {
  /** Draw the contents again, keeping the scroll position. */
  refresh(): void;
  /** Close and keep the edits (Done). */
  close(): void;
  /** Show the window. */
  open(): void;
}

/** A comparable picture of a Pokémon (raw name and mail bytes included), to tell whether anything was edited. */
const fingerprint = (mon: unknown): string => JSON.stringify(mon, (_key, v) => (v instanceof Uint8Array ? Array.from(v) : v));

export function monDialog<M extends object>({ mon, label, render, onDone, onDiscard }: MonDialogSpec<M>): MonDialog {
  const dialog = h('dialog', { class: 'mon-dialog', 'aria-labelledby': 'mon-title' });
  const body = h('div', { class: 'dialog-body' });
  dialog.append(body);

  const original = structuredClone(mon);
  const originalPrint = fingerprint(mon);
  const changed = () => fingerprint(mon) !== originalPrint;
  let discarded = false;
  const discardAndClose = async () => {
    if (changed()) {
      if (!await askConfirm(`Discard your changes to ${label(original)}?`, 'Discard', 'Keep editing')) return;
      const target = mon as Record<string, unknown>;
      for (const key of Object.keys(target)) if (!(key in original)) delete target[key];
      Object.assign(mon, structuredClone(original));
    }
    discarded = true;
    dialog.close();
  };
  // Stays at the top right while the form scrolls, so leaving doesn't mean scrolling down to Done.
  const closeBar = h('div', { class: 'dialog-x-bar' },
    h('button', {
      class: 'dialog-x', type: 'button', title: 'Close without keeping changes', 'aria-label': 'Close without keeping changes',
      onclick: () => { void discardAndClose(); },
    }));

  let refreshing = false;
  const refresh = () => {
    if (refreshing) return;
    refreshing = true;
    try {
      const y = body.scrollTop;
      clear(body);
      body.append(closeBar, ...render().filter((n): n is Node => n !== null));
      body.scrollTop = y;
    } finally { refreshing = false; }
  };

  dialog.addEventListener('cancel', (e) => { e.preventDefault(); void discardAndClose(); });
  dialog.addEventListener('close', () => { dialog.remove(); if (discarded) onDiscard?.(); onDone(changed()); });
  return {
    refresh,
    close: () => dialog.close(),
    open: () => { document.body.append(dialog); refresh(); dialog.showModal(); },
  };
}
