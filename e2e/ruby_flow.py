"""Ruby / Sapphire and Emerald: made-up saves (e2e/make-fixtures.ts, and the landing page's Emerald sample), every tab,
the Pokémon window's Gen 3 parts (nature, gender, shiny, Unown's form, IVs and EVs, origin), a box with gaps, and the saved file's sector checksums."""
import struct
import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []

RS_SIZES = [0x890, 3968, 3968, 3968, 0x3ac0 - 3 * 3968] + [3968] * 8 + [2000]
EM_SIZES = [0xf2c, 3968, 3968, 3968, 0x3d88 - 3 * 3968] + [3968] * 8 + [2000]


def sectors(b, sizes):
    """The newest slot's sectors by id, after checking every signature and checksum."""
    best = None
    for slot in (0, 1):
        found = {}
        for s in range(14):
            at = slot * 0xe000 + s * 0x1000
            sid, chk, sig, cnt = struct.unpack_from('<HHII', b, at + 0xff4)
            if sig != 0x08012025 or sid > 13:
                break
            n = sizes[sid]
            total = sum(struct.unpack_from(f'<{n // 4}I', b, at)) & 0xffffffff
            assert chk == ((total >> 16) + total) & 0xffff, f'sector {sid} checksum'
            found[sid] = at
        if len(found) == 14 and (best is None or cnt > best[0]):
            best = (cnt, found)
    assert best, 'no complete slot'
    return best[1]


