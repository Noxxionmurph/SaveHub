// Where the artwork (Pokémon, item and type icons, gym badges, Pikachu's reactions) is loaded from.
//
// The artwork is not part of this repository. It lives in its own repository (SaveHub-assets) and is served from its
// own site, so the editor and the artwork can be changed, replaced or removed independently of each other.
// Nothing in the editor depends on the artwork being reachable: a picture that fails to load hides itself (see icon()
// in sprites.ts), the Pikachu preview box goes away (see initArt below), and every control and label keeps working.
//
// scripts/build.mjs rewrites the line below when it is run with --local-art, to use the copy in ./assets/ instead
// (a checkout of the artwork repository: local development, tests, and the Claude-hosted copy of the site).
// Keep the committed value an absolute https:// URL ending in a slash; test/art.test.ts checks that.

export const ART_BASE = 'https://noxxionmurph.github.io/SaveHub-assets/';

/** Full URL (or page-relative path, for a local build) of one artwork file, e.g. "sprites/pokemon/25.png". */
export const artUrl = (path: string): string => `${ART_BASE}${path}`;

/** Pikachu's reaction sheet: 80 px wide, one 40 px row per reaction (see assets/CREDITS.md). */
export const PIKACHU_SHEET = 'sprites/pikachu.png';

/**
 * Run once at startup. Hands the stylesheet the address of the Pikachu sheet (CSS can't know ART_BASE, and a
 * background image fires no error event), and marks the page with data-art="off" if the artwork can't be loaded,
 * so the stylesheet can drop the pictures that would otherwise be left as empty boxes.
 */
export function initArt(): void {
  const page = document.documentElement;
  // Absolute, so it means the same thing wherever the stylesheet is served from.
  const sheet = new URL(artUrl(PIKACHU_SHEET), document.baseURI).href;
  page.style.setProperty('--pika-sheet', `url("${sheet}")`);
  const probe = new Image();
  probe.addEventListener('error', () => { page.dataset.art = 'off'; });
  probe.src = sheet;
}
