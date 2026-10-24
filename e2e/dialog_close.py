"""The Pokémon window has a close button that stays at its top right while the form scrolls, closes the window the way
Done and Escape do (edits made so far are kept; nothing is written to the file), doesn't sit on the level badge or the
scrollbar, and survives the window redrawing itself after an edit. Also: the one-line guidance under each tab runs the
full width, not a capped width that breaks the line early. Checked at desktop and phone width."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []


def overlap(a, b):
    return a['x'] < b['x'] + b['width'] and b['x'] < a['x'] + a['width'] and a['y'] < b['y'] + b['height'] and b['y'] < a['y'] + a['height']


def check(p, name, size):
    b = p.chromium.launch()
    ctx = b.new_context(viewport=size)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name} pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'{name} console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    page.goto(BASE)
    page.click('.sample-row button'); page.wait_for_selector('.tabs')

    # the guidance line under the tabs is as wide as the content under it (it used to stop at about 690px)
    intro = page.locator('.tab-intro').first.bounding_box()
    holder = page.locator('.tab-intro').first.locator('xpath=..').bounding_box()
    assert abs(intro['width'] - holder['width']) < 1, (name, intro, holder)
    assert page.eval_on_selector('.tab-intro', 'e => getComputedStyle(e).maxWidth') == 'none'

    page.click('button.tab:has-text("Party")')
    page.locator('.mon-main').nth(0).click(); page.wait_for_selector('dialog.mon-dialog[open]')
    dlg = page.locator('dialog.mon-dialog')
    x = dlg.locator('button.dialog-x')
    assert x.count() == 1 and x.get_attribute('aria-label') == 'Close' and x.get_attribute('title') == 'Close'
    assert x.inner_text() == '', 'the X is drawn, not typed'

    def place():
        return x.bounding_box(), dlg.bounding_box(), dlg.locator('.dialog-body').bounding_box()

    xb, db, bb = place()
    assert xb['width'] >= 38 and xb['height'] >= 38, xb                      # a fingertip-sized target
    assert xb['y'] - db['y'] < 24 and (db['x'] + db['width']) - (xb['x'] + xb['width']) < 24, (xb, db)   # top right corner
    assert not overlap(xb, dlg.locator('.mon-head .lv').bounding_box()), 'the X sits on the level badge'
    page.screenshot(path=f'{SP}/x-{name}-1-top.png')

    # scroll the form to the very bottom: the X has to stay in view, in the same corner
    dlg.locator('.dialog-body').evaluate('e => { e.scrollTop = e.scrollHeight; }')
    page.wait_for_timeout(100)
    assert dlg.locator('.dialog-body').evaluate('e => e.scrollTop') > 50, 'the form is long enough to scroll'
    xb2, db2, bb2 = place()
    assert abs(xb2['y'] - xb['y']) < 10 and abs(xb2['x'] - xb['x']) < 2, ('the X moved when scrolling', xb, xb2)
    inner_right = bb2['x'] + dlg.locator('.dialog-body').evaluate('e => e.clientWidth')
    assert xb2['x'] + xb2['width'] <= inner_right + 0.5, ('the X is over the scrollbar', xb2, inner_right)
    page.screenshot(path=f'{SP}/x-{name}-2-scrolled.png')

    # an edit redraws the window; there is still exactly one X, and it still closes it, keeping the edit
    dlg.evaluate('d => d.querySelector(".dialog-body").scrollTop = 0')
    lvl = dlg.locator('label.field:has-text("Level") input'); lvl.fill('29'); lvl.dispatch_event('change')
    assert 'Lv 29' in dlg.locator('.mon-head').inner_text()
    assert dlg.locator('button.dialog-x').count() == 1
    dlg.locator('button.dialog-x').click(); page.wait_for_selector('dialog.mon-dialog', state='detached')
    assert 'Lv 29' in page.locator('.party-list, .mon').first.inner_text() or page.locator('.lv-tag, .lcd.lv').filter(has_text='Lv 29').count() >= 1
    assert page.locator('.save-btn.dirty').count() == 1, 'the edit was kept, so Save has something to write'

    # Escape and Done still work as before
    page.locator('.mon-main').nth(0).click(); page.wait_for_selector('dialog.mon-dialog[open]')
    page.keyboard.press('Escape'); page.wait_for_selector('dialog.mon-dialog', state='detached')
    page.locator('.mon-main').nth(0).click(); page.wait_for_selector('dialog.mon-dialog[open]')
    page.click('dialog.mon-dialog button.primary'); page.wait_for_selector('dialog.mon-dialog', state='detached')
    ctx.close(); b.close()


with sync_playwright() as p:
    check(p, 'desktop', {'width': 1280, 'height': 800})
    check(p, 'phone', {'width': 360, 'height': 740})
print('ERRORS:', errors or 'none')
