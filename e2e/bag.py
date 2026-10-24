import sys
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]; errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 860})
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.click('.sample-row button'); page.wait_for_selector('.tabs')
    page.click('button.tab:has-text("Bag")')
    rows = page.locator('.item-row')
    n = rows.count()
    sels = page.locator('.item-row select')
    total_opts = page.locator('.item-row option').count()
    print('rows', n, 'options on the page', total_opts)
    assert total_opts == n, 'each row starts with just its own option'
    first = sels.nth(0)
    label0 = first.evaluate('e => e.selectedOptions[0].textContent')
    # a real tap fills the list and keeps the selection
    first.click(); page.keyboard.press('Escape')
    assert first.locator('option').count() == 124, first.locator('option').count()
    assert first.evaluate('e => e.selectedOptions[0].textContent') == label0
    # other rows stay light
    assert page.locator('.item-row option').count() == n - 1 + 124
    icon_before = rows.nth(0).locator('img').get_attribute('src')
    first.select_option(label='Rare Candy')
    assert first.evaluate('e => e.selectedOptions[0].textContent') == 'Rare Candy'
    assert rows.nth(0).locator('img').get_attribute('src') != icon_before
    # keyboard focus alone also fills it
    second = sels.nth(1)
    second.focus()
    assert second.locator('option').count() == 124
    # the change reaches the save
    page.click('.save-btn'); page.wait_for_selector('dialog.review-dialog[open]')
    text = page.inner_text('dialog.review-dialog')
    assert 'Rare Candy' in text, text
    print(text.split('Keep editing')[0])
    b.close()
print('ERRORS:', errors or 'none')
