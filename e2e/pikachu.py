import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []

def open_sample(page):
    page.goto(BASE); page.click('.sample-row button'); page.wait_for_selector('.tabs')
    assert page.locator('.pikachu-card').count() == 0   # the card lives under the party list
    page.click('button.tab:has-text("Party")')

with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ('light', 'dark'):
        ctx = b.new_context(viewport={'width': 390, 'height': 860}, color_scheme=scheme, device_scale_factor=2)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        failed = []; sheet_hits = []
        page.on('response', lambda r: failed.append(r.url) if r.status >= 400 and 'fonts' not in r.url else None)
        page.on('request', lambda r: sheet_hits.append(r.url) if 'sprites/pikachu' in r.url else None)
        open_sample(page)
        card = page.locator('section.pikachu-card')
        pre = card.locator('.pika-preview')
        assert 'Pikachu looks happy.' in pre.inner_text(), pre.inner_text()
        assert 'Friendship 160, mood neutral' in pre.inner_text()
        frame = pre.locator('.pika-frame').first
        bg = frame.evaluate('e => getComputedStyle(e).backgroundImage')
        assert 'assets/sprites/pikachu.png' in bg, bg
        assert frame.evaluate('e => e.parentElement.style.getPropertyValue("--row")') == '9'   # Happy is row 9 of the sheet
        # one picture file for everything
        assert len(sheet_hits) == 1, sheet_hits
        assert card.locator('img').count() == 1   # only the card's own Pikachu icon
        assert card.locator('details').count() == 0   # no chart or rules to open
        card.screenshot(path=f'{SP}/pk-{scheme}-card-closed.png')
        # change the mood: the preview follows
        card.locator('button:text-is("Cheerful")').click()
        assert 'pumps its fist' in pre.inner_text()
        card.locator('button:text-is("Upset")').click()
        assert 'twitches its ears' in pre.inner_text()
        card.locator('button:text-is("Max friendship")').click()
        assert 'looks full of love' not in pre.inner_text() and 'looks mad' in pre.inner_text(), pre.inner_text()   # upset + 255 = Mad
        card.locator('button:text-is("Cheerful")').click()
        assert 'full of love' in pre.inner_text()
        # the picture changed to the right file
        assert page.eval_on_selector('.pika-preview .pika-pic', 'e => e.style.getPropertyValue("--row")') == '17'   # Love
        card.locator('button:text-is("Neutral")').click()
        assert 'two hearts' in pre.inner_text()
        card.screenshot(path=f'{SP}/pk-{scheme}-card-open.png')
        assert not failed, failed
        ctx.close()

    # the preview stays in view under the tab bar while scrolling through the card
    ctx = b.new_context(viewport={'width': 390, 'height': 700}, device_scale_factor=2); page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    open_sample(page)
    card = page.locator('section.pikachu-card')
    card.locator('.lcd.second').scroll_into_view_if_needed()
    page.wait_for_timeout(200)
    box = card.locator('.pika-preview').bounding_box(); tabs = page.locator('nav.tabs').bounding_box()
    print('sticky preview top', round(box['y']), 'tabs bottom', round(tabs['y'] + tabs['height']))
    assert 40 <= box['y'] <= 60 and box['y'] >= tabs['y'] + tabs['height'] - 1, (box, tabs)
    page.screenshot(path=f'{SP}/pk-sticky.png')
    ctx.close()

    # narrow screens: nothing overflows sideways, in both themes
    for w in (320, 360, 390):
        for scheme in ('light', 'dark'):
            ctx = b.new_context(viewport={'width': w, 'height': 800}, color_scheme=scheme); page = ctx.new_page()
            open_sample(page)
            card = page.locator('section.pikachu-card')
            page.wait_for_timeout(200)
            over = page.evaluate('''() => { const w = document.documentElement.clientWidth; const out = [];
              document.querySelectorAll('.pikachu-card *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > w + 0.5 || r.left < -0.5)) out.push(e.className || e.tagName); });
              return [document.documentElement.scrollWidth > w, out.slice(0, 5)]; }''')
            assert over == [False, []], (w, scheme, over)
            if w == 320 and scheme == 'light': card.screenshot(path=f'{SP}/pk-320.png')
            ctx.close()

    # reduced motion: the second frame never shows
    ctx = b.new_context(viewport={'width': 390, 'height': 800}, reduced_motion='reduce'); page = ctx.new_page()
    open_sample(page); page.wait_for_timeout(1500)
    ops = page.eval_on_selector('.pika-preview .pika-frame-2', 'e => getComputedStyle(e).opacity + "|" + getComputedStyle(e).animationName')
    print('reduced motion frame 2:', ops); assert ops.startswith('0|')
    ctx.close()
    # normal motion: it flips
    ctx = b.new_context(viewport={'width': 390, 'height': 800}); page = ctx.new_page()
    open_sample(page)
    seen = set()
    for _ in range(14):
        seen.add(page.eval_on_selector('.pika-preview .pika-frame-2', 'e => getComputedStyle(e).opacity')); page.wait_for_timeout(180)
    print('normal motion opacities seen:', seen); assert seen == {'0', '1'}
    ctx.close()

    # Red/Blue never gets the card
    ctx = b.new_context(viewport={'width': 390, 'height': 800}); page = ctx.new_page()
    page.goto(BASE)
    with page.expect_file_chooser() as fc: page.click('.slot')
    fc.value.set_files(f'{SP}/rb.sav'); page.wait_for_selector('.version-pick, .tabs')
    if page.locator('.version-pick').count(): page.click('.version-pick button:has-text("Blue")')
    page.wait_for_selector('.tabs'); assert page.locator('.pikachu-card').count() == 0
    page.click('button.tab:has-text("Party")'); assert page.locator('.pikachu-card').count() == 0
    ctx.close(); b.close()
print('ERRORS:', errors or 'none')
