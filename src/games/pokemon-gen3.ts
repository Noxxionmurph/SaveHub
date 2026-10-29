import { detectGen3 } from '../core/gen3/layout.ts';
import type { Gen3Save } from '../core/gen3/save.ts';
import { defineGame } from '../core/types.ts';

const GAMES = ['Pokémon Ruby', 'Pokémon Sapphire'] as const;

export default defineGame<Gen3Save>({
  id: 'pokemon-gen3',
  family: 'Pokémon',
  games: GAMES,
  platform: 'Game Boy Advance · English',
  editable: 'Everything from the Game Boy games, plus natures, abilities, IVs and EVs, where each Pokémon was met and its ball, the secret ID, the National Pokédex, the Berries pocket, and boxes of 30 that keep their gaps.',
  shelf: 'pokemon-gen3',
  fileHint: 'Pokémon Ruby and Sapphire (English) saves are 131,072 bytes (128 KB).',
  colors: { 'Pokémon Ruby': '#b8333a', 'Pokémon Sapphire': '#2f5fb3' },
  // Each box's mascot: Groudon and Kyogre.
  icons: { 'Pokémon Ruby': 'sprites/pokemon/383.png', 'Pokémon Sapphire': 'sprites/pokemon/382.png' },
  theme: 'gba',
  // Emerald's blocks are longer, so an Emerald save never passes as this (pokemon-emerald.ts opens those).
  detect: (data) => (detectGen3(data) === 'rs' ? { confidence: 'certain' } : null),
  // Ruby and Sapphire write their saves the same way, and nothing in the file says which cartridge wrote it.
  identify: () => ({
    names: GAMES,
    note: "Ruby and Sapphire saves are identical inside, so the file can't say which one yours is. Your choice only changes the name shown here; the editor works the same either way.",
  }),
  load: async (data) => new (await import('../core/gen3/save.ts')).Gen3Save(data, 'rs'),
  loadEditor: async () => (await import('../ui/editors/gen3/index.ts')).mountGen3Editor,
});
