import sys, zipfile, io
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 400, 'height': 860})
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    # Simulated hosted viewer: confirm() is suppressed, downloads only via the capability, no <a download>.
    page.add_init_script("""
      window.confirm = () => false;
      window.__saved = null;
      window.claude = { use: async (n) => n === 'downloads'
        ? { save: async (req) => { window.__saved = { filename: req.filename, data: Array.from(req.data) }; return { status: 'saved' }; } }
        : null };
    """)
    page.goto(BASE)
    page.wait_for_selector('.slot')
    assert page.title() == 'SaveForge', page.title()
    page.click('.sample-row button')
    page.wait_for_selector('.tabs')
    assert 'zip' in page.inner_text('.dl-note').lower(), page.inner_text('.editor-head')
    # edit -> dirty; Close must now go through the in-page dialog (confirm() is dead)
    page.fill('input[max="999999"]', '777')
    page.dispatch_event('input[max="999999"]', 'change')
    page.click('text=Close')
    page.wait_for_selector('dialog.confirm-dialog[open]')
    page.screenshot(path=f'{SP}/h1-confirm.png')
    page.click('dialog.confirm-dialog button:has-text("Cancel")')
    assert page.locator('.tabs').count() == 1
    # remove a party member via the action sheet and the in-page confirm dialog
    page.click('button.tab:has-text("Party")')
    assert page.locator('.mon').count() == 6
    page.locator('.mon').nth(5).locator('button[aria-label^="Actions for"]').click()
    page.click('dialog.sheet-dialog button.danger')
    page.wait_for_selector('dialog.confirm-dialog[open]')
    page.click('dialog.confirm-dialog button.primary')
    page.wait_for_function("document.querySelectorAll('.mon').length === 5")
    # Save -> review dialog -> download goes through the capability as a .zip
    page.click('.save-btn')
    page.wait_for_selector('dialog.review-dialog[open]')
    text = page.inner_text('dialog.review-dialog')
    assert 'Money: ¥12,500 → ¥777' in text and 'Removed Magikarp Lv 10 from Party 6' in text, text
    page.screenshot(path=f'{SP}/h2-review.png')
    page.click('dialog.review-dialog button.primary')
    page.wait_for_function('window.__saved !== null')
    saved = page.evaluate('window.__saved')
    page.wait_for_selector('#toast')
    page.screenshot(path=f'{SP}/h2-toast.png')
    b.close()
z = zipfile.ZipFile(io.BytesIO(bytes(saved['data'])))
assert z.testzip() is None
names = z.namelist()
print('filename:', saved['filename'], '| zip contents:', names, '| bytes:', len(z.read(names[0])))
raw = z.read(names[0])
open(f'{SP}/hosted-edited.sav', 'wb').write(raw)
assert len(raw) == 32768 and raw[0x3523] == (~sum(raw[0x2598:0x3523])) & 0xff
assert raw[0x2f2c] == 5, raw[0x2f2c]          # party count
assert raw[0x25f3:0x25f6] == bytes([0x00, 0x07, 0x77])   # money BCD
print('ERRORS:', errors or 'none')
