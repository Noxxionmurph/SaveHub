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
    assert frontier.locator('details.fold').get_attribute('open') is None             # long Gen 3 cards start folded
    frontier.locator('details.fold > summary').click()
    frontier.locator('label.field:has-text("Battle Points") input').fill('500')
    frontier.locator('label.field:has-text("Battle Points") input').press('Tab')
    frontier.locator('button:has-text("All gold symbols")').click()
    assert page.locator('section.card.frontier .badge-btn[data-metal="gold"]').count() == 7
    page.click('section.card.frontier .badge-btn:has-text("Tower")')                  # gold goes back to none
    assert page.get_attribute('section.card.frontier .badge-btn:has-text("Tower")', 'data-metal') == 'none'
    page.click('section.card.frontier .badge-btn:has-text("Tower")')                  # then silver
    assert page.get_attribute('section.card.frontier .badge-btn:has-text("Tower")', 'data-metal') == 'silver'
    assert 'silver-1.png' in page.get_attribute('section.card.frontier .badge-btn:has-text("Tower") img', 'src')
    frontier.locator('summary:has-text("Battle Tower")').click()                     # streaks and records
    tower = frontier.locator('details.tips:has(summary:text-is("Battle Tower")) .streak-row:has(h5:text-is("Singles · Lv. 50"))')
    tower.locator('label.field:has-text("Win streak") input').fill('48')
    tower.locator('label.field:has-text("Win streak") input').press('Tab')
    assert frontier.locator('.streak-row').count() == 26
    page.screenshot(path=f'{SP}/e-streaks.png', full_page=True)
    roamer = page.locator('section.card.roamer')                                      # the roaming Latios
    roamer.locator('details.fold > summary').click()
    assert roamer.locator('h3').inner_text() == 'Roaming Latios'
    roamer.locator('label.check-row:has-text("Shiny") input').check()
    roamer.locator('button:has-text("Perfect IVs")').click()
    assert roamer.locator('label.check-row:has-text("Shiny") input').is_checked()
    roamer.screenshot(path=f'{SP}/e-roamer.png')
    rematch = page.locator('section.card.rematches')                                   # Match Call rematches
    rematch.locator('details.fold > summary').click()
    rematch.locator('details.tips summary').click()
    assert rematch.locator('label.check-row').count() == 3                            # Rose, Andres, Dusty are registered
    rematch.locator('label.check-row:has-text("Dusty") input').check()
    assert '1/3' in rematch.locator('details.tips summary .count').inner_text()
    stats = page.locator('section.card.game-stats')                                    # the game's counters
    stats.locator('details.fold > summary').click()
    stats.locator('summary:has-text("Getting around")').click()
    stats.locator('label.field:has-text("Steps") input').fill('4321')
    stats.locator('label.field:has-text("Steps") input').press('Tab')
    stats.locator('label.field:has-text("Hours") input').fill('7')
    stats.locator('label.field:has-text("Hours") input').press('Tab')
    assert stats.locator('label.field:has-text("Berry Crush games")').count() == 1   # Emerald only
    page.screenshot(path=f'{SP}/e-stats.png', full_page=True)
    page.click('button.tab:has-text("Bag")')                                         # the Pokéblock case
    page.click('section.pokeblocks details.fold > summary')
    page.click('section.pokeblocks button:has-text("Add Pokéblock")')
    assert page.inner_text('section.pokeblocks h3 .count') == '3/40'                  # the sample has a red and a yellow one
    added = page.locator('section.pokeblocks .pokeblock-row').nth(2)
    assert added.locator('img.pokeblock-icon').get_attribute('src').endswith('pokeblocks/14.png')
    added.locator('select').select_option('9')
    assert added.locator('img.pokeblock-icon').get_attribute('src').endswith('pokeblocks/9.png')
    page.locator('section.pokeblocks').screenshot(path=f'{SP}/e-pokeblocks.png')
    page.click('section.decorations button:has-text("One of every decoration")')     # decorations in the PC
    assert page.inner_text('section.decorations h3 .count') == '120'
    page.click('section.decorations summary:has-text("Dolls")')
    assert page.inner_text('section.decorations summary:has-text("Dolls") .count') == '35/40'
    page.locator('section.decorations').screenshot(path=f'{SP}/e-decorations.png')
    base = page.locator('section.secret-base')                                       # the secret base, set out by tapping
    base.locator('summary').click()
    base.locator('select[aria-label="Secret base spot"]').select_option(label='Route 118 · Red cave (11×9)')
    room = base.locator('canvas.base-room')
    room.wait_for()
    box = room.bounding_box()
    tap = lambda x, y: room.click(position={'x': (x + 0.5) * box['width'] / 11, 'y': (y + 0.5) * box['height'] / 9})
    thumb = lambda name: base.locator(f'.base-thumb[title="{name}"]')                 # the PC's spare decorations

    def drag(press, x, y):                                                            # press on something, let go on tile (x, y)
        press()
        page.mouse.down()
        b = room.bounding_box()
        page.mouse.move(b['x'] + (x + 0.5) * b['width'] / 11, b['y'] + (y + 0.5) * b['height'] / 9, steps=5)
        page.mouse.up()
    thumb('Heavy Desk').click(); tap(4, 5)                                            # 3x2: the tap lands on its middle
    drag(thumb('Pikachu Doll').hover, 7, 6)                                           # dragged in from the strip
    assert 'large desk or mat' in base.locator('.base-note').inner_text()            # dolls don't go on the floor...
    drag(thumb('Pikachu Doll').hover, 3, 4)                                           # ...but on a desk
    thumb('Ball Poster').click(); tap(3, 0)
    assert base.locator('summary .count').inner_text() == '3/16'
    assert room.evaluate('c => c.getContext("2d").getImageData(3 * 16 + 8, 4 * 16 + 8, 1, 1).data[3]') == 255
    base.screenshot(path=f'{SP}/e-secret-base.png')
    drag(lambda: room.hover(position={'x': 4.5 * box['width'] / 11, 'y': 5.5 * box['height'] / 9}), 6, 6)  # move the desk
    tap(5, 5)                                                                         # the doll came along
    assert base.locator('.base-picked').inner_text().startswith('Pikachu Doll')
    tap(5, 5); tap(6, 6)                                                              # pick the desk, put it away: the doll goes too
    assert base.locator('.base-picked').inner_text().startswith('Heavy Desk')
    base.locator('button:has-text("Put away")').click()
    assert base.locator('summary .count').inner_text() == '1/16'
    thumb('Heavy Desk').click(); tap(4, 5)
    page.click('button.tab:has-text("Party")')
    assert page.locator('.mon').count() == 5
    page.click('.save-btn')
    page.wait_for_selector('dialog.review-dialog[open]')
    text = page.text_content('dialog.review-dialog')
    assert 'Battle Points: 0 → 500' in text and 'Battle Pyramid symbol: none → gold' in text and 'Battle Tower symbol: none → silver' in text, text
    assert 'Battle Tower Singles, Lv. 50: current 0 → 48' in text, text
    assert 'Added Lite Blue Pokéblock (Lv. 40, feel 10)' in text, text
    assert 'Latios is now shiny' in text and "Latios's IVs: 20/12/25/31/17/9 → 31/31/31/31/31/31" in text, text
    assert 'Want a rematch: Dusty' in text, text
    assert 'Added Small Desk' in text and 'and 108 more' in text, text
    assert 'New secret base at Route 118 · Red cave (11×9)' in text and 'Set out Heavy Desk' in text and 'Set out Ball Poster' in text, text
    assert 'Steps: 0 → 4,321' in text and 'First Hall of Fame time: none → 7:00:00' in text, text
    page.keyboard.press('Escape')

    # --- Ruby / Sapphire: the file can't say which
    page.goto(BASE)
    open_file(page, 'ruby.sav')
    assert page.locator('.version-pick button').count() == 2
    page.click('.version-pick button:has-text("Sapphire")')
    assert page.inner_text('.game-name') == 'Pokémon Sapphire'
    assert page.locator('section.card.frontier').count() == 0                          # no Battle Frontier in Ruby / Sapphire
    assert page.locator('section.card.roamer').count() == 0                            # no roamer before the Hall of Fame
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
    assert page.locator('section.secret-base').count() == 1                           # Ruby and Sapphire have secret bases too
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
