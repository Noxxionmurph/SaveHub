"""The chosen in-game frame: on Gold/Silver/Crystal and Ruby/Sapphire/Emerald pages the big windows wear the frame the
save's FRAME option picks (Gen 2's eight, Ruby and Sapphire's twenty, Emerald's twenty), it changes as the Options card
steps through them, it is drawn at whole screen pixels, the windows stay dark in dark mode, and it goes away again on
Gen 1 and the landing page."""
import base64
import math
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []

BIG = '.lcd:is(.tcard, .stats, .review-list, .save-window, .options-window, .dex-summary)'
STATE = """(big) => { const d = devicePixelRatio; const wins = [...document.querySelectorAll(big)].filter((w) => w.getClientRects().length);
  return { frame: document.documentElement.dataset.frame ?? null, dpr: d, vw: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    wins: wins.map((w) => { const r = w.getBoundingClientRect(); return { key: w.dataset.frameKey ?? null, bg: getComputedStyle(w).backgroundImage.slice(0, 15),
      box: [r.left * d, r.top * d, r.width * d, r.height * d], right: r.right }; }) }; }"""

# Every art pixel of the window's top-left corner tile and the edge tiles next to it is one solid block of k x k screen
# pixels on the screenshot: no thinner columns, no seam between tiles.
EVEN = """async ([png, k, ox, oy]) => { const i = new Image(); i.src = 'data:image/png;base64,' + png; await i.decode();
  const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
  const d = g.getImageData(0, 0, i.width, i.height).data; const at = (x, y) => { const p = ((oy + y) * i.width + ox + x) * 4; return [d[p], d[p + 1], d[p + 2]]; };
  const same = (a, b) => a.every((v, j) => Math.abs(v - b[j]) <= 12);
  const bad = [];
  for (let ay = 0; ay < 16; ay++) for (let ax = 0; ax < 16; ax++) { if (ax >= 8 && ay >= 8) continue;
    // the window's outermost screen pixel row and column can be a little blended where the layout can't land exactly
    // on a screen pixel (a 64th of a CSS pixel apart), so they are left out
    const x0 = ax ? 0 : 1, y0 = ay ? 0 : 1, want = at(ax * k + x0, ay * k + y0);
    for (let y = y0; y < k; y++) for (let x = x0; x < k; x++) if (!same(at(ax * k + x, ay * k + y), want)) { bad.push([ax, ay]); x = y = k; } }
  return bad.slice(0, 5); }"""


