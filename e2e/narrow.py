"""Nothing runs off the edge of a small screen: at 320, 360, 390 and 768px wide, the page never scrolls sideways and no
text in a retro window spills out of it or past the screen, on the landing page, every tab, the Pokémon window and
the review dialog (with every Pokémon caught, the widest numbers)."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []

SCAN = """() => { const bad = []; const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) bad.push('the page scrolls sideways: ' + document.documentElement.scrollWidth + ' > ' + vw);
  document.querySelectorAll('.lcd, .lcd *').forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width) return;
    if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.children.length === 0 && e.clientWidth > 0) bad.push('text spills: ' + e.className + ' ' + e.textContent.trim().slice(0, 20));
    if (r.right > vw + 1 || r.left < -1) bad.push('outside the screen: ' + e.tagName.toLowerCase() + '.' + e.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); });
  return bad; }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for width in (320, 360, 390, 768):
        ctx = b.new_context(viewport={'width': width, 'height': 800}, device_scale_factor=2)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.goto(BASE); page.wait_for_selector('.slot')
        seen = {'landing page': page.evaluate(SCAN)}
        page.click('.sample-row button'); page.wait_for_selector('.tabs'); page.wait_for_timeout(1200)
        for tab in ('Trainer', 'Bag', 'Party', 'Boxes', 'Pokédex'):
            page.click(f'button.tab:has-text("{tab}")'); page.wait_for_timeout(250); seen[tab] = page.evaluate(SCAN)
        page.click('button.tab:has-text("Party")'); page.locator('.mon-main').nth(0).click(); page.wait_for_selector('dialog.mon-dialog[open]'); page.wait_for_timeout(250)
        seen['Pokémon window'] = page.evaluate(SCAN)
        page.screenshot(path=f'{SP}/narrow-{width}-window.png')
        page.click('dialog.mon-dialog button.primary'); page.wait_for_selector('dialog.mon-dialog', state='detached')
        page.click('button.tab:has-text("Pokédex")'); page.click('button:has-text("Mark all caught")')
        page.click('.save-btn'); page.wait_for_selector('dialog.review-dialog[open]'); page.wait_for_timeout(250)
        seen['review dialog'] = page.evaluate(SCAN)
        page.screenshot(path=f'{SP}/narrow-{width}-review.png')
        bad = {k: v for k, v in seen.items() if v}
        assert not bad, (width, bad)
        ctx.close()
    b.close()
assert not errors, errors
print('narrow: ok')
