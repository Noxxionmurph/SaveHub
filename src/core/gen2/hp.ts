// The in-game HP bar, as Gold and Silver draw it. The bar is 48 pixels long; its length is hp * 48 / maxHp, rounded
// down but never less than 1 pixel while HP is above 0, and when max HP is 256 or more both sides are divided by 4
// first (pokegold: ComputeHPBarPixels). Its colour comes from that length: green from 24 pixels (half the bar), yellow
// from 10, red below that (pokegold: GetHPPal). Gen 1's bar turns yellow later, at 27 pixels.

export const HP_BAR_PIXELS = 48;

export type HpBarColour = 'green' | 'yellow' | 'red';

export function hpBarPixels(hp: number, maxHp: number): number {
  if (!(maxHp > 0) || !(hp > 0)) return 0;
  let num = hp * HP_BAR_PIXELS, den = maxHp;
  if (den >= 256) { num >>= 2; den >>= 2; }
  return Math.min(HP_BAR_PIXELS, Math.max(1, Math.floor(num / den)));
}

export function hpBarColour(pixels: number): HpBarColour {
  if (pixels >= 24) return 'green';
  if (pixels >= 10) return 'yellow';
  return 'red';
}
