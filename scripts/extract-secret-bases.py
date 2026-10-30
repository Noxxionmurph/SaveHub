"""One-off: pull the secret base rooms, decoration shapes and pictures out of the pret/pokeemerald disassembly.

    python3 scripts/extract-secret-bases.py path/to/pokeemerald [path/to/pokeruby]

Writes
- src/core/gen3/baseData.ts: the 75 base spots, the 24 rooms (metatile grids), what each secret base metatile is for
  placing decorations (its behavior), and every decoration's shape, permission and metatiles or doll picture.
- assets/sprites/secret-bases/<kind>.png: every secret base metatile drawn in that kind's colours (red cave, brown
  cave, blue cave, yellow cave, tree, shrub), 16 to a row, metatile n at (n % 16, n / 16). The rooms and the
  decorations are both drawn from these, exactly as the game builds them.
- assets/sprites/secret-bases/dolls/<decoration id>.png: the dolls and cushions, which are sprites in the game.

With pokeruby too, it checks that Ruby and Sapphire's rooms and placement rules are the same, so one table serves all
three games. The finished pictures live in the artwork repository (checked out as ./assets/). Needs Pillow."""
import json
import re
import struct
import sys
from pathlib import Path
from PIL import Image

EM = Path(sys.argv[1])
RUBY = Path(sys.argv[2]) if len(sys.argv) > 2 else None
ROOT = Path(__file__).resolve().parent.parent
OUT_ART = ROOT / 'assets' / 'sprites' / 'secret-bases'
KINDS = ['red_cave', 'brown_cave', 'blue_cave', 'yellow_cave', 'tree', 'shrub']
LAYOUT_KINDS = ['RedCave', 'BrownCave', 'BlueCave', 'YellowCave', 'Tree', 'Shrub']
NUM_PRIMARY = 512
SHAPES = {'1x1': (1, 1), '2x1': (2, 1), '3x1': (3, 1), '4x2': (4, 2), '2x2': (2, 2), '1x2': (1, 2), '1x3': (1, 3),
          '2x4': (2, 4), '3x3': (3, 3), '3x2': (3, 2)}
PERMS = {'DECORPERM_SOLID_FLOOR': 'solid', 'DECORPERM_PASS_FLOOR': 'pass', 'DECORPERM_BEHIND_FLOOR': 'behind',
         'DECORPERM_NA_WALL': 'wall', 'DECORPERM_SPRITE': 'sprite'}
# What a metatile is, as far as placing decorations goes (pokeemerald src/decoration.c CanPlaceDecoration).
CLASSES = {'MB_NORMAL': '.', 'MB_SECRET_BASE_NORTH_WALL': 'W', 'MB_SECRET_BASE_TRAINER_SPOT': 'T',
           'MB_SECRET_BASE_HOLE': 'H', 'MB_HOLDS_SMALL_DECORATION': 's', 'MB_HOLDS_LARGE_DECORATION': 'l'}


def u16s(path: Path) -> list[int]:
    b = path.read_bytes()
    return list(struct.unpack(f'<{len(b) // 2}H', b))


def behaviors(repo: Path) -> list[str]:
    """MB_ names in enum order."""
    body = (repo / 'include/constants/metatile_behaviors.h').read_text()
    names, n = {}, 0
    for m in re.finditer(r'^\s*(MB_\w+)(?:\s*=\s*(\w+))?,', body, re.M):
        if m.group(2):
            n = int(m.group(2), 0)
        names[n] = m.group(1)
        n += 1
    return names


def classes(repo: Path) -> str:
    """One character per secret base metatile: '.' floor, 'W' north wall, 'T' trainer spot, 'H' hole, 's'/'l' holds a
    small/large doll, 'x' anything else; uppercase-insensitive layer flag kept separately."""
    names = behaviors(EM)  # Ruby's behaviors have the same numbers (some under other names)
    attrs = u16s(repo / 'data/tilesets/secondary/secret_base/metatile_attributes.bin')
    return ''.join(CLASSES.get(names.get(a & 0xff, ''), 'x') for a in attrs)


