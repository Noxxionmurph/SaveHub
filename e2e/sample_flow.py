import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []

def checksum_ok(b):
    return b[0x3523] == (~sum(b[0x2598:0x3523])) & 0xff

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 400, 'height': 860}, accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    page.goto(BASE)

    # --- sample save from the landing page
    assert page.locator('.sample-row button').first.inner_text() == 'Try a Red / Blue / Yellow sample'
    page.screenshot(path=f'{SP}/c1-welcome.png')
    page.click('.sample-row button')
    page.wait_for_selector('.tabs')
    assert 'made-up sample' in page.inner_text('.sample-note')
    assert page.inner_text('.file-line').startswith('sample.sav')
    assert page.locator('.save-btn.dirty').count() == 0
    assert page.input_value('label.field:has-text("Trainer name") input') == 'ASH'

    # --- empty review: nothing edited yet
    page.click('.save-btn')
    page.wait_for_selector('dialog.review-dialog[open]')
    assert 'No changes yet' in page.inner_text('dialog.review-dialog h2')
    page.click('dialog.review-dialog button:has-text("Cancel")')
    page.wait_for_selector('dialog.review-dialog', state='detached')

    # --- trainer tab: options card + dirty dot
    page.screenshot(path=f'{SP}/c2-trainer.png', full_page=True)
    page.click('.opt-row:has(.opt-label:text-is("Text speed")) label:has-text("Fast")')
    page.click('.opt-row:has(.opt-label:text-is("Battle animations")) label:has-text("Off")')
    assert page.locator('.save-btn.dirty').count() == 1
    assert 'unsaved' in page.get_attribute('.save-btn', 'aria-label')

    # --- party: action sheet, move to a box
    page.click('button.tab:has-text("Party")')
    assert page.locator('.mon').count() == 6
    page.screenshot(path=f'{SP}/c3-party.png', full_page=True)
    names = lambda: page.locator('.mon-name').all_inner_texts()
    assert names()[0].startswith('SPARKY') and names()[1].startswith('Charmeleon')
    assert page.locator('.mon').nth(0).locator('button[aria-label$="up"]').is_disabled()
    assert page.locator('.mon').nth(5).locator('button[aria-label$="down"]').is_disabled()
    page.locator('.mon').nth(0).locator('button[aria-label$="down"]').click()
    assert names()[0].startswith('Charmeleon') and names()[1].startswith('SPARKY')
    assert page.evaluate("document.activeElement.getAttribute('aria-label')").startswith('Move SPARKY down')   # focus follows
    page.locator('.mon').nth(1).locator('button[aria-label$="up"]').click()
    assert names()[0].startswith('SPARKY')
    page.locator('.mon').nth(5).locator('button[aria-label^="Actions for"]').click()   # Magikarp
    page.wait_for_selector('dialog.sheet-dialog[open]')
    page.screenshot(path=f'{SP}/c4-sheet.png')
    assert page.locator('dialog.sheet-dialog button:has-text("Earlier")').count() == 0   # party uses the arrows
    page.click('dialog.sheet-dialog button:has-text("Move to")')
    page.screenshot(path=f'{SP}/c5-dest.png')
    page.click('dialog.sheet-dialog button.dest:has-text("Box 3")')
    page.wait_for_selector('dialog.sheet-dialog', state='detached')
    assert page.locator('.mon').count() == 5

    # --- boxes: grid, paging, duplicate
    page.click('button.tab:has-text("Boxes")')
    assert page.locator('.box-grid .box-cell').count() == 20
    assert page.locator('.box-grid .box-cell:not(.empty):not(.add)').count() == 5     # box 1 has 5 Pokémon
    page.screenshot(path=f'{SP}/c6-boxes.png', full_page=True)
    page.click('button[aria-label="Next box"]'); page.click('button[aria-label="Next box"]')
    assert 'Box 3' in page.eval_on_selector('.box-nav select', 'e => e.selectedOptions[0].textContent')
    assert page.locator('.box-grid .box-cell:not(.empty):not(.add)').count() == 1     # the Magikarp
    page.click('.box-grid .box-cell:not(.empty):not(.add)')
    assert page.locator('dialog.sheet-dialog button:has-text("Earlier")').count() == 1   # boxes keep it in the menu
    page.click('dialog.sheet-dialog button:has-text("Duplicate")')
    page.wait_for_selector('dialog.sheet-dialog', state='detached')
    assert page.locator('.box-grid .box-cell:not(.empty):not(.add)').count() == 2
    # add into the first empty slot
    page.click('.box-grid .box-cell.add')
    page.wait_for_selector('dialog.mon-dialog[open]')
    page.click('dialog.mon-dialog button.primary')
    assert page.locator('.box-grid .box-cell:not(.empty):not(.add)').count() == 3

    # --- mon editor: move type icon, PP cap, PP Up bonus, Restore PP
    page.click('button.tab:has-text("Party")')
    page.locator('.mon-main').nth(0).click()
    page.wait_for_selector('dialog.mon-dialog[open]')
    assert page.locator('dialog .move-type:not(.blank)').count() == 4      # Pikachu knows four moves
    rows = page.locator('dialog .move-row')
    assert rows.nth(0).locator('.pp-value').inner_text() == '30'
    assert rows.nth(0).locator('.max-pp').inner_text() == 'Max 30'
    assert rows.nth(0).locator('input').count() == 0          # PP and PP Up are not typed into
    for _ in range(3):
        rows.nth(0).locator('button[aria-label="More PP Ups"]').click()
    assert rows.nth(0).locator('.stepper-value').inner_text() == '3'
    assert rows.nth(0).locator('.pp-value').inner_text() == '48'
    assert rows.nth(0).locator('.max-pp').inner_text() == 'Max 48'
    assert rows.nth(0).locator('button[aria-label="More PP Ups"]').is_disabled()
    rows.nth(0).locator('button[aria-label="Fewer PP Ups"]').click()
    assert rows.nth(0).locator('.pp-value').inner_text() == '42'
    assert rows.nth(0).locator('.max-pp').inner_text() == 'Max 42'
    rows.nth(0).locator('button[aria-label="More PP Ups"]').click()
    page.click('dialog button:has-text("Restore PP")')
    assert rows.nth(0).locator('.pp-value').inner_text() == '48'
    # the PP box and the PP Up box sit on one line, the same height
    pp = rows.nth(0).locator('.pp-value').bounding_box(); st = rows.nth(0).locator('.stepper').bounding_box()
    assert abs((pp['y'] + pp['height'] / 2) - (st['y'] + st['height'] / 2)) < 1, (pp, st)
    # each move takes little room: under 100px
    assert rows.nth(0).bounding_box()['height'] < 100, rows.nth(0).bounding_box()
    page.screenshot(path=f'{SP}/c7-moves.png')
    page.click('dialog.mon-dialog button.primary')

    # --- review the changes, then save and check the bytes
    page.click('.save-btn')
    page.wait_for_selector('dialog.review-dialog[open]')
    text = page.text_content('dialog.review-dialog')     # the words as written; the list's headings are drawn in capitals
    for want in ['Review your changes', 'Options', 'Text speed: Medium → Fast', 'Battle animations: On → Off',
                 'Magikarp: Party 6 → Box 3, slot 1', 'Pokémon', 'Added Magikarp', 'PP changed']:
        assert want in text, (want, text)
    page.screenshot(path=f'{SP}/c8-review.png')
    with page.expect_download() as dl:
        page.click('dialog.review-dialog button.primary')
    dl.value.save_as(f'{SP}/c-edited.sav')
    data = open(f'{SP}/c-edited.sav', 'rb').read()
    assert len(data) == 32768 and checksum_ok(data)
    assert data[0x2601] == 0x81, hex(data[0x2601])
    assert page.locator('.save-btn.dirty').count() == 0
    assert 'Saved sample-edited.sav' in page.inner_text('#toast')

    # --- last party member cannot leave
    page.click('button.tab:has-text("Party")')
    for _ in range(4):
        page.locator('.mon').nth(0).locator('button[aria-label^="Actions for"]').click()
        page.click('dialog.sheet-dialog button:has-text("Move to")')
        page.locator('dialog.sheet-dialog button.dest:has-text("Box 4")').first.click()
        page.wait_for_selector('dialog.sheet-dialog', state='detached')
    assert page.locator('.mon').count() == 1
    page.locator('.mon').nth(0).locator('button[aria-label^="Actions for"]').click()
    page.click('dialog.sheet-dialog button:has-text("Move to")')
    assert page.locator('dialog.sheet-dialog button.dest:not([disabled])').count() == 0
    assert 'only party' in page.inner_text('dialog.sheet-dialog')
    assert 'null' not in page.inner_text('dialog.sheet-dialog')
    page.click('dialog.sheet-dialog button:has-text("Back")')
    page.click('dialog.sheet-dialog button.danger')
    assert 'at least one' in page.inner_text('dialog.sheet-dialog .sheet-note')
    assert 'null' not in page.inner_text('dialog.sheet-dialog')
    assert page.locator('.mon').count() == 1
    b.close()
print('ERRORS:', errors or 'none')
