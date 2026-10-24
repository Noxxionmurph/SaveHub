"""Pokémon Yellow: the file settles the version, the Pikachu card, the starter check, and an edit changes only the
friendship byte and the checksum. Opens the built-in sample (a made-up Yellow save), or a real save if E2E_YELLOW_SAV
points at one (the checks read the starting values from the page, so they hold for any Yellow save)."""
import sys
from playwright.sync_api import sync_playwright
from lib import BASE, YELLOW
SP = sys.argv[1]
errors = []
SAVE = YELLOW or f'{SP}/sample.sav'
orig = open(SAVE, 'rb').read()
FRIEND = '.pikachu-card .lcd.friend:not(.second) .friend-value'
LABEL = '.pikachu-card .lcd.friend:not(.second) .friend-label'
TID = '.field:has(.field-label:text-is("Trainer ID")) input'


def open_save(page):
    page.goto(BASE)
    with page.expect_file_chooser() as fc:
        page.click('.slot')
    fc.value.set_files(SAVE)
    page.wait_for_selector('.tabs')


with sync_playwright() as p:
    b = p.chromium.launch()
    # the "make starter" fix, on its own page so it doesn't change the bytes checked below
    ctx0 = b.new_context(viewport={'width': 390, 'height': 860})
    pg = ctx0.new_page()
    open_save(pg)
    t0 = pg.locator(TID)
    own_id = t0.input_value()
    t0.fill('4243' if own_id == '4242' else '4242'); t0.dispatch_event('change')
    pg.click('button.tab:has-text("Party")')
    assert 'Not your starter' in pg.locator('.pikachu-card .starter-status').inner_text()
    pg.click('.pikachu-card button:has-text("my starter")')
    assert 'Starter Pikachu' in pg.locator('.pikachu-card .starter-status').inner_text()
    pg.click('.save-btn'); pg.wait_for_selector('dialog.review-dialog[open]')
    assert 'Trainer ID' in pg.inner_text('dialog.review-dialog') and 'starter Pikachu' not in pg.inner_text('dialog.review-dialog')
    ctx0.close()

    for scheme in ('light', 'dark'):
        ctx = b.new_context(viewport={'width': 390, 'height': 860}, accept_downloads=True, color_scheme=scheme)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
        open_save(page)

        # the file settles the version: Yellow, no chips to pick from
        assert page.inner_text('.game-name') == 'Pokémon Yellow', page.inner_text('.game-name')
        assert page.title() == 'Pokémon Yellow · SaveForge', page.title()
        assert page.locator('.version-pick button').count() == 0
        assert 'Which version' not in page.inner_text('.editor-head')

        # Pikachu card: it sits under the party list on the Party tab
        assert page.locator('.pikachu-card').count() == 0, 'not on the Trainer tab'
        page.click('button.tab:has-text("Party")')
        card = page.locator('.pikachu-card')
        assert card.count() == 1
        start = page.locator(FRIEND).inner_text()
        assert start.isdigit() and 0 <= int(start) <= 255 and page.locator(LABEL).inner_text()
        assert 'Starter Pikachu' in card.locator('.starter-status').inner_text()
        page.screenshot(path=f'{SP}/y-{scheme}-1-trainer.png', full_page=True)

        # the party shows one Starter tag, on the first Pokémon
        assert page.locator('.mon').count() == 6
        assert page.locator('.tag.starter').count() == 1
        assert page.locator('.mon').nth(0).locator('.tag.starter').count() == 1
        page.locator('.mon-list').screenshot(path=f'{SP}/y-{scheme}-2-party.png')

        # edit friendship: typing, the label follows, the review lists only that change
        num = page.locator('.pikachu-card input[aria-label="Friendship number"]')
        num.fill('120'); num.dispatch_event('change')
        assert page.locator(FRIEND).inner_text() == '120'
        assert page.locator(LABEL).inner_text() == 'A cute Pokémon'
        assert page.locator('.pikachu-card input[type="range"][aria-label="Friendship"]').input_value() == '120'

        # changing your Trainer ID orphans the starter Pikachu; the card says so, and changing it back repairs it
        page.click('button.tab:has-text("Trainer")')
        tid = page.locator(TID)
        tid.fill('4243' if own_id == '4242' else '4242'); tid.dispatch_event('change')
        page.click('button.tab:has-text("Party")')
        assert 'Not your starter' in card.locator('.starter-status').inner_text()
        page.screenshot(path=f'{SP}/y-{scheme}-3-orphan.png', full_page=True)
        page.click('button.tab:has-text("Trainer")')
        tid.fill(own_id); tid.dispatch_event('change')
        page.click('button.tab:has-text("Party")')
        assert 'Starter Pikachu' in card.locator('.starter-status').inner_text()
        page.click('.pikachu-card button:has-text("Max friendship")')
        assert page.locator(FRIEND).inner_text() == '255'
        num.fill('100'); num.dispatch_event('change')

        # the review shows just the friendship change
        page.click('.save-btn')
        page.wait_for_selector('dialog.review-dialog[open]')
        text = page.inner_text('dialog.review-dialog')
        assert f'Friendship: {start} → 100' in text, text
        page.screenshot(path=f'{SP}/y-{scheme}-4-review.png')
        with page.expect_download() as dl:
            page.click('dialog.review-dialog button.primary')
        dl.value.save_as(f'{SP}/y-edited.sav')
        ctx.close()

    data = open(f'{SP}/y-edited.sav', 'rb').read()
    assert len(data) == len(orig)
    assert data[0x3523] == (~sum(data[0x2598:0x3523])) & 0xff
    changed = [i for i in range(len(data)) if data[i] != orig[i]]
    # only the friendship byte and the checksum differ: nothing else in a Yellow save was touched
    assert 0x271c in changed and data[0x271c] == 100, changed
    assert set(changed) <= {0x271c, 0x3523}, [hex(i) for i in changed]
    b.close()
print('ERRORS:', errors or 'none')
