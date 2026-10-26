import { field, h, textInput } from './dom.ts';

/** What a game's text encoding says about a name: characters it can't show, and how many characters are dropped. */
export type NameCheck = (text: string, max: number) => { unsupported: string[]; extra: number };

/** One line the field shows while the typed text can't be saved as typed; empty when it can. */
export function nameWarning(check: NameCheck, text: string, max: number): string {
  const { unsupported, extra } = check(text, max);
  const parts: string[] = [];
  if (unsupported.length) {
    const shown = unsupported.slice(0, 5).map((c) => `“${c}”`).join(' ');
    parts.push(`The game can’t show ${shown}${unsupported.length > 5 ? ' and others' : ''}. ${unsupported.length > 1 ? 'They are' : 'It is'} saved as “?”.`);
  }
  if (extra) parts.push(`Only the first ${max} characters are kept.`);
  return parts.join(' ');
}

/**
 * A text field for a name stored in the save, using one game's text rules (`check`). It keeps whatever is typed, and
 * shows a warning under the field when the game would change it on the way in (an unsupported character becomes "?",
 * extra characters are dropped). The PK and MN symbols are typed as {PK} and {MN}.
 */
export function makeNameField(check: NameCheck, defaultMax: number) {
  return (label: string, value: string, onChange: (v: string) => void, hint?: string, max = defaultMax): HTMLLabelElement => {
    const warn = h('span', { class: 'field-hint warn', role: 'status' });
    const paint = (text: string) => { warn.textContent = nameWarning(check, text, max); warn.hidden = !warn.textContent; };
    // No maxlength: {PK} is one character in the game but four to type, so the limit is checked in the game's units.
    const input = textInput(value, 4 * max, (v) => { paint(v); onChange(v); });
    paint(value);
    const el = field(label, input, hint);
    el.append(warn);
    return el;
  };
}
