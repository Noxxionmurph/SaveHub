"""The Game Boy touches on the Gen 1 editor: HP bars that follow the game's own rules (48 pixels; green from 27, yellow from
10, red below) in the Pokémon window, the party list, the party strip and the boxes; the save window (PLAYER, BADGES, POKÉDEX,
TIME) at the top of the review dialog, which describes the file as edited; the menu cursor on the open tab, which takes no
room; and the two-line frame on the big readout windows (with the ruled paper only on the Game Boy Advance theme)."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []


def field(root, label):
    return root.locator(f'label.field:has(.field-label:text-is("{label}")) input')


def bar_state(bar):
    cls = bar.get_attribute('class')
    colour = next(c for c in ('hp-green', 'hp-yellow', 'hp-red') if c in cls)
    return colour, int(bar.get_attribute('data-px'))


def fill_ratio(bar):
    return bar.evaluate('b => b.querySelector(".hp-fill").getBoundingClientRect().width / (b.clientWidth)')


with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------------------------------------------------------- HP bars, save window, frame, cursor (Game Boy theme)
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    page.goto(BASE); page.click('.sample-row button'); page.wait_for_selector('.tabs')

    # the open tab has the menu cursor, which is there for the open tab only and takes no room
    def cursor(tab):
        return page.evaluate("""t => { const el = [...document.querySelectorAll('.tab')].find((e) => e.textContent.trim() === t);
            const s = getComputedStyle(el, '::before'); return { content: s.content, width: s.width, clip: s.clipPath, on: el.classList.contains('active') }; }""", tab)
    assert cursor('Trainer')['on'] and cursor('Trainer')['content'] == '""' and cursor('Trainer')['width'] == '6px' and 'polygon' in cursor('Trainer')['clip'], cursor('Trainer')
    assert cursor('Bag')['content'] in ('none', 'normal'), cursor('Bag')
    # ... it takes no room: the tab bar is exactly as wide with it as without it (at 320px the five tabs already scroll sideways,
    # as that bar is meant to; from 340px up they fit)
    page.add_style_tag(content='html[data-nocursor] .tab.active::before { display: none !important; }')
    widths = "(() => { const t = document.querySelector('.tabs'); return [t.scrollWidth, t.clientWidth]; })()"
    for width in (320, 340, 360, 390, 1280):
        page.set_viewport_size({'width': width, 'height': 800})
        for tab in ('Trainer', 'Bag', 'Party', 'Boxes', 'Pokédex'):
            page.click(f'button.tab:has-text("{tab}")')
            page.evaluate("document.documentElement.removeAttribute('data-nocursor')"); with_it = page.evaluate(widths)
            page.evaluate("document.documentElement.setAttribute('data-nocursor', '')"); without = page.evaluate(widths)
            page.evaluate("document.documentElement.removeAttribute('data-nocursor')")
            assert with_it == without, f'the cursor changes the tab bar at {width}px with {tab} open: {with_it} vs {without}'
            if width >= 340:
                assert with_it[0] <= with_it[1] + 1, f'the tab bar overflows at {width}px with {tab} open: {with_it}'
    page.set_viewport_size({'width': 390, 'height': 844})

    # the big readout windows have a two-line frame on this theme, and no ruled paper
    page.click('button.tab:has-text("Trainer")')
    shadow = page.evaluate("getComputedStyle(document.querySelector('.lcd.tcard')).boxShadow")
    assert shadow.count('inset') == 2, shadow
    assert page.evaluate("getComputedStyle(document.querySelector('.lcd.tcard')).backgroundImage") == 'none'
    assert page.evaluate("getComputedStyle(document.querySelector('.lcd.lv, .tcard-id') ).boxShadow") != shadow   # a small screen has no frame

    # HP bar in the Pokémon window: the game's cut-offs, for a Pokémon with 62 HP
    page.click('button.tab:has-text("Party")')
    page.locator('.mon-main').nth(0).click(); page.wait_for_selector('dialog.mon-dialog[open]')
    dlg = page.locator('dialog.mon-dialog')
    assert dlg.locator('.hp-bar').count() == 1
    meter = dlg.locator('.hp-bar')
    assert meter.get_attribute('role') == 'meter' and meter.get_attribute('aria-valuemax') == '62' and meter.get_attribute('aria-valuenow') == '62'
    for hp, colour, px in ((62, 'hp-green', 48), (35, 'hp-green', 27), (34, 'hp-yellow', 26), (13, 'hp-yellow', 10), (12, 'hp-red', 9),
                           (1, 'hp-red', 1), (0, 'hp-red', 0), (999, 'hp-green', 48)):
        f = field(dlg, 'Current HP'); f.fill(str(hp)); f.dispatch_event('change')
        bar = dlg.locator('.hp-bar'); assert bar.count() == 1
        got = bar_state(bar)
        assert got == (colour, px), (hp, got, (colour, px))
        assert abs(fill_ratio(bar) - px / 48) < 0.03, (hp, fill_ratio(bar), px / 48)
        assert bar.get_attribute('aria-valuenow') == str(min(hp, 62))
    f = field(dlg, 'Current HP'); f.fill('20'); f.dispatch_event('change')
    assert bar_state(dlg.locator('.hp-bar')) == ('hp-yellow', 15)        # 20 * 48 / 62 = 15.5
    page.screenshot(path=f'{SP}/flair-window.png')
    dlg.locator('button.primary').click(); page.wait_for_selector('dialog.mon-dialog', state='detached')

    # ... and the same bar in the party list, the party strip and the boxes (pictures there: hidden from screen readers)
    card = page.locator('.mon-main').nth(0).locator('.hp-bar')
    assert bar_state(card) == ('hp-yellow', 15) and card.get_attribute('aria-hidden') == 'true'
    assert page.locator('.mon-main .hp-bar').count() == 6
    assert bar_state(page.locator('.mon-main').nth(1).locator('.hp-bar'))[0] == 'hp-green'
    page.click('button.tab:has-text("Trainer")')
    strip = page.locator('.party-slot .hp-bar')
    assert strip.count() == 6 and bar_state(strip.nth(0)) == ('hp-yellow', 15)
    page.click('button.tab:has-text("Boxes")')
    assert page.locator('.party-cells .box-cell .hp-bar').count() == 6
    assert bar_state(page.locator('.party-cells .box-cell .hp-bar').nth(0)) == ('hp-yellow', 15)
    assert page.locator('.box-grid .box-cell .hp-bar').count() >= 1, 'box Pokémon get a bar too (their maximum is worked out)'
    assert bar_state(page.locator('.box-grid .box-cell .hp-bar').nth(0))[0] == 'hp-green'
    page.screenshot(path=f'{SP}/flair-boxes.png')

    # discarding an HP edit with the X puts the bar back
    page.click('button.tab:has-text("Party")')
    page.locator('.mon-main').nth(1).click(); page.wait_for_selector('dialog.mon-dialog[open]')
    dlg = page.locator('dialog.mon-dialog')
    f = field(dlg, 'Current HP'); f.fill('3'); f.dispatch_event('change')
    assert bar_state(dlg.locator('.hp-bar'))[0] == 'hp-red'
    dlg.locator('button.dialog-x').click(); page.wait_for_selector('dialog.confirm-dialog[open]')
    page.click('dialog.confirm-dialog button:has-text("Discard")'); page.wait_for_selector('dialog.mon-dialog', state='detached')
    assert bar_state(page.locator('.mon-main').nth(1).locator('.hp-bar'))[0] == 'hp-green'

    # the save window at the top of the review dialog says whose save this is, as edited
    page.click('button.tab:has-text("Trainer")')
    card_name = page.locator('.tcard-name').inner_text()
    card_time = page.locator('.tcard-stats div:has(dt:text-is("Time")) dd').inner_text()
    page.click('.save-btn'); page.wait_for_selector('dialog.review-dialog[open]')
    rows = page.locator('dialog.review-dialog dl.save-window')
    assert rows.count() == 1
    assert rows.locator('dt').all_inner_texts() == ['PLAYER', 'BADGES', 'POKÉDEX', 'TIME']
    first = rows.locator('dd').all_inner_texts()
    assert first[0] == card_name and first[1] == '3' and first[3] == card_time, (first, card_name, card_time)
    assert 'This save: player' in rows.get_attribute('aria-label')
    page.screenshot(path=f'{SP}/flair-review.png')
    page.click('dialog.review-dialog button:has-text("Keep editing")'); page.wait_for_selector('dialog.review-dialog', state='detached')
    field(page, 'Trainer name').fill('RED'); field(page, 'Hours').fill('20'); field(page, 'Hours').dispatch_event('change')
    page.click('button:has-text("All badges")')
    page.click('button.tab:has-text("Pokédex")'); page.click('button:has-text("Own all 151")')
    page.click('.save-btn'); page.wait_for_selector('dialog.review-dialog[open]')
    assert page.locator('dialog.review-dialog dl.save-window dd').all_inner_texts() == ['RED', '8', '151', '20:34'], \
        page.locator('dialog.review-dialog dl.save-window dd').all_inner_texts()
    ctx.close()

    # ---------------------------------------------------------------- the Game Boy Advance theme keeps the frame and adds ruled paper
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.goto(f'{BASE}?console=gba'); page.click('.sample-row button'); page.wait_for_selector('.tabs')
    assert page.evaluate("getComputedStyle(document.querySelector('.lcd.tcard')).boxShadow").count('inset') == 2
    assert 'repeating-linear-gradient' in page.evaluate("getComputedStyle(document.querySelector('.lcd.tcard')).backgroundImage")
    ctx.close()
    b.close()
print('ERRORS:', errors or 'none')
