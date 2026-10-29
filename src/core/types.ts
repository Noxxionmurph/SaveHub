// The contract every supported game implements. The site shell only ever talks to these types,
// so adding a game (another Pokémon generation, Final Fantasy, Mega Man Battle Network, ...)
// never requires touching the shell.

/** One heading in the "review your changes" list, with a plain-language line per change. */
export interface ChangeGroup {
  title: string;
  lines: string[];
  /** How many further changes were left out to keep the list short. */
  more?: number;
}

/** One line of a save's summary, like a row of the game's own save window ("BADGES  3"). */
export interface SummaryLine {
  label: string;
  value: string;
}

/** An editable, in-memory model of one save file. */
export interface EditableSave {
  /** Produce a ready-to-write save file with every checksum recalculated. */
  serialize(): Uint8Array;
  /**
   * A few lines that say whose save this is and how far it has got (the rows the game shows when you save), for the top
   * of the review dialog. They describe the file as edited, so they are what will be written. Optional.
   */
  summary?(): SummaryLine[];
  /**
   * Plain-language list of what differs from `before` (a fresh load of the same file), for the review
   * dialog shown ahead of Save. Omit if a game can't describe its edits; the dialog then just confirms.
   */
  describeChanges?(before: EditableSave): ChangeGroup[];
  /**
   * A warning about the file as opened, shown above the editor: it failed its checks (opened from "Try opening anyway"),
   * or the game would load a backup copy instead. Null when it opened cleanly. Optional.
   */
  loadNote?(): string | null;
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
  /** One plain sentence on what the editor can change, shown under the family on the landing page. */
  readonly editable?: string;
  /**
   * Modules with the same shelf share one row of game tiles on the landing page, under the first one's `editable`
   * line (Gold / Silver and Crystal are two modules but one generation). Leave it out for a row of its own.
   */
  readonly shelf?: string;
  /** What a valid file looks like (size, extension), shown when a file isn't recognised, e.g. "Saves are 32,768 bytes." */
  readonly fileHint?: string;
  /** Optional cartridge-label color per game name (any CSS color), shown on the landing page. */
  readonly colors?: Readonly<Record<string, string>>;
  /**
   * Which handheld the page is styled as while this game's editor is open: 'gb' (the grey Game Boy with an olive screen,
   * the default), 'gbc' (the Game Boy Color, in teal) or 'gba' (the Game Boy Advance, in indigo). Colours (and, for
   * 'gba', the frame of the big readout windows); the layout is the same. See styles.css.
   */
  readonly theme?: 'gb' | 'gbc' | 'gba';
  /** Optional small picture per game name (a path inside the artwork, e.g. "sprites/pokemon/25.png"), shown on the landing page. */
  readonly icons?: Readonly<Record<string, string>>;
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
  /**
   * A made-up save for the "Try a sample save" button, so someone without a file can see the editor.
   * Built in code (no binary file shipped); load it lazily so it costs nothing until used.
   */
  sample?(): Promise<{ fileName: string; data: Uint8Array }>;
  /** Which of `games` the sample save is from, for its button ("Pokémon Yellow"). Omit to name them all. */
  readonly sampleGame?: string;
  /**
   * A few lines in the wording of this game's review list, shown on the landing page as an example of what
   * Save lists. The shell shows the first module that has one; `game` names which game the lines are from.
   */
  readonly demo?: { readonly game: string; readonly groups: readonly ChangeGroup[] };
  /**
   * Parse into an editable model. May throw with a user-readable message if the file is unusable. It may import the
   * save code when called, so the landing page needs only what `detect` uses.
   */
  load(data: Uint8Array): S | Promise<S>;
  /** Lazily import the editor UI, so visitors only download code for the game they open. */
  loadEditor(): Promise<MountEditor<S>>;
}

/** Type-erasing helper so differently-typed modules can live in one array. */
export function defineGame<S extends EditableSave>(game: GameModule<S>): GameModule {
  return game as unknown as GameModule;
}
