"""The handheld themes: the Game Boy (default), the teal Game Boy Color and the indigo Game Boy Advance. Text stays readable in every combination of
theme and light/dark, ?console= previews a theme, and a game module's own `theme` restyles the page while it is open."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
errors = []


def lum(h):
    h = h.lstrip('#')
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    hi, lo = sorted([lum(a), lum(b)], reverse=True)
    return (hi + 0.05) / (lo + 0.05)


# (text colour, what it sits on, least contrast). 4.5 is WCAG's bar for text; 3 is its bar for focus rings and borders.
PAIRS = [('--text', '--bg', 4.5), ('--text', '--surface', 4.5), ('--text', '--surface-2', 4.5), ('--muted', '--bg', 4.5),
         ('--muted', '--surface', 4.5), ('--button-ink', '--button', 4.5), ('--lcd-ink', '--lcd', 4.5),
         ('--lcd-dim', '--lcd', 4.5), ('--danger', '--bg', 4.5), ('--danger', '--surface', 4.5),
         ('--focus', '--bg', 3.0), ('--focus', '--surface', 3.0)]

with sync_playwright() as p:
    b = p.chromium.launch()
    for console in ('gb', 'gbc', 'gba'):
        for scheme in ('light', 'dark'):
            ctx = b.new_context(viewport={'width': 390, 'height': 844}, color_scheme=scheme)
            page = ctx.new_page()
            page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            page.goto(f'{BASE}?console={console}')
            page.wait_for_selector('.slot')
            attr = page.evaluate('document.documentElement.dataset.console || "gb"')
            assert attr == console, (console, attr)
            tokens = page.evaluate("""() => { const s = getComputedStyle(document.documentElement);
                return Object.fromEntries(['--bg','--surface','--surface-2','--text','--muted','--button','--button-ink','--lcd','--lcd-ink','--lcd-dim','--danger','--focus']
                  .map(k => [k, s.getPropertyValue(k).trim()])); }""")
            worst = None
            for fg, bg, least in PAIRS:
                c = contrast(tokens[fg], tokens[bg])
                assert c >= least, f'{console}/{scheme}: {fg} on {bg} is {c:.2f}, needs {least}'
                worst = c if worst is None else min(worst, c)
            # the screen windows really use the theme's screen colour
            page.click('.sample-row button'); page.wait_for_selector('.tcard-top')
            got = page.evaluate("getComputedStyle(document.querySelector('.lcd')).backgroundColor")
            want = page.evaluate("t => { const e = document.createElement('i'); e.style.color = t; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; }", tokens['--lcd'])
            assert got == want, (console, scheme, got, want)
            print(f'{console}/{scheme}: ok, lowest text contrast {worst:.1f}')
            ctx.close()

    # with no ?console=, the page follows the open game's own theme and goes back to the Game Boy when it is closed
    ctx = b.new_context(viewport={'width': 390, 'height': 844}); page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.goto(BASE); page.wait_for_selector('.slot')
    assert page.evaluate('document.documentElement.dataset.console') is None
    page.evaluate("import('./games/pokemon-gen1.js').then((m) => { m.default.theme = 'gbc'; })")
    page.wait_for_timeout(300)
    page.click('.sample-row button'); page.wait_for_selector('.tabs')
    assert page.evaluate('document.documentElement.dataset.console') == 'gbc', 'the game\'s theme is applied'
    page.click('text=Close file'); page.wait_for_selector('.slot')
    assert page.evaluate('document.documentElement.dataset.console') is None, 'closing goes back to the Game Boy'
    ctx.close()
    b.close()
print('ERRORS:', errors or 'none')
