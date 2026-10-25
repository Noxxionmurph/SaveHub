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
    assert fam == {'Instrument Sans', 'Pixelify Sans'}, fam    # the landing page needs no monospace (it is loaded when a number field appears)
    assert hosts <= {urlparse(BASE).netloc, 'noxxionmurph.github.io'}, hosts
    assert all(s == 200 for _, s in fonts) and len(fonts) >= 3, fonts   # fonts.css + 2 files (preloads reuse them)
    # the three roles really use the three families
    used = page.evaluate("""() => ({
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector('.wordmark-text')).fontFamily,
      hex: getComputedStyle(document.querySelector('.hex td')).fontFamily })""")
    print(used)
    assert used['body'].startswith('"Instrument Sans"') and used['h1'].startswith('"Pixelify Sans"') and used['hex'].startswith('"Pixelify Sans"')   # the retro windows are all pixel text
    # the pixel face as shipped: its 5 is not its S (it used to be the same shape, so "500" read "S00"), and its fi / fl
    # ligatures, which were drawn as an "A", are gone (so "file" is f + i)
    glyphs = page.evaluate("""async () => {
      await document.fonts.load('500 40px "Pixelify Sans"'); await document.fonts.load('700 40px "Pixelify Sans"');
      const out = {};
      for (const weight of [500, 700]) {
        const draw = (t) => { const c = document.createElement('canvas'); c.width = 70; c.height = 70; const x = c.getContext('2d'); x.font = `${weight} 40px "Pixelify Sans"`; x.fillStyle = '#000'; x.fillText(t, 8, 48); return x.getImageData(0, 0, 70, 70).data; };
        const a = draw('5'), b = draw('S'); let diff = 0, ink = 0;
        for (let i = 3; i < a.length; i += 4) { if (a[i] > 127 || b[i] > 127) ink++; if ((a[i] > 127) !== (b[i] > 127)) diff++; }
        const ctx = document.createElement('canvas').getContext('2d'); ctx.font = `${weight} 40px "Pixelify Sans"`; ctx.fontKerning = 'none';
        const w = (t) => ctx.measureText(t).width;
        out[weight] = { differ: diff / ink, ligatures: ['fi', 'fl', 'ff', 'ffi'].map((t) => Math.abs(w(t) - [...t].reduce((n, ch) => n + w(ch), 0))) };
      }
      return out; }""")
    print('5 vs S:', glyphs)
    for weight, g in glyphs.items():
        assert g['differ'] > 0.12, (weight, 'the 5 and the S look alike again', g)
        assert max(g['ligatures']) < 0.5, (weight, 'a ligature is back', g)
    page.screenshot(path=f'{SP}/fonts-landing.png', full_page=False)
    page.click('.sample-row button'); page.wait_for_selector('.tabs')
    # the monospace face is for typing into: number fields
    assert page.evaluate("getComputedStyle(document.querySelector('input[type=number]')).fontFamily").startswith('"JetBrains Mono"')
    page.wait_for_timeout(500)
    assert 'JetBrains Mono' in page.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family)"), 'the monospace should load once number fields are on screen'
    page.click('button.tab:text-is("Party")'); page.wait_for_selector('.pikachu-card')
    page.wait_for_timeout(500)
    page.screenshot(path=f'{SP}/fonts-party.png')
    b.close()
print('ERRORS:', errors if errors else 'none')
sys.exit(1 if errors else 0)
