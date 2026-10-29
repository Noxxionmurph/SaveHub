// The HP bar, drawn for every generation. Each game's core/<game>/hp.ts says how many of the bar's pixels a Pokémon's
// HP fills and which colour that is; editors/<game>/hpBar.ts works out a Pokémon's HP and passes them here.

import { h } from './dom.ts';

export interface HpBarRules {
  HP_BAR_PIXELS: number;
  hpBarPixels(hp: number, maxHp: number): number;
  hpBarColour(pixels: number): string;
}

/**
 * The bar. `meter` makes it readable to a screen reader on its own (the Pokémon window); in lists it is a picture,
 * since the HP is in the readout. Returns null when the maximum isn't known, so there is nothing to draw.
 */
export function drawHpBar(rules: HpBarRules, hp: number, maxHp: number, cls = '', meter = false): HTMLElement | null {
  if (!(maxHp > 0)) return null;
  const px = rules.hpBarPixels(hp, maxHp);
  const bar = h('span', {
    class: `hp-bar hp-${rules.hpBarColour(px)} ${cls}`.trim(),
    ...(meter
      ? { role: 'meter', 'aria-label': 'HP', 'aria-valuemin': 0, 'aria-valuemax': maxHp, 'aria-valuenow': Math.min(Math.max(hp, 0), maxHp) }
      : { 'aria-hidden': 'true' }),
    dataset: { px: String(px) },
  }, h('span', { class: 'hp-fill' }));
  bar.style.setProperty('--fill', `${((px / rules.HP_BAR_PIXELS) * 100).toFixed(2)}%`);
  return bar;
}
