# Credits

SaveForge is an unofficial, free, non-commercial fan tool. It is not affiliated with or endorsed by Nintendo,
Game Freak or Creatures Inc. Pokémon and everything that belongs to it is theirs.

The pictures are not part of this code repository. They live in a separate repository,
[SaveHub-assets](https://github.com/Noxxionmurph/SaveHub-assets), and the site loads them from there, so the editor works
the same (without the pictures) if they are ever removed. This is who made them.

## Pokémon, item and type icons

From **PokéSprite** by msikma (https://github.com/msikma/pokesprite), copied unchanged except for renaming the
Pokémon files to their National Dex number (and Unown's other letters to `201-<letter>.png`). PokéSprite's own code is MIT licensed; the artwork is not covered by that
licence.

## Gym badges

The eight Kanto badges are cut from the Red/Blue "Trainer Card" sheet on The Spriters Resource
(https://www.spriters-resource.com/game_boy_gbc/pokemonredblue/asset/8733/, ripped by FrenchOrange), using the Super
Game Boy colour panel. `scripts/extract-badges.py` redoes the cut.

The eight Johto badges are Gold and Silver's own trainer card badges, from the pret/pokegold disassembly
(https://github.com/pret/pokegold, `gfx/trainer_card/badges.png`), in the colours the game gives them on a Game Boy
Color (its badge palette). `scripts/extract-johto-badges.py` redoes them.

## Pikachu's reactions

`sprites/pikachu.png` (two 40x40 frames for each of the 18 ways your Pokémon Yellow starter reacts when you talk to it,
one reaction per row) holds Pokémon Yellow's own pictures in the Super Game Boy colours. They are cut from the
"Pikachu's moods" sheet on Serebii (https://www.serebii.net/yellow/pikachu.shtml), which is built from the game's
graphics. `scripts/extract-pikachu.py` redoes the cut. Frames that also exist in the pret/pokeyellow disassembly
(https://github.com/pret/pokeyellow, `gfx/pikachu/`) are pixel-identical to it, which is how each row was matched to
the game's name for it.

## Fonts

The site's three fonts are bundled in `fonts/`, cut down to Latin characters and the weights the site uses
(`scripts/make-fonts.py`), under the SIL Open Font License 1.1. The licence texts are in `fonts/OFL-*.txt`.

- **Instrument Sans**, © The Instrument Sans Project Authors (https://github.com/Instrument/instrument-sans)
- **JetBrains Mono**, © The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)
- **Pixelify Sans**, © The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans). The copy in `fonts/` is a modified version: its digit 5 is redrawn (it was the same shape as its S) and its ligatures are removed (see `scripts/make-fonts.py`).

## Game data

Save layouts and tables were worked out with the help of the pret disassemblies
([pokered](https://github.com/pret/pokered), [pokeyellow](https://github.com/pret/pokeyellow)) and checked against
cartridge dumps the author owns (`scripts/verify-against-rom.mjs`; nothing from the ROMs is stored in this repository).

All the pictures are © Nintendo / Creatures Inc. / GAME FREAK Inc.
