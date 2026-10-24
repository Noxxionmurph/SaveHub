import sys, re
from playwright.sync_api import sync_playwright
from lib import BASE
SP = sys.argv[1]
errors = []

def centre(loc):
    b = loc.bounding_box()
    return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2

def grid_names(page):
    # species/nickname at the start of each aria-label, in slot order
    return [re.split(r',', l)[0] for l in page.eval_on_selector_all('.box-grid .box-cell[data-pick]', 'els => els.map(e => e.getAttribute("aria-label"))')]

def party_names(page):
    return [re.split(r',', l)[0] for l in page.eval_on_selector_all('.party-cells .box-cell[data-pick]', 'els => els.map(e => e.getAttribute("aria-label"))')]

def mouse_drag(page, src, dst, hold_at_end=0, steps=10):
    sx, sy = centre(src); dx, dy = centre(dst)
    page.mouse.move(sx, sy); page.mouse.down()
    page.mouse.move(sx + 6, sy + 6, steps=2)
    page.mouse.move(dx, dy, steps=steps)
    if hold_at_end: page.wait_for_timeout(hold_at_end)
    page.mouse.up()

def open_sample(page):
    page.goto(BASE)
    page.click('.sample-row button')
    page.wait_for_selector('.tabs')
    page.click('button.tab:has-text("Boxes")')
    page.wait_for_selector('.box-grid')

