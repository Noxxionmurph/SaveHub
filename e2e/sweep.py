"""A layout sweep over every page: Red/Blue, Yellow, Gold and Crystal, each tab and the Pokémon window, at 320, 375 and
1280px. On each it fails if the page scrolls sideways, two cards sit closer than 8px (one touching another, as the TM/HM
card once did), a label, button, tab or name is cut off or spills out of its box, or a picture fails to load. It checks
how things sit, not what they say, so a new game's pages are covered by adding it to GAMES."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []

SCAN = """async () => {
  // load every picture now, not when it scrolls into view, so a missing one is caught
  const imgs = [...document.querySelectorAll('img')];
  imgs.forEach((i) => { i.loading = 'eager'; });
  await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
  const bad = [];
  const vw = document.documentElement.clientWidth;
  const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const name = (e) => (e.querySelector('h3, h4')?.textContent || e.textContent || e.className).trim().slice(0, 30);
  if (document.documentElement.scrollWidth > vw + 1) bad.push(`scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
  imgs.filter((i) => shown(i) && i.complete && i.naturalWidth === 0).forEach((i) => bad.push(`picture missing: ${i.getAttribute('src')}`));
  // cards that share a column must keep a gap; so must cards side by side
  const scope = document.querySelector('dialog[open]') || document;
  const cards = [...scope.querySelectorAll('.card')].filter(shown);
  for (const a of cards) for (const b of cards) {
    if (a === b || a.contains(b) || b.contains(a)) continue;
    const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
    const across = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const down = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (across > 20 && rb.top > ra.top && rb.top - ra.bottom < 8) bad.push(`cards ${Math.round(rb.top - ra.bottom)}px apart: "${name(a)}" above "${name(b)}"`);
    if (down > 20 && rb.left > ra.left && rb.left - ra.right < 8) bad.push(`cards ${Math.round(rb.left - ra.right)}px apart: "${name(a)}" beside "${name(b)}"`);
  }
  // text cut off (an ellipsis) or spilling out of its box
  const texts = [...scope.querySelectorAll('button, label, .tab, h2, h3, h4, .field-label, .opt-label, .dex-name, .slot-name, .mon-name, .tile-name, .tm-label, .lv-tag')];
  texts.filter(shown).forEach((e) => {
    if (e.closest('.sr-only') || e.clientWidth === 0) return;
    if (e.scrollWidth > e.clientWidth + 1) bad.push(`cut off: ${e.tagName.toLowerCase()}.${e.className} "${e.textContent.trim().slice(0, 30)}"`);
  });
  return [...new Set(bad)];
}"""

GAMES = [
    ('Yellow', lambda page: page.click('.sample-row button:has-text("Yellow")')),
    ('Crystal', lambda page: page.click('.sample-row button:has-text("Crystal")')),
    ('Red/Blue', lambda page: open_file(page, 'rb.sav')),
    ('Gold', lambda page: open_file(page, 'gold.sav')),
]


def open_file(page, name):
    with page.expect_file_chooser() as fc:
        page.click('.slot')
    fc.value.set_files(f'{SP}/{name}')


with sync_playwright() as p:
    b = p.chromium.launch()
    found = {}
    for width in (320, 375, 1280):
        ctx = b.new_context(viewport={'width': width, 'height': 860})
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        page.goto(BASE); page.wait_for_selector('.slot')
        found[f'{width} landing page'] = page.evaluate(SCAN)
        for game, opener in GAMES:
            page.goto(BASE); page.wait_for_selector('.slot')
            opener(page); page.wait_for_selector('.tabs'); page.wait_for_timeout(1200)   # the trainer card types itself in
            found[f'{width} {game} version picker'] = page.evaluate(SCAN)
            for tab in ('Trainer', 'Bag', 'Party', 'Boxes', 'Pokédex'):
                page.click(f'button.tab:has-text("{tab}")'); page.wait_for_timeout(200)
                found[f'{width} {game} {tab}'] = page.evaluate(SCAN)
            page.click('button.tab:has-text("Party")')
            for i in range(page.locator('.mon-main').count()):   # every party member: eggs, Unown and Pikachu differ
                page.locator('.mon-main').nth(i).click(); page.wait_for_selector('dialog.mon-dialog[open]'); page.wait_for_timeout(150)
                found[f'{width} {game} Pokémon window {i + 1}'] = page.evaluate(SCAN)
                page.click('dialog.mon-dialog button.primary'); page.wait_for_selector('dialog.mon-dialog', state='detached')
        ctx.close()
    b.close()
bad = {k: v for k, v in found.items() if v}
assert not bad, '\n'.join(f'{k}: {v}' for k, v in bad.items())
assert len(found) > 100, len(found)
print('ERRORS:', errors or 'none')
