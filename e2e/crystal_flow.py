"""Crystal: the sample save from the landing page, what Crystal adds (the player's gender, its key items, where each
Pokémon was caught), and the saved file's checksums, backup and gender byte."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []


def checksums_ok(b):
    total = sum(b[0x2009:0x2b83]) & 0xffff
    main = total == b[0x2d0d] | (b[0x2d0e] << 8) and b[0x2008] == 99 and b[0x2d0f] == 127
    backup = total == b[0x1f0d] | (b[0x1f0e] << 8) and b[0x1208] == 99 and b[0x1f0f] == 127
    return main and backup and b[0x1209:0x1d83] == b[0x2009:0x2b83]


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 400, 'height': 860}, accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    page.goto(BASE)
    assert page.locator('.tile:has-text("Crystal") img.tile-icon').count() == 1, 'Crystal tile'

    page.click('.sample-row button:has-text("Crystal")')
    page.wait_for_selector('.tabs')
    assert page.get_attribute('html', 'data-console') == 'gbc'
    assert page.inner_text('.game-name') == 'Pokémon Crystal', page.inner_text('.game-name')
    assert page.locator('.version-pick button').count() == 0                # nothing to ask: the file says Crystal
    assert page.inner_text('.file-line').startswith('sample-crystal.sav')
    assert page.input_value('label.field:has-text("Trainer name") input') == 'KRIS'

    # --- the trainer card's figures don't run into each other (POKÉDEX is the longest label), and the egg in the party
    # strip says Egg once, with its picture in line with the others
    gaps = page.evaluate("() => { const d = [...document.querySelectorAll('.tcard-stats dt')].map(e => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect(); }); return d.slice(1).map((r, i) => r.left - d[i].right); }")
    assert min(gaps) >= 8, f'trainer card labels too close: {gaps}'
    egg = page.locator('.party-slot').nth(5)
    assert egg.locator('.slot-name').inner_text() == 'Egg' and egg.locator('.lv-tag').count() == 0
    tops = page.evaluate("() => [...document.querySelectorAll('.party-slot')].map(s => Math.round(s.querySelector('.slot-name').getBoundingClientRect().top - s.getBoundingClientRect().top))")
    assert max(tops) - min(tops) <= 5, f'party pictures out of line: {tops}'   # names (right under the pictures) sit at one height
    # the shiny Gyarados (party 2) carries the shiny mark wherever it is previewed
    assert [page.locator('.party-slot').nth(i).locator('.shiny-star').count() for i in range(6)] == [0, 1, 0, 0, 0, 0]
    # held items show on the pictures here too (BLAZE holds Charcoal)
    assert page.locator('.party-slot').nth(0).locator('.mon-pic .held').get_attribute('data-name') == 'Charcoal'
    page.click('button.tab:has-text("Boxes")')
    assert page.locator('.box-cell').nth(0).locator('.mon-pic .held').get_attribute('data-name') == 'Charcoal'
    page.locator('.box-cell').nth(1).click()
    assert page.locator('dialog .sheet-head h2 .shiny-star').count() == 1
    page.keyboard.press('Escape')
    page.locator('.box-cell').nth(0).click()
    assert page.locator('dialog .sheet-head h2 .shiny-star').count() == 0
    page.keyboard.press('Escape')

    # --- party cards: types are the in-game labels, and a held item sits on the picture, named when hovered
    page.click('button.tab:has-text("Party")')
    first = page.locator('.mon').nth(0)
    assert first.locator('.mon-types img.type-label').evaluate_all('es => es.map(e => e.alt)') == ['Fire']
    assert first.locator('.mon-meta .held').count() == 0 and first.locator('.mon-pic .held').get_attribute('data-name') == 'Charcoal'
    first.locator('.mon-pic .held').hover()
    page.wait_for_timeout(200)
    assert page.evaluate("() => getComputedStyle(document.querySelector('.mon-pic .held'), '::after').display") == 'block'
    page.click('button.tab:has-text("Trainer")')

    # --- trainer: play as the boy instead
    row = page.locator('.player-gender .opt-row')
    assert row.locator('input[value="girl"]').is_checked()
    row.locator('label:has-text("Boy")').click()
    assert page.locator('.save-btn.dirty').count() == 1
    page.screenshot(path=f'{SP}/c-trainer.png', full_page=True)

    # --- bag: Crystal's own key items are offered, and the sample has the Blue Card
    page.click('button.tab:has-text("Bag")')
    keys = page.locator('section:has(h3:has-text("Key Items pocket")) select')
    assert 'Blue Card' in [keys.nth(i).evaluate('s => s.selectedOptions[0].textContent') for i in range(keys.count())]
    keys.first.focus()                                                # the list fills on first use
    offered = keys.first.evaluate('s => [...s.options].map(o => o.textContent)')
    for name in ['Clear Bell', 'GS Ball', 'Egg Ticket']:
        assert name in offered, (name, offered)
    keys.first.select_option(label='GS Ball')

    # --- party: where the shiny Gyarados was caught, then move it
    page.click('button.tab:has-text("Party")')
    page.locator('.mon-main').nth(1).click()
    page.wait_for_selector('dialog.mon-dialog[open]')
    assert page.locator('dialog h3:has-text("Where it was caught")').count() == 1
    place = page.locator('dialog label.field:has-text("Place") select')
    assert place.evaluate('s => s.selectedOptions[0].textContent') == 'Lake of Rage'
    assert page.input_value('dialog label.field:has-text("Level when caught") input') == '30'
    place.select_option(label='Route 43')
    page.select_option('dialog label.field:has-text("Time of day") select', 'morning')
    page.screenshot(path=f'{SP}/c-caught.png')
    page.click('dialog.mon-dialog button.primary')

    # --- review, save, check the bytes
    page.click('.save-btn')
    page.wait_for_selector('dialog.review-dialog[open]')
    text = page.text_content('dialog.review-dialog')
    for want in ['Plays as: girl → boy', 'Added GS Ball', 'where it was caught changed']:
        assert want in text, (want, text)
    with page.expect_download() as dl:
        page.click('dialog.review-dialog button.primary')
    dl.value.save_as(f'{SP}/c-edited.sav')
    data = open(f'{SP}/c-edited.sav', 'rb').read()
    assert len(data) == 32768 and checksums_ok(data)
    assert data[0x3e3d] & 1 == 0                                      # plays as the boy
    assert 0x73 in data[0x244b:0x244b + data[0x244a]]                 # GS Ball in the Key Items pocket
    gyarados = 0x2865 + 8 + 48
    assert data[gyarados] == 130
    assert data[gyarados + 29] == (1 << 6) | 30, hex(data[gyarados + 29])   # morning, level 30
    assert data[gyarados + 30] == 0x80 | 0x25, hex(data[gyarados + 30])     # caught by a girl, Route 43
    b.close()
print('ERRORS:', errors or 'none')
