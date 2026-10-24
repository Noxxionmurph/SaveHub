"""A Red/Blue save with the 44-byte footer some emulators add (32,812 bytes): the editor asks which version it is, the
party shows its real levels, and after edits the footer is still there byte for byte and the checksum is fixed."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []
orig = open(f'{SP}/rb-footer.sav', 'rb').read()
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 860}, accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    page.goto(BASE)
    with page.expect_file_chooser() as fc: page.click('.slot')
    fc.value.set_files(f'{SP}/rb-footer.sav')
    page.wait_for_selector('.version-pick, .tabs')
    assert page.locator('.version-pick').count() == 1, 'Red/Blue has to ask'
    page.click('.version-pick button:has-text("Blue")'); page.wait_for_selector('.tabs')
    assert page.inner_text('.game-name') == 'Pokémon Blue', page.inner_text('.game-name')
    assert page.locator('.pikachu-card').count() == 0
    page.screenshot(path=f'{SP}/blue-1-trainer.png')

    # the party shows the real levels, not 0
    page.click('button.tab:has-text("Party")')
    levels = page.locator('.party-list .lcd.lv, .mon .lcd.lv').all_inner_texts()
    assert levels[:6] == ['Lv 28', 'Lv 30', 'Lv 24', 'Lv 20', 'Lv 22', 'Lv 10'], levels
    page.screenshot(path=f'{SP}/blue-2-party.png')

    # open the first Pokémon and lower it to level 10: both level bytes and the stats follow
    page.locator('.mon-main').nth(0).click(); page.wait_for_selector('dialog.mon-dialog[open]')
    dlg = page.locator('dialog.mon-dialog')
    assert 'Lv 28' in dlg.inner_text()
    lvl = dlg.locator('label.field:has-text("Level") input'); lvl.fill('10'); lvl.dispatch_event('change')
    assert 'Lv 10' in dlg.inner_text()
    dlg.locator('button:has-text("Done")').click(); page.wait_for_selector('dialog.mon-dialog', state='detached')

    # trainer tab: money
    page.click('button.tab:has-text("Trainer")')
    money = page.locator('label.field:has-text("Money") input').first; money.fill('9000'); money.dispatch_event('change')

    # move the 2nd party Pokémon into Box 3 through the actions menu
    page.click('button.tab:has-text("Party")')
    page.locator('.mon').nth(1).locator('button[aria-label^="Actions for"]').click(); page.wait_for_selector('dialog.sheet-dialog[open]')
    page.click('dialog.sheet-dialog button:has-text("Move to")'); page.wait_for_timeout(100)
    page.click('dialog.sheet-dialog .dest:has-text("Box 3")'); page.wait_for_selector('dialog.sheet-dialog', state='detached')

    page.click('.save-btn'); page.wait_for_selector('dialog.review-dialog[open]')
    review = page.inner_text('dialog.review-dialog')
    assert 'Money: ¥12,500 → ¥9,000' in review and 'level 28 → 10' in review and 'Charmeleon' in review, review
    with page.expect_download() as dl: page.click('dialog.review-dialog button.primary')
    dl.value.save_as(f'{SP}/blue-edited.sav')
    ctx.close(); b.close()

data = open(f'{SP}/blue-edited.sav', 'rb').read()
assert len(data) == len(orig) == 32812
assert data[32768:] == orig[32768:], 'the emulator footer is kept'
assert data[0x3523] == (~sum(data[0x2598:0x3523])) & 0xff, 'checksum fixed'
assert data[0x25f3:0x25f6] == bytes([0x00, 0x90, 0x00]), data[0x25f3:0x25f6].hex()   # money, BCD 009000
assert any(data[i] != orig[i] for i in range(32768))
print('ERRORS:', errors or 'none')
