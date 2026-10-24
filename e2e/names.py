import sys
from playwright.sync_api import sync_playwright
from lib import BASE, YELLOW
SP = sys.argv[1]
errors = []

def name_input(page, label):
    return page.locator(f'label.field:has(.field-label:text-is("{label}")) input')

def warn_of(page, label):
    w = page.locator(f'label.field:has(.field-label:text-is("{label}")) .field-hint.warn')
    return w.inner_text() if w.is_visible() else ''

with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ('light', 'dark'):
        ctx = b.new_context(viewport={'width': 390, 'height': 860}, accept_downloads=True, color_scheme=scheme)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        page.goto(BASE); page.click('.sample-row button'); page.wait_for_selector('.tabs')
        tn = name_input(page, 'Trainer name')
        assert warn_of(page, 'Trainer name') == ''
        tn.fill('Zoë@'); assert warn_of(page, 'Trainer name') == 'The game can’t show “ë” “@”. They are saved as “?”.', warn_of(page, 'Trainer name')
        page.screenshot(path=f'{SP}/n-{scheme}-warn.png', clip={'x': 0, 'y': 300, 'width': 390, 'height': 420})
        tn.fill('Ash?'); assert warn_of(page, 'Trainer name') == ''
        tn.fill('ABCDEFGHIJKL'); assert warn_of(page, 'Trainer name') == 'Only the first 10 characters are kept.'
        tn.fill('Ember{PK}'); assert warn_of(page, 'Trainer name') == ''
        # the rival field warns on its own
        name_input(page, 'Rival name').fill('Bl#'); assert 'saved as' in warn_of(page, 'Rival name') and warn_of(page, 'Trainer name') == ''
        name_input(page, 'Rival name').fill('BLU')
        # the trainer card shows the symbol text
        assert 'Ember{PK}' in page.inner_text('.tcard-top'), page.inner_text('.tcard-top')
        # nickname warning inside the Pokémon editor
        page.click('button.tab:has-text("Party")'); page.click('.mon-main'); page.wait_for_selector('dialog.mon-dialog[open]')
        nick = name_input(page, 'Nickname')
        nick.fill('Pi✓ka'); assert 'saved as' in warn_of(page, 'Nickname'), warn_of(page, 'Nickname')
        nick.fill('PIKA'); assert warn_of(page, 'Nickname') == ''
        page.click('dialog button.primary')
        page.click('.save-btn'); page.wait_for_selector('dialog.review-dialog[open]')
        with page.expect_download() as dl:
            page.click('dialog.review-dialog button.primary')
        dl.value.save_as(f'{SP}/names-edited.sav')
        data = open(f'{SP}/names-edited.sav', 'rb').read()
        assert list(data[0x2598:0x25a0]) == [0x84, 0xac, 0xa1, 0xa4, 0xb1, 0xe1, 0x50, 0x50], list(data[0x2598:0x25a0])
        assert data[0x3523] == (~sum(data[0x2598:0x3523])) & 0xff
        ctx.close()

    # a real Yellow save, if one was given (E2E_YELLOW_SAV): its names come back as typed and nothing shows as "?"
    if YELLOW:
        ctx = b.new_context(viewport={'width': 390, 'height': 860}); page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.goto(BASE)
        with page.expect_file_chooser() as fc: page.click('.slot')
        fc.value.set_files(YELLOW); page.wait_for_selector('.tabs')
        shown = name_input(page, 'Trainer name').input_value()
        assert shown in page.inner_text('.tcard-top') and warn_of(page, 'Trainer name') == ''
        page.click('button.tab:has-text("Party")'); page.click('.mon-main'); page.wait_for_selector('dialog.mon-dialog[open]')
        assert name_input(page, 'Original trainer').input_value() == shown and warn_of(page, 'Original trainer') == ''
        page.keyboard.press('Escape')
        text = page.evaluate('document.body.innerText')
        assert '?' not in [w for w in text.split() if w == '?']
        # look through the boxes for a Pokémon whose original trainer is the game's TRAINER text (not every save has one)
        page.click('button.tab:has-text("Boxes")')
        found = None
        for n in range(12):
            cells = page.locator('.box-grid .box-cell[data-pick]')
            for i in range(cells.count()):
                cells.nth(i).click(); page.wait_for_selector('dialog.sheet-dialog[open]')
                page.locator('dialog.sheet-dialog button:has-text("Edit")').first.click(); page.wait_for_selector('dialog.mon-dialog[open]')
                if name_input(page, 'Original trainer').input_value() == '{TRAINER}':
                    found = (n, i); assert warn_of(page, 'Original trainer') == ''; break
                page.keyboard.press('Escape'); page.wait_for_selector('dialog.mon-dialog', state='detached')
            if found: break
            page.click('button[aria-label="Next box"]')
        print('boxed Pokémon with {TRAINER} OT found at', found)
        ctx.close()
    b.close()
print('ERRORS:', errors or 'none')
