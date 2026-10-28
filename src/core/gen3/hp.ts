// The in-game HP bar, as Ruby, Sapphire and Emerald draw it. The bar is 48 pixels long; its length is hp * 48 / maxHp,
// rounded down but never less than 1 pixel while HP is above 0 (pokeemerald: GetScaledHPFraction). Its colour comes
// from that length: green above 24 pixels (half the bar), yellow above 9, red below that (GetHPBarLevel).

export const HP_BAR_PIXELS = 48;

export type HpBarColour = 'green' | 'yellow' | 'red';

export function hpBarPixels(hp: number, maxHp: number): number {
  if (!(maxHp > 0) || !(hp > 0)) return 0;
  return Math.min(HP_BAR_PIXELS, Math.max(1, Math.floor((hp * HP_BAR_PIXELS) / maxHp)));
}

export function hpBarColour(pixels: number): HpBarColour {
  if (pixels > 24) return 'green';
  if (pixels > 9) return 'yellow';
  return 'red';
}
