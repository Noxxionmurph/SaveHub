// The contract every supported game implements. The site shell only ever talks to these types,
// so adding a game (another Pokémon generation, Final Fantasy, Mega Man Battle Network, ...)
// never requires touching the shell.

/** An editable, in-memory model of one save file. */
export interface EditableSave {
  /** Produce a ready-to-write save file with every checksum recalculated. */
  serialize(): Uint8Array;
}

export interface GameIdentity {
  /** One or more full game names from `games`. Exactly one means the file settled it. */
  names: readonly string[];
  /** Optional explanation shown under the name, e.g. why it can't be narrowed down. */
  note?: string;
}

export type Confidence = 'certain' | 'likely';

export interface Detection {
  /** "certain": structure + checksums all match. "likely": plausible but not conclusive. */
  confidence: Confidence;
  note?: string;
}

/** Handed to editors so they can tell the shell the save was modified (unsaved-changes guard). */
export interface EditorHost {
  markDirty(): void;
}

/** Renders an editor for `save` into `container`. */
export type MountEditor<S extends EditableSave = EditableSave> = (
  container: HTMLElement,
  save: S,
  host: EditorHost,
) => void;

export interface GameModule<S extends EditableSave = EditableSave> {
  /** Stable id, e.g. "pokemon-gen1". */
  readonly id: string;
  /** Series name used to group games on the landing page, e.g. "Pokémon". */
  readonly family: string;
  /**
   * Every exact game this module can open, with full names, e.g. ["Pokémon Red", "Pokémon Blue", "Pokémon Yellow"].
   * Shown on the landing page, and used as the candidates when a file can't say which version it is.
   */
  readonly games: readonly string[];
  /** Short platform/region note, e.g. "Game Boy · English". */
  readonly platform: string;
  /** Optional cartridge-label color per game name (any CSS color), shown on the landing page. */
  readonly colors?: Readonly<Record<string, string>>;
  /**
   * Cheap, side-effect-free structural check: file size, checksums, magic values, plausible fields.
   * Must never throw. Never rely on a file hash — saves change every time the game writes them.
   */
  detect(data: Uint8Array): Detection | null;
  /**
   * Work out exactly which of `games` a file is from, using whatever the format records (game code,
   * layout differences, ...). Return one name when certain; return several when the format simply
   * doesn't say (e.g. Red vs Blue are byte-identical), and the site will ask the user to confirm.
   * Omit to report all of `games`. Must never throw.
   */
  identify?(data: Uint8Array): GameIdentity;
  /** Parse into an editable model. May throw with a user-readable message if the file is unusable. */
  load(data: Uint8Array): S;
  /** Lazily import the editor UI, so visitors only download code for the game they open. */
  loadEditor(): Promise<MountEditor<S>>;
}

/** Type-erasing helper so differently-typed modules can live in one array. */
export function defineGame<S extends EditableSave>(game: GameModule<S>): GameModule {
  return game as unknown as GameModule;
}
