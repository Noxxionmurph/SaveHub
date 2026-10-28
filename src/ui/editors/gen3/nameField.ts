import { nameProblems } from '../../../core/gen3/text.ts';
import { NICKNAME_MAX, PLAYER_NAME_MAX } from '../../../core/gen3/save.ts';
import { makeNameField } from '../../nameField.ts';

export { PLAYER_NAME_MAX };

/** A name field with Ruby, Sapphire and Emerald's text rules (see ui/nameField.ts). Nicknames hold 10 characters. */
export const nameField = makeNameField(nameProblems, NICKNAME_MAX);