def layers(repo: Path) -> str:
    """'0' when a metatile is on the normal layer (drawn under the player), '1' otherwise."""
    return ''.join('0' if a >> 12 == 0 else '1' for a in u16s(repo / 'data/tilesets/secondary/secret_base/metatile_attributes.bin'))


def jasc(path: Path) -> list[tuple[int, int, int]]:
    v = path.read_text().split()
    return [tuple(int(x) for x in v[3 + i * 3:6 + i * 3]) for i in range(int(v[2]))]


def tiles(png: Path) -> list[list[int]]:
    im = Image.open(png)
    assert im.mode == 'P', png
    w, h = im.size
    px = list(im.getdata())
    out = []
    for ty in range(h // 8):
        for tx in range(w // 8):
            out.append([px[(ty * 8 + y) * w + tx * 8 + x] & 15 for y in range(8) for x in range(8)])
    return out


def atlas(kind: str) -> Image.Image:
    prim = tiles(EM / 'data/tilesets/primary/secret_base/tiles.png')
    sec = tiles(EM / f'data/tilesets/secondary/secret_base/{kind}/tiles.png')
    pals = [jasc(EM / f'data/tilesets/primary/secret_base/palettes/{i:02}.pal') for i in range(6)]
    pals += [jasc(EM / f'data/tilesets/secondary/secret_base/{kind}/palettes/{i:02}.pal') for i in range(6, 13)]
    backdrop = pals[0][0]
    metas = u16s(EM / 'data/tilesets/secondary/secret_base/metatiles.bin')
    count = len(metas) // 8
    img = Image.new('RGB', (16 * 16, ((count + 15) // 16) * 16), backdrop)
    put = img.load()
    for m in range(count):
        ox, oy = (m % 16) * 16, (m // 16) * 16
        for layer in range(2):
            for q in range(4):
                e = metas[m * 8 + layer * 4 + q]
                t, hf, vf, pal = e & 0x3ff, e >> 10 & 1, e >> 11 & 1, e >> 12
                data = prim[t] if t < NUM_PRIMARY else sec[t - NUM_PRIMARY] if t - NUM_PRIMARY < len(sec) else [0] * 64
                for y in range(8):
                    for x in range(8):
                        c = data[(7 - y if vf else y) * 8 + (7 - x if hf else x)]
                        if c:
                            put[ox + (q % 2) * 8 + x, oy + (q // 2) * 8 + y] = pals[pal][c] if pal < len(pals) else (255, 0, 255)
    return img


def spots(repo: Path) -> list[tuple[int, int, str, int]]:
    ids = {m.group(1): int(m.group(2)) for m in re.finditer(r'#define (SECRET_BASE_\w+_\d)\s+(\d+)',
                                                             (repo / 'include/constants/secret_bases.h').read_text())}
    secs = json.loads((EM / 'src/data/region_map/region_map_sections.json').read_text())['map_sections']
    sec_index = {s['id']: i for i, s in enumerate(secs)}
    sec_name = {s['id']: s['name'] for s in secs}
    out = []
    for f in sorted((EM / 'data/maps').glob('*/map.json')):
        m = json.loads(f.read_text())
        for e in m.get('bg_events', []):
            if e.get('type') == 'secret_base':
                sec = m['region_map_section']
                out.append((ids[e['secret_base_id']], sec_index[sec], sec_name[sec].title(), e['y']))
    return sorted(out)


def rooms() -> list[dict]:
    layouts = {l['name']: l for l in json.loads((EM / 'data/layouts/layouts.json').read_text())['layouts'] if l}
    comp = (EM / 'src/secret_base.c').read_text()
    out = []
    for g in range(24):
        name = f'SecretBase_{LAYOUT_KINDS[g // 4]}{g % 4 + 1}'
        lay = layouts[f'{name}_Layout']
        cells = [v & 0x3ff for v in u16s(EM / lay['blockdata_filepath'])]
        assert all(c >= NUM_PRIMARY for c in cells), name
        const = re.sub(r'(?<!^)(?=[A-Z])', '_', f'{LAYOUT_KINDS[g // 4]}{g % 4 + 1}').upper().replace('CAVE', 'CAVE')
        m = re.search(rf'\[SECRET_BASE_{const}\]\s*=\s*MAP_NUM\(\w+\),\s*(\d+),\s*(\d+),\s*(\d+)', comp)
        out.append({'w': lay['width'], 'h': lay['height'], 'pc': [int(m.group(2)), int(m.group(3))],
                    'cells': [c - NUM_PRIMARY for c in cells]})
    return out


def decorations() -> tuple[list, dict]:
    labels = {m.group(1): int(m.group(2), 16) for m in re.finditer(r'#define METATILE_SecretBase_(\w+)\s+0x([0-9A-Fa-f]+)',
                                                                  (EM / 'include/constants/metatile_labels.h').read_text())}
    gfx = {}
    for m in re.finditer(r'const u16 (DecorGfx_\w+)\[\] = \{(.*?)\};', (EM / 'src/data/decoration/tiles.h').read_text(), re.S):
        gfx[m.group(1)] = [t.strip() for t in m.group(2).split(',') if t.strip()]
    ids = {m.group(1): int(m.group(2)) for m in re.finditer(r'#define (DECOR_\w+)\s+(\d+)\b',
                                                            (EM / 'include/constants/decorations.h').read_text())}
    head = (EM / 'src/data/decoration/header.h').read_text()
    table, sprites = [], {}
    for name, body in re.findall(r'\[(DECOR_\w+)\]\s*=\s*\{(.*?)\n    \}', head, re.S):
        if name == 'DECOR_NONE':
            continue
        f = dict(re.findall(r'\.(\w+) = ([^,\n]+),', body))
        w, h = SHAPES[f['shape'].removeprefix('DECORSHAPE_')]
        perm = PERMS[f['permission']]
        parts = gfx[f['tiles']]
        if perm == 'sprite':
            sprites[ids[name]] = parts[0]
            table.append([ids[name], perm, w, h, []])
        else:
            tl = [labels[re.match(r'DECOR_TILE\((\w+)\)', p).group(1)] - NUM_PRIMARY for p in parts]
            assert len(tl) == w * h, name
            table.append([ids[name], perm, w, h, tl])
    return table, sprites


def doll_pictures(sprites: dict) -> None:
    ptrs = dict(re.findall(r'\[(OBJ_EVENT_GFX_\w+)\]\s*=\s*&(gObjectEventGraphicsInfo_\w+)',
                           (EM / 'src/data/object_events/object_event_graphics_info_pointers.h').read_text()))
    info = (EM / 'src/data/object_events/object_event_graphics_info.h').read_text()
    pics = dict(re.findall(r'const u32 (gObjectEventPic_\w+)\[\] = INCGFX_U32\("([^"]+)\.png"',
                           (EM / 'src/data/object_events/object_event_graphics.h').read_text()))
    tables = dict(re.findall(r'(sPicTable_\w+)\[\] = \{\s*\w+\((gObjectEventPic_\w+)',
                             (EM / 'src/data/object_events/object_event_pic_tables.h').read_text()))
    tags = {'OBJ_EVENT_PAL_TAG_NPC_1': 'npc_1', 'OBJ_EVENT_PAL_TAG_NPC_2': 'npc_2', 'OBJ_EVENT_PAL_TAG_NPC_3': 'npc_3',
            'OBJ_EVENT_PAL_TAG_NPC_4': 'npc_4'}
    (OUT_ART / 'dolls').mkdir(parents=True, exist_ok=True)
    for decor, gfx in sprites.items():
        body = re.search(rf'{ptrs[gfx]} = \{{(.*?)\n\}};', info, re.S).group(1)
        pal = jasc(EM / f'graphics/object_events/palettes/{tags[re.search(r"paletteTag = (\w+)", body).group(1)]}.pal')
        w, h = int(re.search(r'\.width = (\d+)', body).group(1)), int(re.search(r'\.height = (\d+)', body).group(1))
        src = Image.open(EM / (pics[tables[re.search(r'\.images = (\w+)', body).group(1)]] + '.png'))
        frame = src.crop((0, 0, w, h))
        img = Image.new('RGBA', (w, h))
        img.putdata([(0, 0, 0, 0) if p % 16 == 0 else (*pal[p % 16], 255) for p in frame.getdata()])
        img.save(OUT_ART / 'dolls' / f'{decor}.png')


cls, lay = classes(EM), layers(EM)
if RUBY:
    assert classes(RUBY) == cls, 'Ruby and Sapphire place decorations differently'
    for g in range(24):
        name = f'SecretBase_{LAYOUT_KINDS[g // 4]}{g % 4 + 1}'
        assert (RUBY / f'data/layouts/{name}/map.bin').read_bytes() == (EM / f'data/layouts/{name}/map.bin').read_bytes(), name
    assert [s[:2] for s in spots(RUBY)] == [s[:2] for s in spots(EM)], 'Ruby and Sapphire have other base spots'

OUT_ART.mkdir(parents=True, exist_ok=True)
for k in KINDS:
    atlas(k).save(OUT_ART / f'{k}.png')
table, sprites = decorations()
doll_pictures(sprites)

base_spots = spots(EM)
room_list = rooms()
lines = [
    '// Generated by scripts/extract-secret-bases.py from the pret/pokeemerald disassembly. Ruby and Sapphire match.',
    '',
    '/** [secret base id, region map section (VAR_SECRET_BASE_MAP), route name, y on the route map]. The id / 10 is the',
    ' * room (ROOMS index); rooms 0-3 are red caves, 4-7 brown, 8-11 blue, 12-15 yellow, 16-19 trees, 20-23 shrubs. */',
    'export const BASE_SPOTS: [number, number, string, number][] = [',
    *[f'  [{i}, {s}, {json.dumps(n)}, {y}],' for i, s, n, y in base_spots],
    '];',
    '',
    '/** Each room: size in metatiles, where its PC is, and its metatiles (secret base tileset index) row by row. */',
    'export const ROOMS: { w: number; h: number; pc: [number, number]; cells: number[] }[] = [',
    *[f'  {{ w: {r["w"]}, h: {r["h"]}, pc: [{r["pc"][0]}, {r["pc"][1]}], cells: {json.dumps(r["cells"])} }},' for r in room_list],
    '];',
    '',
    "/** Per secret base metatile: '.' floor, 'W' north wall, 'T' trainer spot, 'H' hole, 's'/'l' holds a small/large doll,",
    " * 'x' anything else. */",
    f'export const METATILE_KIND = {json.dumps(cls)};',
    "/** Per secret base metatile: '0' on the normal layer, '1' covered (drawn over the player). */",
    f'export const METATILE_LAYER = {json.dumps(lay)};',
    '',
    '/** [decoration id, permission, width, height, metatiles top row first (none for dolls and cushions)]. */',
    "export const DECOR_PLACING: [number, 'solid' | 'pass' | 'behind' | 'wall' | 'sprite', number, number, number[]][] = [",
    *[f'  [{i}, {json.dumps(p)}, {w}, {h}, {json.dumps(t)}],' for i, p, w, h, t in table],
    '];',
    '',
]
(ROOT / 'src/core/gen3/baseData.ts').write_text('\n'.join(lines))
print(f'{len(base_spots)} spots, {len(room_list)} rooms, {len(table)} decorations ({len(sprites)} sprites)')
