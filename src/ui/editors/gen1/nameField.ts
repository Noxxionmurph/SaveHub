import { nameProblems } from '../../../core/gen1/text.ts';
import { makeNameField, nameWarning as warningFor } from '../../nameField.ts';

/** The most characters the game keeps in a name (the field is 11 bytes, one of them the end marker). */
export const NAME_MAX = 10;

/** One line the field shows while the typed text can't be saved as typed; empty when it can. */
export const nameWarning = (text: string, max = NAME_MAX): string => warningFor(nameProblems, text, max);

/** A name field with Gen 1's text rules (see ui/nameField.ts). */
export const nameField = makeNameField(nameProblems, NAME_MAX);
