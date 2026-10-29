import { detectGen3 } from '../core/gen3/layout.ts';
import type { Gen3Save } from '../core/gen3/save.ts';
import { defineGame } from '../core/types.ts';

const GAMES = ['Pokémon Emerald'] as const;

// Emerald uses the Ruby / Sapphire editor, with its own save layout (see GEN3_LAYOUTS in layout.ts).
export default defineGame<Gen3Save>({
  id: 'pokemon-emerald',
  family: 'Pokémon',
  games: GAMES,
  platform: 'Game Boy Advance · English',
  // Shown on Ruby and Sapphire's shelf, under their "you can edit" line.
  shelf: 'pokemon-gen3',
  fileHint: 'Pokémon Emerald (English) saves are 131,072 bytes (128 KB).',
  colors: { 'Pokémon Emerald': '#2e9e5b' },
  // The box's mascot: Rayquaza.
  icons: { 'Pokémon Emerald': 'sprites/pokemon/384.png' },
  theme: 'gba',
  detect: (data) => (detectGen3(data) === 'emerald' ? { confidence: 'certain' } : null),
  load: async (data) => new (await import('../core/gen3/save.ts')).Gen3Save(data, 'emerald'),
  sample: async () => ({ fileName: 'sample-emerald.sav', data: (await import('../core/gen3/sample.ts')).buildSampleSave('emerald') }),
  loadEditor: async () => (await import('../ui/editors/gen3/index.ts')).mountGen3Editor,
});
