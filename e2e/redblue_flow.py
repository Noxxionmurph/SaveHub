import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 420, 'height': 900}, accept_downloads=True)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error',) else None)
    page.goto(BASE)
    page.screenshot(path=f'{SP}/1-welcome.png')
    with page.expect_file_chooser() as fc:
        page.click('.slot')
    fc.value.set_files(f'{SP}/rb.sav')
    page.wait_for_selector('.tabs')
    assert page.inner_text('.game-name') == 'Pokémon Red / Blue', page.inner_text('.game-name')
    assert 'Which game is this save from?' in page.inner_text('.version-pick')
    assert page.title() == 'SaveForge'
    page.screenshot(path=f'{SP}/0-ambiguous.png')
    assert page.locator('.version-pick button').count() == 2     # Red / Blue only; Yellow is told apart by the file
    tops = page.evaluate("() => [...document.querySelectorAll('.version-pick button')].map(e => Math.round(e.getBoundingClientRect().top))")
    assert tops[0] == tops[1], f'Red and Blue on different lines: {tops}'
    assert page.locator('.pikachu-card').count() == 0            # no Yellow-only controls on a Red/Blue save
    page.click('.version-pick button:has-text("Blue")')
    assert page.inner_text('.game-name') == 'Pokémon Blue', page.inner_text('.game-name')
    assert page.title() == 'Pokémon Blue · SaveForge', page.title()
    page.screenshot(path=f'{SP}/0-picked.png')
    assert page.input_value('label.field:has-text("Trainer name") input') == 'ASH'
    # Trainer tab: edit money
    page.fill('input[max="999999"]', '123456')
    page.dispatch_event('input[max="999999"]', 'change')
    page.screenshot(path=f'{SP}/2-trainer.png')
    # Bag tab
    page.click('text=Bag')
    assert page.locator('.item-row').count() == 10 + 2   # bag 10 + PC 2
    page.click('text=+ Add item')
    assert page.locator('.item-row').count() == 13
    # Party tab -> open Pikachu editor
    page.click('button.tab:has-text("Party")')
    page.click('.mon-main')
    page.wait_for_selector('dialog[open]')
    page.screenshot(path=f'{SP}/3-editor.png')
    # change level to 30 via the Level field
    lvl = page.locator('dialog .field:has(.field-label:text-is("Level")) input')
    lvl.fill('30'); lvl.dispatch_event('change')
    page.screenshot(path=f'{SP}/4-editor-lvl30.png')
    page.click('dialog button.primary')
    # Boxes tab
    page.click('button.tab:has-text("Boxes")')
    page.click('.box-cell.add')
    page.wait_for_selector('dialog[open]')
    page.click('dialog button.primary')
    # Dex tab
    page.click('button.tab:has-text("Pokédex")')
    page.click('.dex-set button:text-is("Caught")')
    assert page.locator('.dex-summary').get_attribute('aria-label') == 'Seen 151 of 151, caught 151 of 151'
    page.screenshot(path=f'{SP}/5-dex.png')
    page.click('.save-btn')
    page.wait_for_selector('dialog.review-dialog[open]')
    with page.expect_download() as dl:
        page.click('dialog.review-dialog button.primary')
    dl.value.save_as(f'{SP}/edited.sav')
    # --- unknown file -> chooser; then force-open; then bad size -> error
    page.click('text=Close')
    page.wait_for_selector('.slot')
    assert 'supported games' in page.inner_text('.supported').lower()
    assert 'Pokémon Yellow' in page.inner_text('.supported')
    assert page.title() == 'SaveForge', page.title()
    open(f'{SP}/junk.bin','wb').write(bytes(32768))
    with page.expect_file_chooser() as fc:
        page.click('.slot')
    fc.value.set_files(f'{SP}/junk.bin')
    page.wait_for_selector('.error')
    assert "doesn't recognise" in page.inner_text('.error')
    page.screenshot(path=f'{SP}/6-chooser.png')
    page.click('.game-list button')
    page.wait_for_selector('.tabs')          # forced open works for a right-sized file
    page.click('text=Close')
    open(f'{SP}/tiny.bin','wb').write(bytes(100))
    with page.expect_file_chooser() as fc:
        page.click('.slot')
    fc.value.set_files(f'{SP}/tiny.bin')
    page.click('.game-list button')
    page.wait_for_selector('.error')
    assert 'bytes' in page.inner_text('.error'), page.inner_text('.error')
    b.close()
print('ERRORS:', errors or 'none')
