import { Gen1Save, gen1Handler, looksLikeYellow } from '../core/gen1/save.ts';
import { defineGame } from '../core/types.ts';

const GAMES = ['Pokémon Red', 'Pokémon Blue', 'Pokémon Yellow'] as const;

export default defineGame<Gen1Save>({
  id: 'pokemon-gen1',
  family: 'Pokémon',
  games: GAMES,
  platform: 'Game Boy · English',
  colors: { 'Pokémon Red': '#c0392b', 'Pokémon Blue': '#2d62b8', 'Pokémon Yellow': '#e2b007' },
  // Each box's mascot: Charizard, Blastoise, Pikachu.
  icons: {
    'Pokémon Red': 'assets/sprites/pokemon/6.png',
    'Pokémon Blue': 'assets/sprites/pokemon/9.png',
    'Pokémon Yellow': 'assets/sprites/pokemon/25.png',
  },
  detect: (data) => (gen1Handler.detect(data) ? { confidence: 'certain' } : null),
  // Yellow writes Pikachu's state into the save, so it can be told apart. Red and Blue are byte-for-byte the
  // same format and nothing in the file says which cartridge wrote it.
  identify: (data) => (looksLikeYellow(data)
    ? { names: ['Pokémon Yellow'] }
    : { names: ['Pokémon Red', 'Pokémon Blue'], note: "Red and Blue saves look identical, so the file can't say which one yours is." }),
  sample: async () => ({ fileName: 'sample.sav', data: (await import('../core/gen1/sample.ts')).buildSampleSave() }),
  load: (data) => new Gen1Save(data),
  loadEditor: async () => (await import('../ui/editors/gen1/index.ts')).mountGen1Editor,
});
