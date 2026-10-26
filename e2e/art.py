import sys, pathlib
from playwright.sync_api import sync_playwright
from lib import BASE, ART_DIR
SP = sys.argv[1]
ART = 'https://noxxionmurph.github.io/SaveHub-assets/'
ROOT = ART_DIR
errors = []

def art_ok(route):
    rel = route.request.url[len(ART):].split('?')[0]
    f = ROOT / rel
    if f.is_file(): route.fulfill(status=200, content_type='image/png', body=f.read_bytes())
    else: route.fulfill(status=404, body='no such file')

def art_gone(route):
    route.fulfill(status=404, body='gone')

def run(browser, mode):
    ctx = browser.new_context(viewport={'width': 390, 'height': 860}, device_scale_factor=2)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'[{mode}] pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'[{mode}] console.{m.type}: {m.text}')
            if m.type == 'error' and 'ERR_TUNNEL' not in m.text and not (mode == 'gone' and '404' in m.text) else None)
    art_hits, local_art = [], []
    page.on('request', lambda r: art_hits.append(r.url) if r.url.startswith(ART) else None)
    page.on('request', lambda r: local_art.append(r.url) if r.url.startswith(BASE) and '/assets/' in r.url else None)
    page.route(ART + '**', art_ok if mode == 'ok' else art_gone)
    page.goto(BASE)
    page.wait_for_selector('.sample-row button')
    page.wait_for_function("[...document.querySelectorAll('img.tile-icon')].length === 6")
    page.wait_for_timeout(600)
    tiles = page.evaluate("[...document.querySelectorAll('img.tile-icon')].map(i => [i.hidden, i.complete, i.naturalWidth])")
    foot = page.locator('footer.site-foot')
    assert 'Not affiliated' in foot.inner_text() and 'non-commercial' in foot.inner_text(), foot.inner_text()
    assert foot.locator('a:text-is("Contact")').get_attribute('href').endswith('/SaveHub/issues')
    assert foot.locator('a:text-is("Credits")').get_attribute('href').endswith('/SaveHub/blob/main/CREDITS.md')
    assert foot.locator('a:text-is("Source on GitHub")').count() == 1
    page.screenshot(path=f'{SP}/art-{mode}-1-landing.png', full_page=True)
    if mode == 'ok':
        assert all(not hid and nw > 0 for hid, comp, nw in tiles), tiles
    else:
        assert all(hid for hid, comp, nw in tiles), tiles
    page.click('.sample-row button'); page.wait_for_selector('.tabs')
    assert page.locator('.editor-head ~ footer.site-foot').count() == 1 or page.locator('footer.site-foot').count() == 1
    assert 'Not affiliated' in page.locator('footer.site-foot').inner_text()
    tabs = page.locator('button.tab')
    names = [tabs.nth(i).inner_text() for i in range(tabs.count())]
    for n in names:
        page.click(f'button.tab:text-is("{n}")')
        page.wait_for_timeout(400)
        # lazy images only load once scrolled near, so walk down the page to make every one try (and fail or load)
        h = page.evaluate('document.documentElement.scrollHeight')
        for y in range(0, h, 500):
            page.evaluate(f'window.scrollTo(0, {y})'); page.wait_for_timeout(60)
        page.evaluate('window.scrollTo(0, 0)')
        page.wait_for_timeout(700)
        overflow = page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        assert overflow <= 0, f'{mode}/{n}: horizontal overflow {overflow}'
        broken = page.evaluate("[...document.querySelectorAll('img')].filter(i => i.getClientRects().length > 0 && i.complete && i.naturalWidth === 0).length")
        assert broken == 0, f'{mode}/{n}: {broken} visible broken images'
        if n == 'Party':
            page.wait_for_selector('section.pikachu-card')
            page.wait_for_timeout(400)
            bg = page.locator('.pika-frame').first.evaluate('e => getComputedStyle(e).backgroundImage')
            art_state = page.evaluate('document.documentElement.dataset.art || "on"')
            screen_shown = page.locator('.pika-screen').first.is_visible()
            says = page.locator('.pika-says').inner_text()
            assert says == 'Pikachu looks happy.', says
            page.screenshot(path=f'{SP}/art-{mode}-2-party.png', full_page=True)
            if mode == 'ok':
                assert bg == f'url("{ART}sprites/pikachu.png")', bg
                assert art_state == 'on' and screen_shown
                imgs = page.evaluate("[...document.querySelectorAll('.mon-icon')].map(i => i.naturalWidth)")
                assert imgs and all(w > 0 for w in imgs), imgs
            else:
                assert art_state == 'off' and not screen_shown, (art_state, screen_shown)
        if n.startswith('Pok') and 'dex' in n.lower():
            page.screenshot(path=f'{SP}/art-{mode}-3-dex.png')
    if mode == 'ok':
        kinds = {u[len(ART):].split('/')[1] for u in art_hits if '/' in u[len(ART):]}
        assert {'pokemon', 'items', 'badges'} <= kinds, kinds
        assert len(local_art) == 0, local_art
    print(mode, 'tabs:', names, '| art requests:', len(art_hits), '| local /assets/ requests:', len(local_art))
    ctx.close()

with sync_playwright() as p:
    b = p.chromium.launch()
    run(b, 'ok')
    run(b, 'gone')
    b.close()
print('ERRORS:', errors if errors else 'none')
sys.exit(1 if errors else 0)
