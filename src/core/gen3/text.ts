// Gen 3 (Ruby / Sapphire / Emerald, English) text encoding, from pokeemerald's charmap.txt. Letters, digits and the
// common punctuation sit in 0xA1-0xF6, accented letters low down; 0xFF ends a name. The {PK} and {MN} symbols are one
// character each, as in Gen 2.

const TERMINATOR = 0xff;

const SYMBOLS: Record<number, string> = {
  0x00: ' ', 0x01: 'À', 0x02: 'Á', 0x03: 'Â', 0x04: 'Ç', 0x05: 'È', 0x06: 'É', 0x07: 'Ê', 0x08: 'Ë', 0x09: 'Ì', 0x0b: 'Î',
  0x0c: 'Ï', 0x0d: 'Ò', 0x0e: 'Ó', 0x0f: 'Ô', 0x10: 'Œ', 0x11: 'Ù', 0x12: 'Ú', 0x13: 'Û', 0x14: 'Ñ', 0x15: 'ß', 0x16: 'à',
  0x17: 'á', 0x19: 'ç', 0x1a: 'è', 0x1b: 'é', 0x1c: 'ê', 0x1d: 'ë', 0x1e: 'ì', 0x20: 'î', 0x21: 'ï', 0x22: 'ò', 0x23: 'ó',
  0x24: 'ô', 0x25: 'œ', 0x26: 'ù', 0x27: 'ú', 0x28: 'û', 0x29: 'ñ', 0x2a: 'º', 0x2b: 'ª', 0x2d: '&', 0x2e: '+', 0x35: '=',
  0x36: ';', 0x51: '¿', 0x52: '¡', 0x53: '{PK}', 0x54: '{MN}', 0x5a: 'Í', 0x5b: '%', 0x5c: '(', 0x5d: ')', 0x68: 'â', 0x6f: 'í',
  0x85: '<', 0x86: '>', 0xab: '!', 0xac: '?', 0xad: '.', 0xae: '-', 0xaf: '·', 0xb0: '…', 0xb1: '“', 0xb2: '”', 0xb3: '‘',
  0xb4: '’', 0xb5: '♂', 0xb6: '♀', 0xb7: '¥', 0xb8: ',', 0xb9: '×', 0xba: '/', 0xf0: ':', 0xf1: 'Ä', 0xf2: 'Ö', 0xf3: 'Ü',
  0xf4: 'ä', 0xf5: 'ö', 0xf6: 'ü',
};

const TOKEN = /\{PK\}|\{MN\}|[^]/gu;
const units = (text: string): string[] => text.match(TOKEN) ?? [];

const DECODE = new Map<number, string>();
for (let i = 0; i < 26; i++) {
  DECODE.set(0xbb + i, String.fromCharCode(65 + i));
  DECODE.set(0xd5 + i, String.fromCharCode(97 + i));
}
for (let i = 0; i < 10; i++) DECODE.set(0xa1 + i, String(i));
for (const [k, v] of Object.entries(SYMBOLS)) DECODE.set(Number(k), v);

const ENCODE = new Map<string, number>();
for (const [byte, ch] of DECODE) ENCODE.set(ch, byte);
// The straight apostrophe is typed far more often than the curly one the game uses.
ENCODE.set("'", 0xb4);

/** Decode a fixed-length name field (stops at the 0xFF terminator, or at the end of a full-length name). */
export function decodeText(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    if (b === TERMINATOR) break;
    out += DECODE.get(b) ?? '?';
  }
  return out;
}

/** What would go wrong saving `text` as a name of at most `max` characters (see ui/nameField.ts). */
export function nameProblems(text: string, max: number): { unsupported: string[]; extra: number } {
  const u = units(text);
  return { unsupported: [...new Set(u.filter((ch) => !ENCODE.has(ch)))], extra: Math.max(0, u.length - max) };
}

/** A name as the game will hold it: at most `max` characters, and "?" for each one it can't show. */
export function asSaved(text: string, max: number): string {
  return units(text).slice(0, max).map((ch) => (ENCODE.has(ch) ? ch : '?')).join('');
}

/**
 * Encode `text` into a `length`-byte field: the characters, then the terminator and `pad` after it (the game fills
 * the rest with 0xFF). A name that fills the whole field has no terminator, as the game writes a 10-letter nickname.
 * If `original` still decodes to `text`, its exact bytes are kept, so an untouched name is never changed.
 */
export function encodeText(text: string, length: number, original?: Uint8Array, max = length, pad = TERMINATOR): Uint8Array {
  if (original && original.length === length && decodeText(original) === text) return original.slice();
  const out = new Uint8Array(length).fill(pad);
  const chars = units(text).slice(0, Math.min(max, length));
  chars.forEach((ch, i) => { out[i] = ENCODE.get(ch) ?? ENCODE.get('?')!; });
  if (chars.length < length) out[chars.length] = TERMINATOR;
  return out;
}