def open_file(page, name):
    with page.expect_file_chooser() as fc:
        page.click('.slot')
    fc.value.set_files(f'{SP}/{name}')
    page.wait_for_selector('.tabs')


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 400, 'height': 860}, accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)

    # --- Emerald is recognised on its own, in the GBA theme
    page.goto(BASE)
    open_file(page, 'emerald.sav')
    assert page.get_attribute('html', 'data-console') == 'gba'
    assert page.inner_text('.game-name') == 'Pokémon Emerald', page.inner_text('.game-name')
    assert page.locator('.version-pick button').count() == 0

    # --- the landing page's Emerald sample is the same made-up save
    page.goto(BASE)
    page.click('.sample-row button:has-text("Emerald")')
    page.wait_for_selector('.tabs')
    assert page.get_attribute('html', 'data-console') == 'gba'
    assert page.inner_text('.game-name') == 'Pokémon Emerald'
    assert page.inner_text('.file-line').startswith('sample-emerald.sav')
    frontier = page.locator('section.card.frontier')                                 # Emerald's Battle Frontier card
    frontier.locator('label.field:has-text("Battle Points") input').fill('500')
    frontier.locator('label.field:has-text("Battle Points") input').press('Tab')
    frontier.locator('button:has-text("All gold symbols")').click()
    assert page.locator('section.card.frontier .badge-btn[data-metal="gold"]').count() == 7
    page.click('section.card.frontier .badge-btn:has-text("Tower")')                  # gold goes back to none
    assert page.get_attribute('section.card.frontier .badge-btn:has-text("Tower")', 'data-metal') == 'none'
    page.click('section.card.frontier .badge-btn:has-text("Tower")')                  # then silver
    assert page.get_attribute('section.card.frontier .badge-btn:has-text("Tower")', 'data-metal') == 'silver'
    assert 'silver-1.png' in page.get_attribute('section.card.frontier .badge-btn:has-text("Tower") img', 'src')
    stats = page.locator('section.card.game-stats')                                    # the game's counters
    stats.locator('summary:has-text("Getting around")').click()
    stats.locator('label.field:has-text("Steps") input').fill('4321')
    stats.locator('label.field:has-text("Steps") input').press('Tab')
    stats.locator('label.field:has-text("Hours") input').fill('7')
    stats.locator('label.field:has-text("Hours") input').press('Tab')
    assert stats.locator('label.field:has-text("Berry Crush games")').count() == 1   # Emerald only
    page.screenshot(path=f'{SP}/e-stats.png', full_page=True)
    page.click('button.tab:has-text("Party")')
    assert page.locator('.mon').count() == 5
    page.click('.save-btn')
    page.wait_for_selector('dialog.review-dialog[open]')
    text = page.text_content('dialog.review-dialog')
    assert 'Battle Points: 0 → 500' in text and 'Battle Pyramid symbol: none → gold' in text and 'Battle Tower symbol: none → silver' in text, text
    assert 'Steps: 0 → 4,321' in text and 'First Hall of Fame time: none → 7:00:00' in text, text
    page.keyboard.press('Escape')

    # --- Ruby / Sapphire: the file can't say which
    page.goto(BASE)
    open_file(page, 'ruby.sav')
    assert page.locator('.version-pick button').count() == 2
    page.click('.version-pick button:has-text("Sapphire")')
    assert page.inner_text('.game-name') == 'Pokémon Sapphire'
    assert page.locator('section.card.frontier').count() == 0                          # no Battle Frontier in Ruby / Sapphire
    assert page.locator('section.card.game-stats label.field:has-text("Pokémon caught fishing")').count() == 1
    assert page.locator('section.card.game-stats label.field:has-text("Berry Crush games")').count() == 0
    assert page.input_value('label.field:has-text("Trainer name") input') == 'MAY'
    assert page.locator('.tcard-badges .badge-slot.earned').count() == 4
    page.screenshot(path=f'{SP}/r1-trainer.png', full_page=True)

    # --- trainer: badges, money, National Dex, options
    page.click('button:has-text("All badges")')
    assert page.locator('.tcard-badges .badge-slot.earned').count() == 8
    page.fill('label.field:has-text("Money") input', '777777'); page.press('label.field:has-text("Money") input', 'Tab')
    page.check('label.check-row:has-text("National Pokédex") input')
    page.click('.opt-row:has(.opt-label:text-is("Text speed")) label:has-text("Fast")')
    page.click('.opt-row:has(.opt-label:text-is("Button mode")) label:has-text("L=A")')
    frame = page.locator('.opt-row:has(.opt-label:text-is("Frame"))')
    frame.locator('button[aria-label="Previous frame"]').click()        # from TYPE 1 round to TYPE 20
    assert frame.locator('output').inner_text().split()[-1] == '20'

    # --- bag: five pockets, TMs, berries
    page.click('button.tab:has-text("Bag")')
    for pocket in ['Items pocket', 'Poké Balls pocket', 'Key Items pocket', 'Berries pocket', 'PC item storage', 'TMs & HMs pocket']:
        assert page.locator(f'h3:has-text("{pocket}")').count() >= 1, pocket
    assert page.locator('.tm-row').count() == 58
    page.fill('input[aria-label="TM26 count"]', '3'); page.press('input[aria-label="TM26 count"]', 'Tab')
    berries = page.locator('section.card:has(h3:has-text("Berries pocket"))')
    berries.locator('.item-row input').first.fill('500'); berries.locator('.item-row input').first.press('Tab')
    page.screenshot(path=f'{SP}/r2-bag.png', full_page=True)

    # --- party: the shiny Gardevoir, the egg, Unown's !
    page.click('button.tab:has-text("Party")')
    assert page.locator('.mon').count() == 5
    assert page.locator('.mon').nth(1).locator('.shiny-star').count() == 1
    assert page.locator('.mon').nth(3).locator('.mon-name').inner_text().startswith('Egg')
    page.screenshot(path=f'{SP}/r3-party.png', full_page=True)
    page.locator('.mon-main').nth(0).click()                                       # BLAZE the Blaziken
    page.wait_for_selector('dialog.mon-dialog[open]')
    assert 'Adamant' in page.inner_text('dialog .mon-head')
    assert page.locator('dialog .stats .nature-up').count() == 1 and page.locator('dialog .stats .nature-down').count() == 1
    page.select_option('dialog label.field:has-text("Nature") select', '13')       # Jolly
    assert 'Jolly' in page.inner_text('dialog .mon-head')
    page.click('dialog .shiny-toggle input')
    assert page.locator('dialog h2 .shiny-star').count() == 1
    assert 'Jolly' in page.inner_text('dialog .mon-head')                          # the nature stays
    page.click('dialog button:has-text("Max IVs")')
    page.fill('dialog .evs label.field:has-text("Spe") input', '252')
    page.press('dialog .evs label.field:has-text("Spe") input', 'Tab')
    assert '252/510' in page.inner_text('dialog h3:has-text("EVs")')
    page.click('dialog .ribbon-btn[title="Cool Ribbon, Super Rank"]')                # a contest rank brings the ones below it
    page.click('dialog .ribbon-btn:has-text("Champion")')
    assert page.inner_text('dialog .ribbons h3 .count') == '3'
    assert page.get_attribute('dialog .ribbon-btn[title="Cool Ribbon, Normal Rank"]', 'aria-pressed') == 'true'
    page.screenshot(path=f'{SP}/r4-mon.png')
    page.click('dialog.mon-dialog button.primary')
    page.locator('.mon-main').nth(4).click()                                       # Unown
    page.wait_for_selector('dialog.mon-dialog[open]')
    assert 'form !' in page.inner_text('dialog .mon-head')
    page.select_option('dialog label.field:has-text("Unown form") select', '?')
    assert 'form ?' in page.inner_text('dialog .mon-head')
    page.click('dialog.mon-dialog button.primary')
    page.locator('.mon-main').nth(3).click()                                       # the egg
    page.wait_for_selector('dialog.mon-dialog[open]')
    assert page.locator('dialog label.field:has-text("Egg cycles left")').count() == 1
    page.click('dialog.mon-dialog button.primary')

    # --- boxes: 30 spots with a gap; adding into the gap puts it there
    page.click('button.tab:has-text("Boxes")')
    assert page.locator('.box-nav select option').count() == 14
    assert page.locator('.box-grid .box-cell').count() == 30
    cells = page.locator('.box-grid .box-cell')
    assert 'add' in cells.nth(2).get_attribute('class')                             # the gap at spot 3
    assert cells.nth(3).get_attribute('data-pick') is not None                      # Azumarill after it
    page.screenshot(path=f'{SP}/r5-boxes.png', full_page=True)
    cells.nth(2).click()
    page.wait_for_selector('dialog.mon-dialog[open]')
    page.click('dialog.mon-dialog button.primary')
    page.wait_for_selector('dialog.mon-dialog', state='detached')
    assert page.locator('.box-grid .box-cell').nth(2).get_attribute('data-pick') is not None
    page.fill('label.box-name input', 'HOENN')
    page.press('label.box-name input', 'Tab')

    # --- Pokédex: 386 entries
    page.click('button.tab:has-text("Pokédex")')
    assert page.locator('.dex-tile').count() == 386

    # --- review, save, check the bytes
    page.click('.save-btn')
    page.wait_for_selector('dialog.review-dialog[open]')
    text = page.text_content('dialog.review-dialog')
    for want in ['HOENN', 'Jolly', 'ribbons added: Cool Super, Champion']:
        assert want in text, (want, text)
    page.screenshot(path=f'{SP}/r6-review.png')
    with page.expect_download() as dl:
        page.click('dialog.review-dialog button.primary')
    dl.value.save_as(f'{SP}/r-edited.sav')
    data = open(f'{SP}/r-edited.sav', 'rb').read()
    assert len(data) == 131072
    sec = sectors(data, RS_SIZES)
    sb2, sb1 = sec[0], sec[1]
    assert data[sb2 + 0x14] & 7 == 2                                                # Fast text
    assert data[sb2 + 0x13] == 2                                                    # L=A
    assert (data[sb2 + 0x14] >> 3) & 31 == 19                                       # Frame type 20
    assert data[sb2 + 0x1a] == 0xda                                                 # National Dex unlocked
    assert struct.unpack_from('<I', data, sb1 + 0x490)[0] == 777777
    assert page.locator('.save-btn.dirty').count() == 0
    b.close()
print('ERRORS:', errors or 'none')
