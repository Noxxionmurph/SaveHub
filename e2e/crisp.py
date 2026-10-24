"""Pixel art stays sharp: the 16x16 badges are drawn at a whole number of screen pixels per source pixel on every screen
scaling (100%, 125%, 150%, 200%, a 2.625 phone, 300%) and at desktop and phone width, on the trainer card and on the
Trainer tab. A fractional multiple (2.5x, 4.5x...) is what makes pixel edges look soft. Also: the scale follows the
browser's zoom while the page is open, and the badges still fit their cells and the ring around them."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []
RATIOS = (1, 1.25, 1.5, 2, 2.625, 3)

SCALES = """() => {
  const scale = (sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return r.width ? [r.width * devicePixelRatio / 16, r.height * devicePixelRatio / 16] : null; }).filter(Boolean);
  return { card: scale('.tcard-badges .badge-icon'), tab: scale('.badge-btn .badge-icon'), dpr: devicePixelRatio, root: getComputedStyle(document.documentElement).getPropertyValue('--dpr') };
}"""


def whole(v):
    return abs(v - round(v)) < 0.02 and round(v) >= 1


def run(p, size, ratio):
    b = p.chromium.launch()
    ctx = b.new_context(viewport=size, device_scale_factor=ratio)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    page.goto(BASE)
    page.click('.sample-row button'); page.wait_for_selector('.tabs')
    page.wait_for_function("() => [...document.querySelectorAll('.tcard-badges .badge-icon')].every((i) => i.complete)")
    tag = f"{size['width']}px @{ratio}x"
    out = page.evaluate(SCALES)
    assert float(out['root']) == ratio, (tag, 'the page was not told the screen scaling', out['root'])
    assert len(out['card']) == 8, (tag, out)
    for w, hgt in out['card']:
        assert whole(w) and whole(hgt), (tag, 'trainer card badge is not a whole multiple', w, hgt)
    # all eight are drawn the same size, inside the card, and not past their cell
    assert len({round(w, 2) for w, _ in out['card']}) == 1, (tag, out['card'])
    over = page.evaluate("""() => { const row = document.querySelector('.tcard-badges').getBoundingClientRect(); return [...document.querySelectorAll('.tcard-badges .badge-icon')].some((i) => { const r = i.getBoundingClientRect(); return r.left < row.left - 0.5 || r.right > row.right + 0.5; }); }""")
    assert not over, (tag, 'a badge sticks out of the card')
    page.screenshot(path=f"{SP}/crisp-{size['width']}-{ratio}-card.png")

    page.click('button.tab:has-text("Trainer")')
    page.wait_for_selector('.badge-btn .badge-icon')
    page.wait_for_function("() => [...document.querySelectorAll('.badge-btn .badge-icon')].every((i) => i.complete)")
    out = page.evaluate(SCALES)
    assert len(out['tab']) == 8, (tag, out)
    for w, hgt in out['tab']:
        assert whole(w) and whole(hgt), (tag, 'trainer tab badge is not a whole multiple', w, hgt)
        css = w * 16 / ratio
        assert 40 <= css <= 52.5, (tag, 'trainer tab badge is the wrong size', css)
    inside = page.evaluate("""() => [...document.querySelectorAll('.badge-btn')].every((b) => { const g = b.querySelector('.gem').getBoundingClientRect(), i = b.querySelector('.badge-icon').getBoundingClientRect(); return i.left >= g.left + 2 && i.right <= g.right - 2 && i.top >= g.top + 2 && i.bottom <= g.bottom - 2; })""")
    assert inside, (tag, 'a badge touches the ring')
    page.locator('.badge-grid').screenshot(path=f"{SP}/crisp-{size['width']}-{ratio}-tab.png")
    ctx.close(); b.close()


def narrowest(p):
    """Even where the eight cells get tight (a 320px phone) the badges stay whole multiples and inside the card."""
    run(p, {'width': 320, 'height': 640}, 2)
    run(p, {'width': 320, 'height': 640}, 1)


def follows_zoom(p):
    """Browser zoom changes the ratio while the page is open; the page must pick it up without a reload."""
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 900, 'height': 700}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(BASE); page.click('.sample-row button'); page.wait_for_selector('.tabs')
    cdp = ctx.new_cdp_session(page)
    for ratio in (1.5, 2, 1):
        # zooming keeps the window and changes the CSS size of the page, so the width follows the ratio too
        cdp.send('Emulation.setDeviceMetricsOverride', {'width': round(1800 / ratio), 'height': 700, 'deviceScaleFactor': ratio, 'mobile': False})
        page.wait_for_function(f"() => devicePixelRatio === {ratio}")
        page.wait_for_function(f"() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dpr')) === {ratio}", timeout=3000)
        out = page.evaluate(SCALES)
        for w, hgt in out['card']:
            assert whole(w) and whole(hgt), (ratio, 'after the zoom changed', w, hgt)
    ctx.close(); b.close()


with sync_playwright() as p:
    for size in ({'width': 1280, 'height': 800}, {'width': 390, 'height': 844}):
        for ratio in RATIOS:
            run(p, size, ratio)
    narrowest(p)
    follows_zoom(p)

assert not errors, errors
print('crisp: ok')
