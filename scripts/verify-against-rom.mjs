// Checks the editor's built-in Gen 1 tables against a Pokémon Red or Blue ROM you supply:
//
//     node scripts/verify-against-rom.mjs path/to/pokemon-red.gb
//
// It reads the ROM, compares, and prints what differs. Nothing from the ROM is copied into the repo or written
// anywhere. Table positions come from the pret/pokered disassembly (bank 0E for the base stats and moves); the
// script checks a known pattern at each one and says so if the ROM is a different build.
import { readFileSync } from 'node:fs';
import {
  BASE_STATS, DEX_NAMES, FRIENDSHIP_BANDS, GROWTH_BY_DEX, INTERNAL_TO_DEX, MOVE_NAMES, REACTION_ROWS, TYPE_BYTE, itemName,
} from '../src/core/gen1/data.ts';
import { moveInfo } from '../src/core/gen1/moves.ts';

const path = process.argv[2];
if (!path) { console.error('usage: node scripts/verify-against-rom.mjs path/to/rom.gb'); process.exit(2); }
const rom = new Uint8Array(readFileSync(path));
const title = String.fromCharCode(...rom.slice(0x134, 0x143)).replace(/\0/g, '');
console.log(`ROM: ${title}, ${rom.length} bytes`);

const problems = [];
const check = (what, ok, detail) => { if (!ok) problems.push(`${what}: ${detail}`); };
const find = (bytes, from = 0) => {
  outer: for (let i = from; i <= rom.length - bytes.length; i++) {
    for (let j = 0; j < bytes.length; j++) if (rom[i + j] !== bytes[j]) continue outer;
    return i;
  }
  return -1;
};
/** The game's text encoding for plain capitals and a few symbols. */
const CHARS = { ' ': 0x7f, "'": 0xe0, '-': 0xe3, '.': 0xe8, '?': 0xe6, '!': 0xe7, '♂': 0xef, '♀': 0xf5, 'é': 0xba };
const encode = (s) => Array.from(s, (c) => (c in CHARS ? CHARS[c] : c >= 'A' && c <= 'Z' ? 0x80 + c.charCodeAt(0) - 65 : c >= '0' && c <= '9' ? 0xf6 + +c : 0x50));
const decode = (bytes) => {
  let out = '';
  for (const b of bytes) {
    if (b === 0x50) break;
    if (b === 0xbd) { out += "'S"; continue; } // the game's single 's character
    const rev = Object.entries(CHARS).find(([, v]) => v === b);
    out += rev ? rev[0] : b >= 0x80 && b <= 0x99 ? String.fromCharCode(65 + b - 0x80) : b >= 0xa0 && b <= 0xb9 ? String.fromCharCode(97 + b - 0xa0) : b >= 0xf6 ? String(b - 0xf6) : '?';
  }
  return out;
};
const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9♂♀]/g, '');
const typeName = Object.fromEntries(Object.entries(TYPE_BYTE).map(([n, b]) => [b, n]));

// ---- base stats: 151 entries of 28 bytes, in Pokédex order; Mew's lives apart ----
const bsAt = find([1, 45, 49, 49, 45, 65, 22, 3]);
check('base stats table', bsAt >= 0, 'Bulbasaur\'s entry was not found');
const GROWTH = { 0: 'Medium Fast', 3: 'Medium Slow', 4: 'Fast', 5: 'Slow' };
let statRows = 0, growthRows = 0;
const mewAt = find([151, 100, 100, 100, 100, 100, 24, 24]);
for (let dex = 1; dex <= 151 && bsAt >= 0; dex++) {
  const at = dex === 151 ? mewAt : bsAt + (dex - 1) * 28;
  if (at < 0) { check(`base stats #${dex}`, false, 'not found'); continue; }
  const e = rom.slice(at, at + 28), mine = BASE_STATS[dex - 1];
  check(`base stats #${dex} ${DEX_NAMES[dex - 1]}`, e[0] === dex, `entry says dex ${e[0]}`);
  const want = [mine.hp, mine.atk, mine.def, mine.spe, mine.spc], got = [...e.slice(1, 6)];
  if (want.join() === got.join() && typeName[e[6]] === mine.type1 && typeName[e[7]] === mine.type2) statRows++;
  else check(`base stats #${dex} ${DEX_NAMES[dex - 1]}`, false, `editor ${want} ${mine.type1}/${mine.type2}, ROM ${got} ${typeName[e[6]]}/${typeName[e[7]]}`);
  const g = GROWTH[e[19]];
  if (g === GROWTH_BY_DEX[dex - 1]) growthRows++;
  else check(`growth #${dex} ${DEX_NAMES[dex - 1]}`, false, `editor ${GROWTH_BY_DEX[dex - 1]}, ROM ${g ?? 'code ' + e[19]}`);
}
console.log(`base stats and types: ${statRows}/151 match; growth curves: ${growthRows}/151 match`);

