// Gen 2 (Gold / Silver, English) text encoding. Close to Gen 1's, with more punctuation: é moves to 0xEA, and & and the
// 'd 'l 'm 'r 's 't 'v characters (one byte each) are new. Checked against pokegold's constants/charmap.asm and the
// characters its naming screens offer (data/text/name_input_chars.asm).

const TERMINATOR = 0x50;

const SYMBOLS: Record<number, string> = {
  0x7f: ' ', 0x9a: '(', 0x9b: ')', 0x9c: ':', 0x9d: ';', 0x9e: '[', 0x9f: ']',
  0x5d: '{TRAINER}', 0xd0: "'d", 0xd1: "'l", 0xd2: "'m", 0xd3: "'r", 0xd4: "'s", 0xd5: "'t", 0xd6: "'v",
  0xe0: "'", 0xe1: '{PK}', 0xe2: '{MN}', 0xe3: '-', 0xe6: '?', 0xe7: '!', 0xe8: '.', 0xe9: '&', 0xea: 'é',
  0xef: '♂', 0xf1: '×', 0xf3: '/', 0xf4: ',', 0xf5: '♀',
};

// {PK}, {MN} and {TRAINER} are one character each in the game, and so are 'd ... 'v. The tokenizer reads them as one
// unit so that a name decodes and encodes back to the same bytes.
const TOKEN = /\{PK\}|\{MN\}|\{TRAINER\}|'[dlmrstv]|[^]/gu;
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

/**
 * What would go wrong if `text` were saved as a name of at most `max` characters: the distinct characters the game
 * can't show (each is saved as "?"), and how many characters past `max` are dropped.
 */
export function nameProblems(text: string, max: number): { unsupported: string[]; extra: number } {
  const u = units(text);
  return { unsupported: [...new Set(u.filter((ch) => !ENCODE.has(ch)))], extra: Math.max(0, u.length - max) };
}

/**
 * Encode `text` into a `length`-byte field: the characters, the terminator, then `pad` (the game pads nicknames with
 * more terminators, and trainer and box names with zeros). If `original` still decodes to `text`, its exact bytes
 * are kept, so an untouched name is never changed.
 */
export function encodeText(text: string, length: number, original?: Uint8Array, pad = TERMINATOR): Uint8Array {
  if (original && original.length === length && decodeText(original) === text) return original.slice();
  const out = new Uint8Array(length).fill(pad);
  const chars = units(text).slice(0, length - 1);
  chars.forEach((ch, i) => { out[i] = ENCODE.get(ch) ?? ENCODE.get('?')!; });
  out[chars.length] = TERMINATOR;
  return out;
}
