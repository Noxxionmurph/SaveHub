import sys, pathlib
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from lib import BASE, ART_DIR
SP = sys.argv[1]
ART = 'https://noxxionmurph.github.io/SaveHub-assets/'
ROOT = ART_DIR
errors, hosts, fonts = [], set(), []

def art_ok(route):
    f = ROOT / route.request.url[len(ART):].split('?')[0]
    if f.is_file(): route.fulfill(status=200, content_type='image/png', body=f.read_bytes())
    else: route.fulfill(status=404, body='no such file')

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 390, 'height': 860}, device_scale_factor=2)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('request', lambda r: hosts.add(urlparse(r.url).netloc) if not r.url.startswith('data:') else None)
    page.on('response', lambda r: fonts.append((r.url.rsplit('/', 1)[-1], r.status)) if '/fonts/' in r.url else None)
    page.route(ART + '**', art_ok)
    page.goto(BASE)
    page.wait_for_selector('.slot')
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(600)
    loaded = page.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight}`)")
    print('loaded faces:', loaded)
    print('font requests:', fonts)
    print('hosts contacted:', sorted(hosts))
    fam = set(page.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family)"))
    assert fam == {'Instrument Sans', 'JetBrains Mono', 'Pixelify Sans'}, fam
    assert hosts <= {urlparse(BASE).netloc, 'noxxionmurph.github.io'}, hosts
    assert all(s == 200 for _, s in fonts) and len(fonts) >= 4, fonts   # fonts.css + 3 files (preloads reuse them)
    # the three roles really use the three families
    used = page.evaluate("""() => ({
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector('.wordmark-text')).fontFamily,
      hex: getComputedStyle(document.querySelector('.hex td')).fontFamily })""")
    print(used)
    assert used['body'].startswith('"Instrument Sans"') and used['h1'].startswith('"Pixelify Sans"') and used['hex'].startswith('"JetBrains Mono"')
    page.screenshot(path=f'{SP}/fonts-landing.png', full_page=False)
    page.click('.sample-row button'); page.wait_for_selector('.tabs')
    page.click('button.tab:text-is("Party")'); page.wait_for_selector('.pikachu-card')
    page.wait_for_timeout(500)
    page.screenshot(path=f'{SP}/fonts-party.png')
    b.close()
print('ERRORS:', errors if errors else 'none')
sys.exit(1 if errors else 0)
