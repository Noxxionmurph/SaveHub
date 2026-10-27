"""The deployed build stamps its scripts and stylesheets with a version (?v=...), so a browser that kept an older copy
of one file (GitHub Pages lets it keep files for 10 minutes) can't mix it with newer files. Every script, module and
stylesheet the page loads carries the same version, the page still works with them, and the version is a short
hash. (The development build with ./assets/ has no version: see scripts/build.mjs.)"""
import re
import sys
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
from lib import BASE, ART_DIR
SP = sys.argv[1]
ART = 'https://noxxionmurph.github.io/SaveHub-assets/'
errors, loaded = [], []


def art_ok(route):
    f = ART_DIR / route.request.url[len(ART):].split('?')[0]
    if f.is_file(): route.fulfill(status=200, content_type='image/svg+xml' if f.suffix == '.svg' else 'image/png', body=f.read_bytes())
    else: route.fulfill(status=404, body='no such file')


with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 390, 'height': 860})
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text else None)
    page.on('response', lambda r: loaded.append((r.url, r.status)) if urlparse(r.url).path.endswith(('.js', '.css')) and r.url.startswith(BASE.rstrip('/')) else None)
    page.route(ART + '**', art_ok)
    page.goto(BASE)
    page.wait_for_selector('.slot')
    page.click('.sample-row button'); page.wait_for_selector('.tabs')          # a file opens and an editor module is loaded on the way
    page.click('button.tab:has-text("Party")'); page.wait_for_selector('.mon-main')
    hrefs = page.eval_on_selector_all('link[rel=stylesheet]', 'els => els.map(e => e.getAttribute("href"))')
    scripts = page.eval_on_selector_all('script[src]', 'els => els.map(e => e.getAttribute("src"))')
    b.close()

assert not errors, errors
local = [h for h in hrefs if h.startswith('./')]
assert len(local) == 2 and len(scripts) == 1, (hrefs, scripts)
versions = {parse_qs(urlparse(u).query).get('v', [''])[0] for u in local + scripts + [u for u, _ in loaded]}
assert len(versions) == 1 and re.fullmatch(r'[0-9a-f]{10}', next(iter(versions))), ('every script and stylesheet must carry the same version', versions)
assert all(status == 200 for _, status in loaded), loaded
assert len(loaded) >= 20, ('the modules did not all load through the versioned addresses', len(loaded))
paths = [urlparse(u).path for u, _ in loaded]   # whole paths: gen1/data.js and gen2/data.js are different modules
assert len(paths) == len(set(paths)), ('a module was loaded twice, so two copies would be running', sorted(paths))
print('versioned: ok', next(iter(versions)), len(loaded), 'files')