// ---- species names in internal order, and which Pokédex number each internal id is ----
const namesAt = find([...encode('RHYDON'), 0x50, 0x50, 0x50, 0x50, ...encode('KANGASKHAN')]);
check('species names table', namesAt >= 0, 'not found');
const orderAt = find([112, 115, 32, 35, 21, 100, 34, 80, 2, 103]);
check('Pokédex order table', orderAt >= 0, 'not found');
let internalOk = 0, internalTotal = 0;
if (namesAt >= 0 && orderAt >= 0) {
  for (let id = 1; id <= 190; id++) {
    const romDex = rom[orderAt + id - 1];
    const romName = decode(rom.slice(namesAt + (id - 1) * 10, namesAt + id * 10));
    const mineDex = INTERNAL_TO_DEX[id];
    if (romDex === 0) { // a slot the game leaves empty (a "MissingNo.")
      check(`internal 0x${id.toString(16)}`, mineDex === 0, `ROM has no Pokémon there, editor says ${DEX_NAMES[mineDex - 1]}`);
      continue;
    }
    internalTotal++;
    if (mineDex === romDex && norm(DEX_NAMES[mineDex - 1]) === norm(romName)) internalOk++;
    else check(`internal 0x${id.toString(16)}`, false, `ROM: #${romDex} ${romName}, editor: #${mineDex} ${DEX_NAMES[mineDex - 1] ?? '-'}`);
  }
}
console.log(`internal species ids (id, Pokédex number and name): ${internalOk}/${internalTotal} match`);

// ---- moves: 6 bytes each (animation, effect, power, type, accuracy, PP), and their names ----
const movesAt = 0x38000;
check('move table', rom[movesAt] === 1 && rom[movesAt + 2] === 40 && rom[movesAt + 5] === 35, 'Pound was not at the expected place');
let moveOk = 0;
for (let id = 1; id <= 165; id++) {
  const r = rom.slice(movesAt + (id - 1) * 6, movesAt + id * 6), mine = moveInfo(id);
  const pct = Math.floor((mine.accuracy * 255) / 100);
  const same = r[0] === id && r[2] === mine.power && typeName[r[3]] === mine.type && r[4] === pct && r[5] === mine.pp;
  if (same) moveOk++;
  else check(`move ${id} ${MOVE_NAMES[id]}`, false, `editor ${mine.type} power ${mine.power} acc ${mine.accuracy}% PP ${mine.pp}; ROM ${typeName[r[3]]} power ${r[2]} acc ${(r[4] * 100 / 255).toFixed(1)}% PP ${r[5]}`);
}
console.log(`moves (type, power, accuracy, PP): ${moveOk}/165 match`);
const moveNamesAt = find([...encode('POUND'), 0x50, ...encode('KARATE CHOP'), 0x50]);
check('move names', moveNamesAt >= 0, 'not found');
if (moveNamesAt >= 0) {
  let p = moveNamesAt, nameOk = 0;
  for (let id = 1; id <= 165; id++) {
    let end = p; while (rom[end] !== 0x50) end++;
    const romName = decode(rom.slice(p, end));
    if (norm(romName) === norm(MOVE_NAMES[id])) nameOk++; else check(`move name ${id}`, false, `editor ${MOVE_NAMES[id]}, ROM ${romName}`);
    p = end + 1;
  }
  console.log(`move names: ${nameOk}/165 match`);
}

// ---- item names, in item-id order ----
const itemsAt = find([...encode('MASTER BALL'), 0x50, ...encode('ULTRA BALL'), 0x50]);
check('item names', itemsAt >= 0, 'not found');
if (itemsAt >= 0) {
  let p = itemsAt, ok = 0, total = 0;
  for (let id = 1; id <= 0x61; id++) { // the named items; the machines (TM/HM) are numbered, not named
    let end = p; while (rom[end] !== 0x50) end++;
    const romName = decode(rom.slice(p, end)); p = end + 1;
    if (!romName || /^B?\d+F$/.test(romName)) continue; // ids 0x54-0x61 hold elevator floor names, not items
    total++;
    if (norm(itemName(id)) === norm(romName)) ok++;
    else check(`item 0x${id.toString(16)}`, false, `editor ${itemName(id)}, ROM ${romName}`);
  }
  console.log(`item names: ${ok}/${total} match`);
}

