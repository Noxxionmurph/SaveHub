# Browser checks

End-to-end checks that drive the built site in a real Chromium (through Playwright): open a save, edit it, look at
the review list, download the result and compare its bytes, plus layout checks at phone width, the Pikachu card, the
Pokémon window's close button, HP bars and the save window, sharp pixel art at every screen scaling, drag and drop, the hosted-download path, the fonts, the artwork (with and without the pictures reachable), and the version stamp on the deployed build's scripts and stylesheets.

```
pip install playwright && playwright install chromium     # once
git clone https://github.com/Noxxionmurph/SaveHub-assets assets   # once: the checks need the artwork
python3 e2e/run.py                # everything (about a minute and a half)
python3 e2e/run.py names bag      # only these
```

`run.py` builds the site, serves it on a free local port, writes three made-up saves (`make-fixtures.ts`) and runs each
check as its own script. Screenshots and the saves a check writes land in `e2e/out/` (git-ignored); look there when
something fails. A check fails if an assertion fails, the page throws, or the browser console logs an error.

- **Real saves are optional.** Set `E2E_YELLOW_SAV=/path/to/yellow.sav` to also run the checks that read a real Yellow
  save (`yellow`, `mood`, `names`). They only use what the page shows, never a value from one particular save, and
  nothing from the file is stored or printed. Never commit a save; `.gitignore` blocks `*.sav`.
- **Two kinds of build.** Most checks use a build with the artwork inside `dist/` (`--local-art`); `art`, `fonts` and `versioned` use
  the build as it is deployed, with the artwork site's address, and answer those requests from your `assets/` folder.
- **Running one by hand:** `E2E_URL=http://localhost:5173/ python3 e2e/names.py e2e/out` against a site you already
  serve (`npm run dev`), after `node e2e/make-fixtures.ts e2e/out`.
- GitHub runs these on every push (`.github/workflows/e2e.yml`). The unit tests (`npm test`) are separate and also run
  before every deploy.
