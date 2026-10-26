import { Gen2Save } from '../core/gen2/save.ts';
import { defineGame } from '../core/types.ts';

const GAMES = ['Pokémon Gold', 'Pokémon Silver'] as const;

export default defineGame<Gen2Save>({
  id: 'pokemon-gen2',
  family: 'Pokémon',
  games: GAMES,
  platform: 'Game Boy Color · English',
  editable: 'Trainer name, money and all 16 badges; every pocket of the bag and PC items; every Pokémon in your party and 14 boxes (stats, moves, held items, shininess, gender, eggs, swapping and moving); box names; the Pokédex; and game options.',
  fileHint: 'Pokémon Gold and Silver (English) saves are 32,768 bytes (32 KB).',
  colors: { 'Pokémon Gold': '#c9a227', 'Pokémon Silver': '#9aa4b1' },
  // Each box's mascot: Ho-Oh and Lugia.
  icons: { 'Pokémon Gold': 'sprites/pokemon/250.png', 'Pokémon Silver': 'sprites/pokemon/249.png' },
  theme: 'gbc',
  detect: (data) => (Gen2Save.mainValid(data) ? { confidence: 'certain' } : null),
  // Gold and Silver write their saves at the same addresses in the same way, and nothing in the file says which
  // cartridge wrote it.
  identify: () => ({
    names: GAMES,
    note: "Gold and Silver saves are identical inside, so the file can't say which one yours is. Your choice only changes the name shown here; the editor works the same either way.",
  }),
  sample: async () => ({ fileName: 'sample-gold.sav', data: (await import('../core/gen2/sample.ts')).buildSampleSave() }),
  load: (data) => new Gen2Save(data),
  loadEditor: async () => (await import('../ui/editors/gen2/index.ts')).mountGen2Editor,
});
