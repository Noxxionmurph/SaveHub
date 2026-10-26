"""Opens a Gold / Silver save in the real game, in the PyBoy emulator, and takes pictures along the way: the CONTINUE
summary, the overworld, the party, and the first Pokémon's summary pages. Use it to check that a file the editor
wrote still loads in the game. Needs your own cartridge dump (nothing from it is stored in this repository) and
`pip install pyboy pillow`.

    python3 scripts/boot-gen2-save.py path/to/gold.gbc path/to/edited.sav out.png
"""
import io
import sys
from pyboy import PyBoy
from PIL import Image

rom, sav, out = sys.argv[1:4]
pb = PyBoy(rom, window='null', ram_file=io.BytesIO(open(sav, 'rb').read()), sound_emulated=False)
pb.set_emulation_speed(0)


def wait(frames):
    for _ in range(frames):
        pb.tick()


def press(button, frames=30):
    pb.button(button, 8)
    wait(frames)


def shot():
    shots.append(pb.screen.image.convert('RGB').copy())


shots = []
wait(1500)                                   # the intro
press('start', 200)                          # to the title screen
press('start', 200)                          # to CONTINUE / NEW GAME
press('a', 300); shot()                      # CONTINUE: the save's summary window
press('a', 900); shot()                      # into the game
press('start', 60); press('down', 20); press('a', 200); shot()   # POKéMON
press('a', 60); press('a', 200); shot()      # the first one's STATS
press('right', 60); shot()
press('right', 60); shot()
pb.stop(save=False)                          # the save file is never written back

sheet = Image.new('RGB', (160 * len(shots), 144))
for i, s in enumerate(shots):
    sheet.paste(s, (i * 160, 0))
sheet.resize((sheet.width * 2, 288), Image.NEAREST).save(out)
print(f'wrote {out}')
