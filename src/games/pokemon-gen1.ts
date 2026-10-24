import { Gen1Save, gen1Handler } from '../core/gen1/save.ts';
import { defineGame } from '../core/types.ts';

const GAMES = ['Pokémon Red', 'Pokémon Blue', 'Pokémon Yellow'] as const;

export default defineGame<Gen1Save>({
  id: 'pokemon-gen1',
  family: 'Pokémon',
  games: GAMES,
  platform: 'Game Boy · English',
  colors: { 'Pokémon Red': '#c0392b', 'Pokémon Blue': '#2d62b8', 'Pokémon Yellow': '#e2b007' },
  detect: (data) => (gen1Handler.detect(data) ? { confidence: 'certain' } : null),
  // Red and Blue share one save format and nothing in the file says which cartridge wrote it.
  identify: () => ({ names: GAMES, note: "This save format doesn't record the exact version." }),
  load: (data) => new Gen1Save(data),
  loadEditor: async () => (await import('../ui/editors/gen1/index.ts')).mountGen1Editor,
});
