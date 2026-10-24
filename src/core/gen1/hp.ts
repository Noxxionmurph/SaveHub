// The in-game HP bar, as Red/Blue/Yellow draw it. The bar is 48 pixels long and its length is hp * 48 / maxHp
// (rounded down, but never less than 1 pixel while HP is above 0). Its colour comes from that length:
// green from 27 pixels, yellow from 10, red below that. Both rules are from the game's own code
// (engine/gfx/hp_bar.asm, GetHPBarLength; home/palettes.asm, GetHealthBarColor, in pret/pokered).

export const HP_BAR_PIXELS = 48;

export type HpBarColour = 'green' | 'yellow' | 'red';

/** How many of the bar's 48 pixels are filled. */
export function hpBarPixels(hp: number, maxHp: number): number {
  if (!(maxHp > 0) || !(hp > 0)) return 0;
  return Math.min(HP_BAR_PIXELS, Math.max(1, Math.floor((hp * HP_BAR_PIXELS) / maxHp)));
}

/** The colour of a bar `pixels` long. */
export function hpBarColour(pixels: number): HpBarColour {
  if (pixels >= 27) return 'green';
  if (pixels >= 10) return 'yellow';
  return 'red';
}
