import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const url = (rel: string) => new URL(`../${rel}`, import.meta.url);
const read = (rel: string) => readFileSync(url(rel), 'utf8');

test('the deployed page loads no fonts, scripts or styles from anywhere else', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /(?:href|src)=["']?(?:https?:)?\/\//, 'index.html points at another site');
  assert.doesNotMatch(html, /googleapis|gstatic/);
  assert.match(html, /href="\.\/fonts\/fonts\.css"/);
});

test('every font file named in fonts.css exists, is a WOFF, and comes with its licence', () => {
  const css = read('fonts/fonts.css');
  const files = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
  assert.equal(files.length, 3);
  for (const f of files) {
    assert.ok(existsSync(url(`fonts/${f}`)), `${f} is missing`);
    assert.equal(readFileSync(url(`fonts/${f}`)).subarray(0, 4).toString('latin1'), 'wOFF', `${f} is not a WOFF file`);
    assert.ok(existsSync(url(`fonts/OFL-${f.replace(/\.woff$/, '')}.txt`)), `no licence text for ${f}`);
  }
});

test('the stylesheet only asks for font families that fonts.css provides', () => {
  const provided = new Set([...read('fonts/fonts.css').matchAll(/font-family:\s*"([^"]+)"/g)].map((m) => m[1]));
  const wanted = [...read('styles.css').matchAll(/--font-(?:display|body|mono):\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(wanted.length, 3);
  for (const name of wanted) assert.ok(provided.has(name), `${name} has no @font-face`);
});