// ---- Pokémon Yellow only: how Pikachu reacts when talked to, and what the Celadon Mansion granny says ----
if (title.includes('YELLOW')) {
  // The reaction table: mood limits (40, 127, 128, 210, 255) with their columns, then one row per friendship limit.
  const tableAt = find([40, 1, 127, 2, 128, 3, 210, 4, 255, 5]);
  check('Pikachu reaction table', tableAt >= 0, 'not found');
  if (tableAt >= 0) {
    const rows = REACTION_ROWS.map((_, i) => [...rom.slice(tableAt + 10 + i * 6, tableAt + 16 + i * 6)]);
    let ok = 0;
    const cells = []; // [our animation name, the ROM's animation number]
    rows.forEach((r, i) => {
      const mine = REACTION_ROWS[i], [limit, c1, c2, c3, c4, c5] = r;
      const same = limit === mine.upTo && c1 === c2 && c4 === c5;
      check(`reaction row ${i + 1}`, same, `ROM limit ${limit} columns ${[c1, c2, c3, c4, c5]}, editor up to ${mine.upTo} (below 128 and above 128 should each be one reaction)`);
      if (same) ok++;
      cells.push([mine.below, c1], [mine.at, c3], [mine.above, c4]);
    });
    // two cells show the same picture in the editor exactly when they do in the game
    for (const [a, ia] of cells) for (const [b, ib] of cells) check(`reaction ${a} / ${b}`, (a === b) === (ia === ib), `editor says ${a === b ? 'same' : 'different'}, ROM numbers ${ia} and ${ib}`);
    console.log(`Pikachu reaction table (friendship limits, mood columns, which reactions repeat): ${ok}/${REACTION_ROWS.length} rows match`);
  }
  // The granny's six lines, in friendship order. Her text runs from "It seems like it..." to "...jealous!".
  const letters = (s) => Array.from(s, (c) => (c === ' ' ? 0x7f : c >= 'a' && c <= 'z' ? 0xa0 + c.charCodeAt(0) - 97 : 0x88)); // 0x88 = "I"
  const from = find(letters('It seems like it'));
  const to = find(letters('jealous'), from);
  check('granny text', from >= 0 && to > from, 'not found');
  if (from >= 0 && to > from) {
    /** The game's text as plain lines: its own line breaks become spaces, and the end of a speech starts a new line. */
    const plain = (bytes) => {
      let out = '';
      for (const b of bytes) {
        if (b >= 0x80 && b <= 0x99) out += String.fromCharCode(65 + b - 0x80);
        else if (b >= 0xa0 && b <= 0xb9) out += String.fromCharCode(97 + b - 0xa0);
        else if (b === 0x7f) out += ' ';
        else if (b === 0xbe) out += "'t";
        else if (b === 0xbd) out += "'s";
        else if (b === 0xe0) out += "'";
        else if (b === 0xe7 || b === 0xe8 || b === 0xe6) out += { 0xe7: '!', 0xe8: '.', 0xe6: '?' }[b];
        else if (b === 0x57 || b === 0x58 || b === 0x50) out += '\n';
        else out += ' ';
      }
      return out.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    };
    const said = plain(rom.slice(from, to + 12));
    const KEY = ['tamed at all', 'more care', 'that cute', 'seems tamed', 'happy with you', 'fantastic duo'];
    const LABEL_HAS = ['tamed at all', 'more care', 'cute', 'seems tamed', 'happy with you', 'fantastic duo'];
    let ok = 0;
    KEY.forEach((k, i) => {
      const good = (said[i] ?? '').toLowerCase().includes(k) && FRIENDSHIP_BANDS[i].label.toLowerCase().includes(LABEL_HAS[i]);
      check(`granny line ${i + 1}`, good, `ROM: "${said[i]}", label: "${FRIENDSHIP_BANDS[i].label}"`);
      if (good) ok++;
    });
    console.log(`granny wording (one line per friendship band): ${ok}/${KEY.length} labels match her lines`);
  }
}

console.log(problems.length ? `\n${problems.length} difference(s):\n- ${problems.join('\n- ')}` : '\nEverything checked matches.');
process.exit(problems.length ? 1 : 0);
