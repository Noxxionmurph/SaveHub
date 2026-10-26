import { nameProblems } from '../../../core/gen2/text.ts';
import { PLAYER_NAME_MAX } from '../../../core/gen2/save.ts';
import { makeNameField } from '../../nameField.ts';

/** Nicknames and the rival's name hold 10 characters; the player's own name 7 (the naming screen stops there). */
export const NAME_MAX = 10;
export { PLAYER_NAME_MAX };

/** A name field with Gold and Silver's text rules (see ui/nameField.ts). */
export const nameField = makeNameField(nameProblems, NAME_MAX);
