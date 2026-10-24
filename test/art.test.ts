import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { ART_BASE, PIKACHU_SHEET, artUrl } from '../src/ui/art.ts';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('the committed artwork address is the hosted artwork site, not a local path', () => {
  // scripts/build.mjs --local-art swaps this for ./assets/ in dist/ only. If a local value gets committed, the
  // deployed site would look for pictures next to itself, and find none.
  assert.match(ART_BASE, /^https:\/\/[^/]+\/[^/]+\/$/);
  assert.equal(artUrl('sprites/pokemon/25.png'), `${ART_BASE}sprites/pokemon/25.png`);
  assert.equal(artUrl(PIKACHU_SHEET), `${ART_BASE}sprites/pikachu.png`);
});

test('the code never points at artwork that ships with the site', () => {
  // The pictures are not in this repository. Everything has to go through art.ts so it can all be moved or removed
  // in one place; a bare "assets/..." path would quietly bypass that.
  const files = ['index.html', 'styles.css'];
  const walk = (dir: string): string[] => readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  files.push(...walk('src').filter((f) => f.endsWith('.ts') && f !== 'src/ui/art.ts'));
  for (const f of files) {
    const code = read(f).split('\n').filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join('\n'); // ignore comments
    assert.doesNotMatch(code, /['"(]\.?\/?assets\//, `${f} refers to assets/ directly`);
  }
});

test('the artwork checkout stays out of this repository', () => {
  assert.match(read('.gitignore'), /^assets\/$/m);
});
