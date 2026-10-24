import sys
from playwright.sync_api import sync_playwright
from lib import BASE, YELLOW
SP = sys.argv[1]
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ('light', 'dark'):
        ctx = b.new_context(viewport={'width': 390, 'height': 860}, accept_downloads=True, color_scheme=scheme, device_scale_factor=2)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        page.goto(BASE); page.click('.sample-row button'); page.wait_for_selector('.tabs'); page.click('button.tab:has-text("Party")')
        card = page.locator('section.pikachu-card')
        assert card.count() == 1
        react = card.locator('.pika-preview')
        # the sample: friendship 160, neutral mood
        assert 'Pikachu happy'.split()[0] in react.inner_text()
        print(scheme, '| start:', react.inner_text().replace('\n', ' '))
        assert 'looks happy' in react.inner_text(), react.inner_text()
        card.locator('button:text-is("Upset")').click()
        assert 'looks mad' not in react.inner_text() and 'twitches its ears' in react.inner_text(), react.inner_text()
        assert card.locator('output[aria-label="Mood"]').inner_text() == '0'
        assert 'Upset' in card.locator('.lcd.second').inner_text()
        assert 'about 128 steps' in card.inner_text()
        card.locator('button:text-is("Cheerful")').click()
        assert 'pumps its fist' in react.inner_text() and 'about 127 steps' in card.inner_text(), react.inner_text()
        # friendship changes the reaction too
        card.locator('button:has-text("Max friendship")').click()
        assert 'looks full of love' in react.inner_text(), react.inner_text()
        # number box and slider stay in step
        num = card.locator('input[aria-label="Mood number"]'); num.fill('129'); num.dispatch_event('change')
        assert card.locator('input[type=range][aria-label="Mood"]').input_value() == '129'
        assert 'about 1 step.' in card.inner_text(), card.inner_text()
        card.locator('button:text-is("Neutral")').click()
        assert 'looks overjoyed' not in react.inner_text() and '2 hearts' not in react.inner_text() and 'two hearts' in react.inner_text()
        assert 'Neutral is where the mood settles' in card.inner_text()
        # save with mood = 0 and friendship unchanged-ish
        card.locator('button:text-is("Upset")').click()
        card.scroll_into_view_if_needed()
        card.screenshot(path=f'{SP}/mood-{scheme}.png')
        page.click('.save-btn'); page.wait_for_selector('dialog.review-dialog[open]')
        review = page.inner_text('dialog.review-dialog')
        assert 'Mood: Neutral (128) → Upset (0)' in review, review
        with page.expect_download() as dl:
            page.click('dialog.review-dialog button.primary')
        dl.value.save_as(f'{SP}/mood-edited.sav')
        data = open(f'{SP}/mood-edited.sav', 'rb').read()
        assert data[0x271d] == 0 and data[0x271c] == 255, (data[0x271c], data[0x271d])
        assert data[0x3523] == (~sum(data[0x2598:0x3523])) & 0xff
        ctx.close()
    # Red/Blue: no Pikachu card
    ctx = b.new_context(viewport={'width': 390, 'height': 860}); page = ctx.new_page()
    page.goto(BASE)
    with page.expect_file_chooser() as fc: page.click('.slot')
    fc.value.set_files(f'{SP}/rb.sav'); page.wait_for_selector('.version-pick, .tabs')
    if page.locator('.version-pick').count(): page.click('.version-pick button:has-text("Blue")')
    page.wait_for_selector('.tabs'); assert page.locator('.pikachu-card').count() == 0
    ctx.close()
    # a real Yellow save, if one was given (E2E_YELLOW_SAV): the card reads it and shows a reaction
    if YELLOW:
        ctx = b.new_context(viewport={'width': 390, 'height': 860}); page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.goto(BASE)
        with page.expect_file_chooser() as fc: page.click('.slot')
        fc.value.set_files(YELLOW); page.wait_for_selector('.tabs'); page.click('button.tab:has-text("Party")')
        card = page.locator('section.pikachu-card')
        assert card.locator('output[aria-label="Friendship"]').inner_text().isdigit()
        assert card.locator('output[aria-label="Mood"]').inner_text().isdigit()
        assert card.locator('.pika-preview').inner_text().strip().startswith('Talk to it')
        ctx.close()
    b.close()
print('ERRORS:', errors or 'none')