with sync_playwright() as p:
    b = p.chromium.launch()

    # ------------------------------------------------------------------ mouse
    ctx = b.new_context(viewport={'width': 390, 'height': 860}, accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    open_sample(page)
    page.screenshot(path=f'{SP}/d1-boxes.png', full_page=True)
    assert page.locator('.party-cells .box-cell').count() == 6
    assert page.locator('.party-cells .box-cell[data-pick]').count() == 6
    g0 = grid_names(page); p0 = party_names(page)
    print('box 1:', g0); print('party :', p0)
    assert len(g0) == 5

    # tap still opens the menu
    page.locator('.box-grid .box-cell[data-pick]').nth(0).click()
    page.wait_for_selector('dialog.sheet-dialog[open]')
    page.keyboard.press('Escape'); page.wait_for_selector('dialog.sheet-dialog', state='detached')

    # swap inside the box
    cells = page.locator('.box-grid .box-cell[data-pick]')
    mouse_drag(page, cells.nth(0), cells.nth(3))
    g1 = grid_names(page)
    assert g1 == [g0[3], g0[1], g0[2], g0[0], g0[4]], (g0, g1)
    assert 'Swapped' in page.inner_text('#toast'), page.inner_text('#toast')
    assert page.locator('dialog[open]').count() == 0, 'a drag must not open the menu'
    assert page.locator('.drag-ghost').count() == 0 and page.locator('.lifted, .drop-over').count() == 0
    assert 'dragging' not in (page.get_attribute('body', 'class') or '')
    assert page.locator('.save-btn.dirty').count() == 1

    # onto an empty spot of the same box: goes to the end
    empty = page.locator('.box-grid .box-cell.empty').nth(2)
    mouse_drag(page, page.locator('.box-grid .box-cell[data-pick]').nth(0), empty)
    g2 = grid_names(page)
    assert g2 == [g1[1], g1[2], g1[3], g1[4], g1[0]], (g1, g2)
    assert 'Moved' in page.inner_text('#toast')

    # box -> party swaps with the party Pokémon that was dropped on
    mouse_drag(page, page.locator('.box-grid .box-cell[data-pick]').nth(1), page.locator('.party-cells .box-cell[data-pick]').nth(2))
    p3 = party_names(page); g3 = grid_names(page)
    assert p3[2] == g2[1] and g3[1] == p0[2], (p3, g3)
    assert len(p3) == 6 and len(g3) == 5
    page.screenshot(path=f'{SP}/d2-after-swap.png', full_page=True)

    # party -> empty box spot: moves out
    mouse_drag(page, page.locator('.party-cells .box-cell[data-pick]').nth(5), page.locator('.box-grid .box-cell.empty').nth(0))
    assert len(party_names(page)) == 5 and len(grid_names(page)) == 6

    # empty party spot takes a boxed Pokémon
    mouse_drag(page, page.locator('.box-grid .box-cell[data-pick]').nth(5), page.locator('.party-cells .box-cell.empty').first)
    assert len(party_names(page)) == 6 and len(grid_names(page)) == 5

    # dropping on itself or in empty space changes nothing and opens nothing
    before = (party_names(page), grid_names(page))
    c = page.locator('.box-grid .box-cell[data-pick]').nth(1)
    mouse_drag(page, c, c)
    mouse_drag(page, c, page.locator('.boxes details.tips summary'))
    assert (party_names(page), grid_names(page)) == before
    assert page.locator('dialog[open]').count() == 0

    # Escape cancels mid-drag
    sx, sy = centre(c); dx, dy = centre(page.locator('.box-grid .box-cell[data-pick]').nth(3))
    page.mouse.move(sx, sy); page.mouse.down(); page.mouse.move(sx + 8, sy + 8, steps=2); page.mouse.move(dx, dy, steps=6)
    assert page.locator('.drag-ghost').count() == 1 and page.locator('.drop-over').count() == 1
    page.screenshot(path=f'{SP}/d3-dragging.png')
    page.keyboard.press('Escape')
    assert page.locator('.drag-ghost').count() == 0
    page.mouse.up()
    assert (party_names(page), grid_names(page)) == before

    # hold over "next box" to turn the page while dragging, then drop into box 2
    src = page.locator('.box-grid .box-cell[data-pick]').nth(0)
    name0 = grid_names(page)[0]
    nxt = page.locator('button[aria-label="Next box"]')
    sx, sy = centre(src); nx, ny = centre(nxt)
    page.mouse.move(sx, sy); page.mouse.down(); page.mouse.move(sx + 8, sy + 8, steps=2); page.mouse.move(nx, ny, steps=8)
    page.wait_for_timeout(700)
    assert 'Box 2' in page.eval_on_selector('.box-nav select', 'e => e.selectedOptions[0].textContent'), 'page turned'
    # the lifted Pokémon is in box 1, so nothing is dimmed in box 2
    assert page.locator('.box-grid .lifted').count() == 0
    n2 = len(grid_names(page))
    target = page.locator('.box-grid .box-cell.empty, .box-grid .box-cell.add').first
    tx, ty = centre(target)
    page.mouse.move(tx, ty, steps=8)
    page.mouse.up()
    assert len(grid_names(page)) == n2 + 1 and name0 in grid_names(page)[-1], (name0, grid_names(page))
    page.click('button[aria-label="Previous box"]')
    assert name0 not in grid_names(page) or grid_names(page).count(name0) < before[1].count(name0) + 1
    page.screenshot(path=f'{SP}/d4-after-nav.png', full_page=True)

    # the review lists the moves; keep the bytes sane
    page.click('.save-btn'); page.wait_for_selector('dialog.review-dialog[open]')
    review = page.inner_text('dialog.review-dialog')
    print('--- review ---'); print(review)
    with page.expect_download() as dl:
        page.click('dialog.review-dialog button.primary')
    dl.value.save_as(f'{SP}/drag-edited.sav')
    data = open(f'{SP}/drag-edited.sav', 'rb').read()
    assert len(data) == 32768 and data[0x3523] == (~sum(data[0x2598:0x3523])) & 0xff
    ctx.close()

    # ------------------------------------------------------------------ touch (real touch events via CDP)
    for scheme in ('light', 'dark'):
        ctx = b.new_context(viewport={'width': 390, 'height': 640}, has_touch=True, is_mobile=True, device_scale_factor=2, color_scheme=scheme)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        cdp = ctx.new_cdp_session(page)
        open_sample(page)
        def touch(kind, x, y):
            pts = [] if kind == 'touchEnd' else [{'x': x, 'y': y}]
            cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts})
        g0 = grid_names(page); p0 = party_names(page)
        sy0 = page.evaluate('window.scrollY')
        assert page.evaluate('document.documentElement.scrollHeight') > 640, 'page must be scrollable for the scroll test'

        # a quick tap opens the menu (the grid starts lower now that the tab has an intro, so scroll it into view)
        page.evaluate('window.scrollTo(0, 200)'); page.wait_for_timeout(150)
        cx, cy = centre(page.locator('.box-grid .box-cell[data-pick]').nth(0))
        touch('touchStart', cx, cy); page.wait_for_timeout(60); touch('touchEnd', cx, cy)
        page.wait_for_selector('dialog.sheet-dialog[open]')
        page.keyboard.press('Escape'); page.wait_for_selector('dialog.sheet-dialog', state='detached')

        # a swipe that starts on a Pokémon scrolls the page and picks nothing up
        touch('touchStart', cx, cy)
        for i in range(1, 9):
            touch('touchMove', cx, cy - i * 24); page.wait_for_timeout(16)
        touch('touchEnd', cx, cy - 8 * 24)
        page.wait_for_timeout(300)
        assert page.evaluate('window.scrollY') > sy0 + 20, ('swipe should scroll', page.evaluate('window.scrollY'))
        assert page.locator('.drag-ghost').count() == 0 and grid_names(page) == g0
        page.evaluate('window.scrollTo(0, 0)'); page.wait_for_timeout(100)

        # press, hold, drag onto another Pokémon, release -> swap, and the page did not scroll
        page.evaluate('window.scrollTo(0, 200)'); page.wait_for_timeout(150); sy1 = page.evaluate('window.scrollY')
        a = page.locator('.box-grid .box-cell[data-pick]').nth(0); z = page.locator('.box-grid .box-cell[data-pick]').nth(4)
        ax, ay = centre(a); zx, zy = centre(z)
        touch('touchStart', ax, ay)
        page.wait_for_timeout(420)
        touch('touchMove', ax + 2, ay + 2)
        assert page.locator('.drag-ghost').count() == 1, 'held long enough to lift'
        for i in range(1, 11):
            touch('touchMove', ax + (zx - ax) * i / 10, ay + (zy - ay) * i / 10); page.wait_for_timeout(16)
        assert page.locator('.drop-over').count() == 1
        page.screenshot(path=f'{SP}/t-{scheme}-1-dragging.png')
        touch('touchEnd', zx, zy)
        page.wait_for_timeout(200)
        g1 = grid_names(page)
        assert g1 == [g0[4], g0[1], g0[2], g0[3], g0[0]], (g0, g1)
        assert page.evaluate('window.scrollY') == sy1, 'dragging must not scroll the page'
        assert page.locator('dialog[open]').count() == 0

        # drag a boxed Pokémon up into the party row
        a = page.locator('.box-grid .box-cell[data-pick]').nth(1); z = page.locator('.party-cells .box-cell[data-pick]').nth(0)
        ax, ay = centre(a); zx, zy = centre(z)
        touch('touchStart', ax, ay); page.wait_for_timeout(420); touch('touchMove', ax, ay - 2)
        for i in range(1, 11):
            touch('touchMove', ax + (zx - ax) * i / 10, ay + (zy - ay) * i / 10); page.wait_for_timeout(16)
        touch('touchEnd', zx, zy); page.wait_for_timeout(200)
        assert party_names(page)[0] == g1[1], (party_names(page), g1)
        page.screenshot(path=f'{SP}/t-{scheme}-2-after.png')
        ctx.close()
    b.close()
print('ERRORS:', errors or 'none')
