// Gen 1 (international) text encoding.

const TERMINATOR = 0x50;

const SYMBOLS: Record<number, string> = {
  0x7f: ' ', 0x9a: '(', 0x9b: ')', 0x9c: ':', 0x9d: ';', 0x9e: '[', 0x9f: ']', 0xba: 'é',
  0xe0: "'", 0xe3: '-', 0xe6: '?', 0xe7: '!', 0xe8: '.', 0xef: '♂', 0xf1: '×', 0xf3: '/', 0xf4: ',', 0xf5: '♀',
};

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
  for (const ch of text) if (!ENCODE.has(ch)) return false;
  return true;
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
  const chars = Array.from(text).slice(0, length - 1);
  let i = 0;
  for (const ch of chars) out[i++] = ENCODE.get(ch) ?? ENCODE.get('?')!;
  return out;
}

/** Characters the editor accepts in names, for UI hints. */
export const ALLOWED_CHARS = Array.from(ENCODE.keys()).join('');
