// Gen 1 (international) text encoding.

const TERMINATOR = 0x50;

const SYMBOLS: Record<number, string> = {
  0x7f: ' ', 0x9a: '(', 0x9b: ')', 0x9c: ':', 0x9d: ';', 0x9e: '[', 0x9f: ']', 0xba: 'é',
  0x5d: '{TRAINER}', 0xe0: "'", 0xe1: '{PK}', 0xe2: '{MN}', 0xe3: '-', 0xe6: '?', 0xe7: '!', 0xe8: '.', 0xef: '♂', 0xf1: '×', 0xf3: '/', 0xf4: ',', 0xf5: '♀',
};

// The game's "PK" and "MN" symbols, and the "TRAINER" text it uses as the original trainer of some Pokémon (byte 0x5D),
// are one character each. Written as {PK}, {MN} and {TRAINER} so they can be typed, shown and saved back without
// confusing them with ordinary letters.
const TOKEN = /\{PK\}|\{MN\}|\{TRAINER\}|[^]/gu;
const units = (text: string): string[] => text.match(TOKEN) ?? [];

const DECODE = new Map<number, string>();
for (let i = 0; i < 26; i++) {
  DECODE.set(0x80 + i, String.fromCharCode(65 + i));
  DECODE.set(0xa0 + i, String.fromCharCode(97 + i));
}
for (let i = 0; i < 10; i++) DECODE.set(0xf6 + i, String(i));
for (const [k, v] of Object.entries(SYMBOLS)) DECODE.set(Number(k), v);

const ENCODE = new Map<string, number>();
for (const [byte, ch] of DECODE) ENCODE.set(ch, byte);

/** Decode a fixed-length name field (stops at the 0x50 terminator). */
export function decodeText(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    if (b === TERMINATOR) break;
    out += DECODE.get(b) ?? '?';
  }
  return out;
}

export function isEncodable(text: string): boolean {
  return units(text).every((ch) => ENCODE.has(ch));
}

/**
 * What would go wrong if `text` were saved as a name of at most `max` characters: the distinct characters the game
 * can't show (each is saved as "?"), and how many characters past `max` are dropped.
 */
export function nameProblems(text: string, max: number): { unsupported: string[]; extra: number } {
  const u = units(text);
  return { unsupported: [...new Set(u.filter((ch) => !ENCODE.has(ch)))], extra: Math.max(0, u.length - max) };
}

/**
 * Encode `text` into a `length`-byte field (terminator + 0x00 padding).
 * If `original` still decodes to `text`, its exact bytes are kept so unrecognised
 * characters in an untouched name are never corrupted.
 */
export function encodeText(text: string, length: number, original?: Uint8Array): Uint8Array {
  if (original && original.length === length && decodeText(original) === text) return original.slice();
  // The game pads names with terminator bytes, so do the same.
  const out = new Uint8Array(length).fill(TERMINATOR);
  const chars = units(text).slice(0, length - 1);
  let i = 0;
  for (const ch of chars) out[i++] = ENCODE.get(ch) ?? ENCODE.get('?')!;
  return out;
}

/** What the editor accepts in names, for UI hints: letters, digits, some punctuation, and {PK} / {MN}. */
export const ALLOWED_CHARS = Array.from(ENCODE.keys()).join('');
