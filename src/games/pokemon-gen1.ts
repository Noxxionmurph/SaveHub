import { Gen1Save, gen1Handler, looksLikeYellow } from '../core/gen1/save.ts';
import { defineGame } from '../core/types.ts';

const GAMES = ['Pokémon Red', 'Pokémon Blue', 'Pokémon Yellow'] as const;

export default defineGame<Gen1Save>({
  id: 'pokemon-gen1',
  family: 'Pokémon',
  games: GAMES,
  platform: 'Game Boy · English',
  editable: 'Trainer, money and badges; bag and PC items; every Pokémon in your party and boxes; the Pokédex; options. Yellow also has Pikachu’s friendship.',
  fileHint: 'Pokémon Red, Blue and Yellow (English) saves are 32,768 bytes (32 KB).',
  colors: { 'Pokémon Red': '#c0392b', 'Pokémon Blue': '#2d62b8', 'Pokémon Yellow': '#e2b007' },
  // Each box's mascot: Charizard, Blastoise, Pikachu.
  icons: {
    'Pokémon Red': 'sprites/pokemon/6.png',
    'Pokémon Blue': 'sprites/pokemon/9.png',
    'Pokémon Yellow': 'sprites/pokemon/25.png',
  },
  detect: (data) => (gen1Handler.detect(data) ? { confidence: 'certain' } : null),
  // Yellow writes Pikachu's state into the save, so it can be told apart. Red and Blue are byte-for-byte the
  // same format and nothing in the file says which cartridge wrote it.
  identify: (data) => (looksLikeYellow(data)
    ? { names: ['Pokémon Yellow'] }
    : { names: ['Pokémon Red', 'Pokémon Blue'], note: "Red and Blue saves are identical inside, so the file can't say which one yours is. Your choice only changes the name shown here; the editor works the same either way." }),
  sample: async () => ({ fileName: 'sample-yellow.sav', data: (await import('../core/gen1/sample.ts')).buildSampleSave() }),
  sampleGame: 'Pokémon Yellow',
  // Worded as src/core/gen1/diff.ts writes them.
  demo: {
    game: 'Pokémon Yellow',
    groups: [
      { title: 'Trainer', lines: ['Money: ¥3,000 → ¥999,999'] },
      { title: 'Bag', lines: ['Added Rare Candy ×99'] },
      { title: 'Pokémon', lines: ['Pikachu (Party 1): level 12 → 50'] },
    ],
  },
  load: (data) => new Gen1Save(data),
  loadEditor: async () => (await import('../ui/editors/gen1/index.ts')).mountGen1Editor,
});
