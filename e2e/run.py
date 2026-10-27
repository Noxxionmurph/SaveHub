#!/usr/bin/env python3
"""Runs the browser checks against a fresh build of the site.

    python3 e2e/run.py              # everything
    python3 e2e/run.py names bag    # just these

Needs Node 22.18+, Python 3 with Playwright (pip install playwright; playwright install chromium), and the artwork
checked out as ./assets (git clone https://github.com/Noxxionmurph/SaveHub-assets assets). Screenshots and the saves the
checks write land in e2e/out/. Set E2E_YELLOW_SAV=/path/to/yellow.sav to also run the real-save checks (your own save
stays on your machine; nothing here stores or prints its contents).
"""
import functools
import http.server
import os
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'

# Checks that use the build that carries the artwork inside dist/ (./assets/) ...
LOCAL = ['redblue_flow', 'sample_flow', 'gold_flow', 'crystal_flow', 'yellow', 'blue_footer', 'pikachu', 'mood', 'drag', 'bag', 'names', 'hosted_download', 'console_theme', 'dialog_close', 'flair', 'crisp', 'narrow', 'sweep', 'assets']
# ... and checks that need the build as it is deployed (pictures and fonts loaded by address).
HOSTED = ['art', 'fonts', 'versioned']


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # keep the output readable
        pass


class Server(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):  # a page that closes mid-download is not an error worth a traceback
        pass


def node(*args):
    subprocess.run(['node', *args], cwd=REPO, check=True, env={**os.environ, 'NODE_NO_WARNINGS': '1'})


def serve():
    handler = functools.partial(Quiet, directory=str(REPO / 'dist'))
    server = Server(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f'http://127.0.0.1:{server.server_address[1]}/'


def run_one(name, url):
    started = time.time()
    done = subprocess.run([sys.executable, str(HERE / f'{name}.py'), str(OUT)], cwd=HERE, capture_output=True, text=True,
                          env={**os.environ, 'E2E_URL': url}, timeout=600)
    problems = [l for l in done.stdout.splitlines() if l.startswith('ERRORS:') and l.strip() != 'ERRORS: none']
    ok = done.returncode == 0 and not problems
    print(f"{'ok  ' if ok else 'FAIL'} {name} ({time.time() - started:.0f}s)")
    if not ok:
        print((done.stdout + done.stderr).strip()[-2500:])
    return ok


def main():
    wanted = sys.argv[1:] or LOCAL + HOSTED
    unknown = [w for w in wanted if w not in LOCAL + HOSTED]
    if unknown:
        sys.exit(f"No such check: {', '.join(unknown)}. Choose from: {', '.join(LOCAL + HOSTED)}")
    if not (REPO / 'assets' / 'sprites').is_dir():
        sys.exit('The artwork is not checked out. Run: git clone https://github.com/Noxxionmurph/SaveHub-assets assets')
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)
    node('e2e/make-fixtures.ts', str(OUT))
    server, url = serve()
    results = []
    for local, group in ((True, LOCAL), (False, HOSTED)):
        todo = [w for w in wanted if w in group]
        if not todo:
            continue
        node('scripts/build.mjs', *(['--local-art'] if local else []))
        results += [run_one(name, url) for name in todo]
    server.shutdown()
    print(f"{sum(results)} of {len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


main()
