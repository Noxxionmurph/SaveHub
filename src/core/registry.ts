// Registry of supported games. To add one: write its module under src/games/ and list it here.
import pokemonGen1 from '../games/pokemon-gen1.ts';
import type { Detection, EditableSave, GameModule } from './types.ts';

export const GAMES: GameModule[] = [
  pokemonGen1,
  // pokemonGen2, pokemonGen3, finalFantasy..., megaManBattleNetwork... go here.
];

export interface Match {
  module: GameModule;
  detection: Detection;
}

/** Every module whose detect() accepts the file, most confident first. A throwing detector never breaks the others. */
export function detectGames(data: Uint8Array): Match[] {
  const matches: Match[] = [];
  for (const module of GAMES) {
    try {
      const detection = module.detect(data);
      if (detection) matches.push({ module, detection });
    } catch {
      /* a buggy detector must not take the whole site down */
    }
  }
  return matches.sort((a, b) => Number(b.detection.confidence === 'certain') - Number(a.detection.confidence === 'certain'));
}

/** Convenience for tests/scripts: load with the single unambiguous match, or null. */
export function openSave(data: Uint8Array): { module: GameModule; save: EditableSave } | null {
  const matches = detectGames(data);
  if (matches.length !== 1) return null;
  return { module: matches[0].module, save: matches[0].module.load(data) };
}

/** Games grouped by series, for the landing page. */
export function gamesByFamily(): Map<string, GameModule[]> {
  const out = new Map<string, GameModule[]>();
  for (const g of GAMES) out.set(g.family, [...(out.get(g.family) ?? []), g]);
  return out;
}
