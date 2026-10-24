// Pixel art only stays sharp when every source pixel is drawn as the same whole number of screen pixels. CSS pixels
// aren't screen pixels: on a phone, or a desktop set to 125% or 150%, one CSS pixel is 1.25, 1.5, 2.625... of them, so a
// size picked in CSS pixels ends up as a fractional scale and the edges come out soft and uneven. CSS can't read the
// scaling, so this publishes it as --dpr on the page; the stylesheet turns it into a size that is a whole multiple.

/** Keeps --dpr equal to the browser's device pixel ratio, including when the page is zoomed or moved to another screen. */
export function trackPixelRatio(): void {
  const page = document.documentElement;
  let ratio = 0;
  let query: MediaQueryList | undefined;
  const sync = (): void => {
    const now = window.devicePixelRatio || 1;
    if (now === ratio) return;
    ratio = now;
    page.style.setProperty('--dpr', String(now));
    // Zooming resizes the page, which `resize` reports. Moving the window to a screen with another ratio resizes
    // nothing; the only signal is this query, which stops matching the moment the ratio changes.
    query?.removeEventListener('change', sync);
    query = matchMedia(`(resolution: ${now}dppx)`);
    query.addEventListener('change', sync);
  };
  sync();
  window.addEventListener('resize', sync);
}
