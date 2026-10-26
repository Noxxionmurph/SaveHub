"""Gold / Silver: a made-up Gold save (e2e/make-fixtures.ts), every tab, the Pokémon window's Gen 2 parts (gender, shiny,
Unown's letter, eggs, held items), the PC's rules (Mail, a party that can battle) and the saved file's checksums."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []

def sum16(b, start, end):
    return sum(b[start:end]) & 0xffff

def checksums_ok(b):
    main = sum16(b, 0x2009, 0x2d69) == b[0x2d69] | (b[0x2d6a] << 8) and b[0x2d6b] == 127
    backup = b[0x7e6d] | (b[0x7e6e] << 8) == sum16(b, 0x2009, 0x2d69) and b[0x7e6f] == 127
    return main and backup

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 400, 'height': 860}, accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    page.goto(BASE)

    with page.expect_file_chooser() as fc:
        page.click('.slot')
    fc.value.set_files(f'{SP}/gold.sav')
    page.wait_for_selector('.tabs')
    assert page.get_attribute('html', 'data-console') == 'gbc'
    assert page.inner_text('.file-line').startswith('gold.sav')
    assert page.locator('.version-pick button').count() == 2     # Gold / Silver: the file can't say which
    page.click('.version-pick button:has-text("Gold")')
    assert page.inner_text('.game-name') == 'Pokémon Gold', page.inner_text('.game-name')
    assert page.locator('.player-gender').count() == 0            # Crystal only
    assert page.input_value('label.field:has-text("Trainer name") input') == 'GOLD'
    page.screenshot(path=f'{SP}/g1-trainer.png', full_page=True)

    # --- trainer: badges and options
    page.click('button:has-text("All Johto")')
    assert page.locator('.tcard-badges').first.locator('.badge-slot.earned').count() == 8
    page.click('.opt-row:has(.opt-label:text-is("Text speed")) label:has-text("Fast")')
    page.click('.opt-row:has(.opt-label:text-is("Sound")) label:has-text("Stereo")')
    frame = page.locator('.opt-row:has(.opt-label:text-is("Frame"))')
    frame0 = frame.locator('output').inner_text()
    frame.locator('button[aria-label="Previous frame"]').click()      # steps round: from TYPE 1 back to TYPE 8
    frame.locator('button[aria-label="Next frame"]').click(); frame.locator('button[aria-label="Next frame"]').click()
    frame_now = int(frame.locator('output').inner_text().split()[-1])
    assert frame_now == int(frame0.split()[-1]) % 8 + 1, (frame0, frame_now)
    assert page.locator('.save-btn.dirty').count() == 1

    # --- bag: every pocket is there, TM counts
    page.click('button.tab:has-text("Bag")')
    gap = page.evaluate("() => { const c = document.querySelector('.panel .two-col'); return c.nextElementSibling.getBoundingClientRect().top - c.getBoundingClientRect().bottom; }")
    assert gap >= 12, f'TM/HM card touches the pockets above it ({gap}px)'
    for pocket in ['Items pocket', 'Balls pocket', 'Key Items pocket', 'PC item storage', 'TM/HM pocket']:
        assert page.locator(f'h3:has-text("{pocket}")').count() >= 1, pocket
    page.fill('input[aria-label="TM01 count"]', '5'); page.press('input[aria-label="TM01 count"]', 'Tab')
    held_tms = sum(1 for v in page.locator('.tm-row input').evaluate_all('els => els.map(e => e.value)') if v != '0')
    page.check('.tm-only input')
    assert page.locator('.tm-row:visible').count() == 57 - held_tms and not page.locator('input[aria-label="TM01 count"]').is_visible()
    page.uncheck('.tm-only input')
    assert page.locator('.tm-row:visible').count() == 57
    page.screenshot(path=f'{SP}/g2-bag.png', full_page=True)

    # --- party: gender and shiny marks, an egg, Gen 2 parts of the Pokémon window
    page.click('button.tab:has-text("Party")')
    assert page.locator('.mon').count() == 6
    assert page.locator('.mon').nth(1).locator('.shiny-star').count() == 1           # the red Gyarados
    assert page.locator('.mon').nth(5).locator('.mon-name').inner_text().startswith('Egg')
    page.screenshot(path=f'{SP}/g3-party.png', full_page=True)
    page.locator('.mon-main').nth(3).click()                                          # Gligar
    page.wait_for_selector('dialog.mon-dialog[open]')
    assert page.locator('dialog .stats.six dt').count() == 6
    # checkboxes in the window are checkbox-sized, not the 36px of its text fields (which left a stray strip above them)
    assert page.evaluate("() => [...document.querySelectorAll('dialog[open] input[type=checkbox]')].every(e => e.getBoundingClientRect().height <= 22)")
    page.click('dialog .shiny-toggle input')
    assert page.locator('dialog h2 .shiny-star').count() == 1
    page.select_option('dialog label.field:has-text("Gender") select', 'female')
    assert page.locator('dialog h2 .gender.female').count() == 1
    assert page.locator('dialog h2 .shiny-star').count() == 1                       # still shiny
    held = page.locator('dialog .field:has-text("Held item") select')
    held.focus()                                                                      # the list fills on first use
    held.select_option(label='Leftovers')
    page.click('dialog.mon-dialog button.primary')
    page.locator('.mon-main').nth(4).click()                                          # Unown
    page.wait_for_selector('dialog.mon-dialog[open]')
    page.select_option('dialog label.field:has-text("Unown letter") select', 'V')
    assert 'letter V' in page.inner_text('dialog .mon-head')
    page.click('dialog.mon-dialog button.primary')
    page.locator('.mon-main').nth(5).click()                                          # the egg
    page.wait_for_selector('dialog.mon-dialog[open]')
    assert page.locator('dialog label.field:has-text("Egg cycles left")').count() == 1
    assert page.locator('dialog h3:has-text("Looks")').count() == 0
    page.screenshot(path=f'{SP}/g4-egg.png')
    page.click('dialog.mon-dialog button.primary')

    # --- boxes: 14 named boxes, rename one
    page.click('button.tab:has-text("Boxes")')
    assert page.locator('.box-nav select option').count() == 14
    assert 'JOHTO' in page.eval_on_selector('.box-nav select', 'e => e.selectedOptions[0].textContent')
    page.fill('label.box-name input', 'TEAM')
    page.press('label.box-name input', 'Tab')
    assert 'TEAM' in page.eval_on_selector('.box-nav select', 'e => e.selectedOptions[0].textContent')

    # --- Pokédex: 251 entries
    page.click('button.tab:has-text("Pokédex")')
    assert page.locator('.dex-tile').count() == 251

    # --- review, save, check the bytes
    page.click('.save-btn')
    page.wait_for_selector('dialog.review-dialog[open]')
    text = page.text_content('dialog.review-dialog')
    for want in ['Badges earned: Mineral, Storm, Glacier, Rising', 'TEAM', 'now shiny, now female', 'now letter V']:
        assert want in text, (want, text)
    page.screenshot(path=f'{SP}/g5-review.png')
    with page.expect_download() as dl:
        page.click('dialog.review-dialog button.primary')
    dl.value.save_as(f'{SP}/g-edited.sav')
    data = open(f'{SP}/g-edited.sav', 'rb').read()
    assert len(data) == 32768 and checksums_ok(data)
    assert data[0x23e4] == 0xff                     # all Johto badges
    assert data[0x2000] & 7 == 1 and data[0x2000] & 0x20   # Fast text, stereo
    assert data[0x2002] & 7 == frame_now - 1           # Frame, as stepped to
    assert data[0x23e6] == 5                        # five TM01
    gligar = 0x288a + 8 + 3 * 48
    assert data[gligar] == 207 and data[gligar + 1] == 0x92          # Gligar holding Leftovers
    atk, de, sp, sc = data[gligar + 21] >> 4, data[gligar + 21] & 15, data[gligar + 22] >> 4, data[gligar + 22] & 15
    assert (de, sp, sc) == (10, 10, 10) and atk & 2, (atk, de, sp, sc)  # shiny
    assert ((atk << 4) | sp) <= 127, atk           # female (Gligar's ratio is 50% female: 127)
    assert data[0x2727:0x272c] == bytes([0x93, 0x84, 0x80, 0x8c, 0x50])  # TEAM
    assert page.locator('.save-btn.dirty').count() == 0

    # --- the party keeps a Pokémon that can battle: with only the egg left, the last one stays
    page.click('button.tab:has-text("Party")')
    for _ in range(4):
        page.locator('.mon').nth(0).locator('button[aria-label^="Actions for"]').click()
        page.click('dialog.sheet-dialog button:has-text("Move to")')
        page.locator('dialog.sheet-dialog button.dest:has-text("Box 3")').first.click()
        page.wait_for_selector('dialog.sheet-dialog', state='detached')
    assert page.locator('.mon').count() == 2        # one Pokémon and the egg
    page.locator('.mon').nth(0).locator('button[aria-label^="Actions for"]').click()
    page.click('dialog.sheet-dialog button:has-text("Move to")')
    assert page.locator('dialog.sheet-dialog button.dest:not([disabled])').count() == 0
    assert 'can battle' in page.inner_text('dialog.sheet-dialog')
    page.click('dialog.sheet-dialog button:has-text("Back")')
    page.click('dialog.sheet-dialog button:has-text("Close")')
    # the egg itself can still go
    page.locator('.mon').nth(1).locator('button[aria-label^="Actions for"]').click()
    page.click('dialog.sheet-dialog button:has-text("Move to")')
    page.locator('dialog.sheet-dialog button.dest:has-text("Box 3")').first.click()
    page.wait_for_selector('dialog.sheet-dialog', state='detached')
    assert page.locator('.mon').count() == 1
    b.close()
print('ERRORS:', errors or 'none')
