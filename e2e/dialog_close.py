"""The Pokémon window has a close button (X) that stays at its top right while the form scrolls and doesn't sit on the
level badge or the scrollbar. Done and Escape keep the edits made in the window; the X throws them away (after asking, if
anything was changed) and puts the Pokémon back exactly as it was. Only edits that are kept mark the save as changed. Also:
the one-line guidance under each tab runs the full width, not a capped width that breaks the line early. Checked at
desktop and phone width."""
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
    assert x.count() == 1 and x.get_attribute('aria-label') == 'Close without keeping changes' and x.get_attribute('title') == x.get_attribute('aria-label')
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

    # a window with no edits closes straight away, and opening it and leaving doesn't mark the save as changed
    dlg.evaluate('d => d.querySelector(".dialog-body").scrollTop = 0')
    dlg.locator('button.dialog-x').click(); page.wait_for_selector('dialog.mon-dialog', state='detached')
    assert page.locator('dialog.confirm-dialog').count() == 0, 'nothing was changed, so nothing to confirm'
    assert page.locator('.save-btn.dirty').count() == 0
    page.locator('.mon-main').nth(0).click(); page.wait_for_selector('dialog.mon-dialog[open]')
    page.click('dialog.mon-dialog button.primary'); page.wait_for_selector('dialog.mon-dialog', state='detached')
    assert page.locator('.save-btn.dirty').count() == 0, 'Done without an edit is not a change'

    def level(): return page.locator('.mon .lcd.lv').first.inner_text()
    def open_first():
        page.locator('.mon-main').nth(0).click(); page.wait_for_selector('dialog.mon-dialog[open]')
        return page.locator('dialog.mon-dialog')

    # an edit redraws the window: still exactly one X. Closing with it asks first; "Keep editing" goes back to the form
    dlg = open_first()
    lvl = dlg.locator('label.field:has-text("Level") input'); lvl.fill('29'); lvl.dispatch_event('change')
    assert 'Lv 29' in dlg.locator('.mon-head').inner_text()
    assert dlg.locator('button.dialog-x').count() == 1
    dlg.locator('button.dialog-x').click(); page.wait_for_selector('dialog.confirm-dialog[open]')
    assert 'Discard your changes to SPARKY?' in page.inner_text('dialog.confirm-dialog')
    page.screenshot(path=f'{SP}/x-{name}-3-confirm.png')
    page.click('dialog.confirm-dialog button:has-text("Keep editing")'); page.wait_for_selector('dialog.confirm-dialog', state='detached')
    assert dlg.evaluate('d => d.open') and 'Lv 29' in dlg.locator('.mon-head').inner_text(), 'still open, edit still there'

    # "Discard" closes the window and puts everything back: level, experience, HP, stats; the save is not marked as changed
    dlg.locator('button.dialog-x').click(); page.wait_for_selector('dialog.confirm-dialog[open]')
    page.click('dialog.confirm-dialog button:has-text("Discard")')
    page.wait_for_selector('dialog.mon-dialog', state='detached'); page.wait_for_selector('dialog.confirm-dialog', state='detached')
    assert level() == 'Lv 28', level()
    assert page.locator('.save-btn.dirty').count() == 0, 'a discarded edit is not a change'
    dlg = open_first()
    assert dlg.locator('label.field:has-text("Level") input').input_value() == '28'
    assert dlg.locator('label.field:has(.field-label:text-is("Experience")) input').input_value() == '21952'
    assert '62/62' in dlg.locator('.stats').inner_text()
    dlg.locator('button.dialog-x').click(); page.wait_for_selector('dialog.mon-dialog', state='detached')

    # Done keeps an edit (and marks the save as changed)
    dlg = open_first()
    lvl = dlg.locator('label.field:has-text("Level") input'); lvl.fill('29'); lvl.dispatch_event('change')
    dlg.locator('button.primary').click(); page.wait_for_selector('dialog.mon-dialog', state='detached')
    assert level() == 'Lv 29' and page.locator('.save-btn.dirty').count() == 1

    # Escape keeps edits too, as it always has
    dlg = open_first()
    lvl = dlg.locator('label.field:has-text("Level") input'); lvl.fill('30'); lvl.dispatch_event('change')
    page.keyboard.press('Escape'); page.wait_for_selector('dialog.mon-dialog', state='detached')
    assert level() == 'Lv 30', level()
    ctx.close(); b.close()


with sync_playwright() as p:
    check(p, 'desktop', {'width': 1280, 'height': 800})
    check(p, 'phone', {'width': 360, 'height': 740})
print('ERRORS:', errors or 'none')
