import { detectGen2 } from '../core/gen2/layout.ts';
import type { Gen2Save } from '../core/gen2/save.ts';
import { defineGame } from '../core/types.ts';

const GAMES = ['Pokémon Crystal'] as const;

// Crystal uses the Gold / Silver editor, with its own save layout (see GEN2_LAYOUTS in layout.ts).
export default defineGame<Gen2Save>({
  id: 'pokemon-crystal',
  family: 'Pokémon',
  games: GAMES,
  platform: 'Game Boy Color · English',
  // Shown on Gold and Silver's shelf, under their "you can edit" line (which covers Crystal's extras).
  shelf: 'pokemon-gen2',
  fileHint: 'Pokémon Crystal (English) saves are 32,768 bytes (32 KB).',
  colors: { 'Pokémon Crystal': '#5fb4d9' },
  // The box's mascot: Suicune.
  icons: { 'Pokémon Crystal': 'sprites/pokemon/245.png' },
  theme: 'gbc',
  detect: (data) => (detectGen2(data) === 'crystal' ? { confidence: 'certain' } : null),
  sample: async () => ({ fileName: 'sample-crystal.sav', data: (await import('../core/gen2/sample.ts')).buildSampleSave('crystal') }),
  load: async (data) => new (await import('../core/gen2/save.ts')).Gen2Save(data, 'crystal'),
  loadEditor: async () => (await import('../ui/editors/gen2/index.ts')).mountGen2Editor,
});