def framed(page, want_set, want_type, label, look=True):
    pic = f'/sprites/frames/{want_set}/{want_type}.png '
    page.wait_for_function("""([big, pic]) => [...document.querySelectorAll(big)].filter((w) => w.getClientRects().length)
      .every((w) => (w.dataset.frameKey ?? '').includes(pic))""", arg=[BIG, pic], timeout=5000)
    page.wait_for_timeout(50)
    s = page.evaluate(STATE, BIG)
    assert s['frame'] == ('gen2' if want_set == 'gen2' else 'gen3'), (label, s)
    for w in s['wins']:
        assert w['bg'].startswith('url("data:'), (label, w)
        # each window is a whole number of screen pixels, so its frame's pixels come out even
        assert all(abs(v - round(v)) < 0.05 for v in w['box'][2:]), (label, 'a window is not a whole number of screen pixels', w)
        assert w['right'] <= s['vw'] + 0.5, (label, 'the framed window runs off the screen', w)
    assert s['scroll'] <= s['vw'], (label, 'the page scrolls sideways', s)
    if not look:
        return
    k = max(1, math.floor(2 * s['dpr'] + 0.5))   # like CSS round() and Math.round (Python's round(2.5) is 2)
    # scroll it into view (clear of the sticky tab bar) by a whole number of screen pixels, as a finger on a phone does
    page.evaluate("""(big) => { const w = document.querySelector(big); const sc = w.closest('dialog .dialog-body, dialog') ?? document.scrollingElement;
      const d = devicePixelRatio; const r = w.getBoundingClientRect(); if (r.top >= 0 && r.bottom <= innerHeight) return;
      sc.scrollTop = Math.round((sc.scrollTop + r.top - innerHeight / 3) * d) / d; }""", BIG)
    page.wait_for_timeout(100)
    box = page.evaluate("(big) => { const r = document.querySelector(big).getBoundingClientRect(); return [r.left * devicePixelRatio, r.top * devicePixelRatio]; }", BIG)
    png = page.screenshot(scale='device')
    # the browser puts the window's corner on the nearest screen pixel or the next one, depending on what is round it
    shot = base64.b64encode(png).decode()
    tries = [page.evaluate(EVEN, [shot, k, round(box[0]) + dx, round(box[1]) + dy]) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
    bad = min(tries, key=len)
    if bad:
        open(f'{SP}/frames-uneven.png', 'wb').write(png)
    assert not bad, (label, 'uneven frame pixels (art x, y), see frames-uneven.png', box, bad)


def open_file(page, name):
    with page.expect_file_chooser() as fc:
        page.click('.slot')
    fc.value.set_files(f'{SP}/{name}')
    page.wait_for_selector('.tabs')


with sync_playwright() as p:
    b = p.chromium.launch()
    for width, dpr, scheme in ((320, 3, 'light'), (390, 2.625, 'dark'), (1280, 1.25, 'light'), (982, 1.1, 'dark')):
        ctx = b.new_context(viewport={'width': width, 'height': 900}, device_scale_factor=dpr, color_scheme=scheme)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console: {m.text}') if m.type == 'error' else None)
        page.goto(BASE); page.wait_for_selector('.slot')
        assert page.evaluate("document.documentElement.dataset.frame") is None, 'the landing page has no frame'
        for sample, fset, count in (('Crystal', 'gen2', 8), ('Emerald', 'emerald', 20)):
            page.wait_for_selector('.sample-row button')
            page.click(f'.sample-row button:has-text("{sample}")'); page.wait_for_selector('.tabs'); page.wait_for_timeout(300)
            framed(page, fset, 1, f'{sample} {width}')
            # dark mode: the windows stay dark (Gen 3's too: the frame is drawn in a dark version of its colours), light: Gen 3's are the game's white
            paper = page.evaluate(f"getComputedStyle(document.querySelector('{BIG}')).getPropertyValue('--lcd').trim().toLowerCase()")
            if scheme == 'dark':
                assert paper != '#ffffff', (sample, width, paper)
            elif fset != 'gen2':
                assert paper == '#ffffff', (sample, width, paper)
            # stepping the Options card's Frame redraws every big window, live, and wraps round past the last TYPE
            nxt = page.locator('button[aria-label="Next frame"]')
            for n in range(2, count + 1):
                nxt.click()
                framed(page, fset, n, f'{sample} {width} type {n}', look=n in (2, 3, count))
            page.locator('.options-window').last.screenshot(path=f'{SP}/frames-{sample}-{width}-last.png')
            nxt.click(); framed(page, fset, 1, f'{sample} {width} wrapped')
            page.locator('button[aria-label="Previous frame"]').click(); framed(page, fset, count, f'{sample} {width} back')
            # the Pokémon window and the review's windows wear it too
            page.click('button.tab:has-text("Party")'); page.locator('.mon-main').nth(0).click(); page.wait_for_selector('dialog.mon-dialog[open]')
            framed(page, fset, count, f'{sample} {width} Pokémon window')
            page.click('dialog.mon-dialog button.primary'); page.wait_for_selector('dialog.mon-dialog', state='detached')
            page.click('.save-btn'); page.wait_for_selector('dialog.review-dialog[open]')
            framed(page, fset, count, f'{sample} {width} review')
            assert page.locator('dialog .lcd.save-window[data-frame-key]').count() == 1
            page.screenshot(path=f'{SP}/frames-{sample}-{width}-review.png')
            page.click('dialog.review-dialog button:has-text("Keep editing")')
            page.goto(BASE); page.wait_for_selector('.slot')
            assert page.evaluate("document.documentElement.dataset.frame") is None, 'the frame is gone on the landing page'
        # Gen 1 has no FRAME setting, so it keeps the plain two-line frame
        page.click('.sample-row button:has-text("Yellow")'); page.wait_for_selector('.tabs')
        s = page.evaluate(STATE, BIG)
        assert s['frame'] is None and all(w['key'] is None and not w['bg'].startswith('url(') for w in s['wins']), s
        if width == 390:
            # Ruby and Sapphire have their own set (Emerald redrew nine of them)
            page.goto(BASE); page.wait_for_selector('.slot'); open_file(page, 'ruby.sav')
            if page.locator('.version-buttons').count():
                page.locator('.version-buttons button').first.click()
            framed(page, 'rs', 1, 'Ruby')
        ctx.close()
    b.close()
assert not errors, errors
print('frames: ok')
