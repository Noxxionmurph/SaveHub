// Gen 3 decorations (pokeemerald src/data/decoration/header.h; Ruby and Sapphire have the same 120). The PC's
// decoration inventory is one id list per category in SaveBlock1, zero-filled after the last one (the game keeps them
// packed). A decoration placed in the bedroom or the secret base is matched by id, so the inventory is just a list.

export const DECOR_CATEGORIES = [
  { name: 'Desks', slots: 10 }, { name: 'Chairs', slots: 10 }, { name: 'Plants', slots: 10 }, { name: 'Ornaments', slots: 30 },
  { name: 'Mats', slots: 30 }, { name: 'Posters', slots: 10 }, { name: 'Dolls', slots: 40 }, { name: 'Cushions', slots: 10 },
] as const;

/** [id, name, category index] for every decoration. */
const TABLE: [number, string, number][] = [
  [1, 'Small Desk', 0],
  [2, 'Pokémon Desk', 0],
  [3, 'Heavy Desk', 0],
  [4, 'Ragged Desk', 0],
  [5, 'Comfort Desk', 0],
  [6, 'Pretty Desk', 0],
  [7, 'Brick Desk', 0],
  [8, 'Camp Desk', 0],
  [9, 'Hard Desk', 0],
  [10, 'Small Chair', 1],
  [11, 'Pokémon Chair', 1],
  [12, 'Heavy Chair', 1],
  [13, 'Pretty Chair', 1],
  [14, 'Comfort Chair', 1],
  [15, 'Ragged Chair', 1],
  [16, 'Brick Chair', 1],
  [17, 'Camp Chair', 1],
  [18, 'Hard Chair', 1],
  [19, 'Red Plant', 2],
  [20, 'Tropical Plant', 2],
  [21, 'Pretty Flowers', 2],
  [22, 'Colorful Plant', 2],
  [23, 'Big Plant', 2],
  [24, 'Gorgeous Plant', 2],
  [25, 'Red Brick', 3],
  [26, 'Yellow Brick', 3],
  [27, 'Blue Brick', 3],
  [28, 'Red Balloon', 3],
  [29, 'Blue Balloon', 3],
  [30, 'Yellow Balloon', 3],
  [31, 'Red Tent', 3],
  [32, 'Blue Tent', 3],
  [33, 'Solid Board', 3],
  [34, 'Slide', 3],
  [35, 'Fence Length', 3],
  [36, 'Fence Width', 3],
  [37, 'Tire', 3],
  [38, 'Stand', 3],
  [39, 'Mud Ball', 3],
  [40, 'Breakable Door', 3],
  [41, 'Sand Ornament', 3],
  [42, 'Silver Shield', 3],
  [43, 'Gold Shield', 3],
  [44, 'Glass Ornament', 3],
  [45, 'TV', 3],
  [46, 'Round TV', 3],
  [47, 'Cute TV', 3],
  [48, 'Glitter Mat', 4],
  [49, 'Jump Mat', 4],
  [50, 'Spin Mat', 4],
  [51, 'C Low Note Mat', 4],
  [52, 'D Note Mat', 4],
  [53, 'E Note Mat', 4],
  [54, 'F Note Mat', 4],
  [55, 'G Note Mat', 4],
  [56, 'A Note Mat', 4],
  [57, 'B Note Mat', 4],
  [58, 'C High Note Mat', 4],
  [59, 'Surf Mat', 4],
  [60, 'Thunder Mat', 4],
  [61, 'Fire Blast Mat', 4],
  [62, 'Powder Snow Mat', 4],
  [63, 'Attract Mat', 4],
  [64, 'Fissure Mat', 4],
  [65, 'Spikes Mat', 4],
  [66, 'Ball Poster', 5],
  [67, 'Green Poster', 5],
  [68, 'Red Poster', 5],
  [69, 'Blue Poster', 5],
  [70, 'Cute Poster', 5],
  [71, 'Pika Poster', 5],
  [72, 'Long Poster', 5],
  [73, 'Sea Poster', 5],
  [74, 'Sky Poster', 5],
  [75, 'Kiss Poster', 5],
  [76, 'Pichu Doll', 6],
  [77, 'Pikachu Doll', 6],
  [78, 'Marill Doll', 6],
  [79, 'Togepi Doll', 6],
  [80, 'Cyndaquil Doll', 6],
  [81, 'Chikorita Doll', 6],
  [82, 'Totodile Doll', 6],
  [83, 'Jigglypuff Doll', 6],
  [84, 'Meowth Doll', 6],
  [85, 'Clefairy Doll', 6],
  [86, 'Ditto Doll', 6],
  [87, 'Smoochum Doll', 6],
  [88, 'Treecko Doll', 6],
  [89, 'Torchic Doll', 6],
  [90, 'Mudkip Doll', 6],
  [91, 'Duskull Doll', 6],
  [92, 'Wynaut Doll', 6],
  [93, 'Baltoy Doll', 6],
  [94, 'Kecleon Doll', 6],
  [95, 'Azurill Doll', 6],
  [96, 'Skitty Doll', 6],
  [97, 'Swablu Doll', 6],
  [98, 'Gulpin Doll', 6],
  [99, 'Lotad Doll', 6],
  [100, 'Seedot Doll', 6],
  [101, 'Pika Cushion', 7],
  [102, 'Round Cushion', 7],
  [103, 'Kiss Cushion', 7],
  [104, 'Zigzag Cushion', 7],
  [105, 'Spin Cushion', 7],
  [106, 'Diamond Cushion', 7],
  [107, 'Ball Cushion', 7],
  [108, 'Grass Cushion', 7],
  [109, 'Fire Cushion', 7],
  [110, 'Water Cushion', 7],
  [111, 'Snorlax Doll', 6],
  [112, 'Rhydon Doll', 6],
  [113, 'Lapras Doll', 6],
  [114, 'Venusaur Doll', 6],
  [115, 'Charizard Doll', 6],
  [116, 'Blastoise Doll', 6],
  [117, 'Wailmer Doll', 6],
  [118, 'Regirock Doll', 6],
  [119, 'Regice Doll', 6],
  [120, 'Registeel Doll', 6],
];

export const DECOR_NAMES: Record<number, string> = Object.fromEntries(TABLE.map(([id, name]) => [id, name]));
/** The decorations of each category, in id order. */
export const DECORS_BY_CATEGORY: { id: number; name: string }[][] = DECOR_CATEGORIES.map((_, c) =>
  TABLE.filter((t) => t[2] === c).map(([id, name]) => ({ id, name })));
export const decorName = (id: number) => DECOR_NAMES[id] ?? `Decoration #${id}`;

/** Each category's list, as saved. `at` is the desks list (the rest follow it). */
export function readDecorations(d: Uint8Array, at: number): number[][] {
  let o = at;
  return DECOR_CATEGORIES.map((c) => {
    const list = [...d.subarray(o, o + c.slots)].filter((id) => id !== 0);
    o += c.slots;
    return list;
  });
}

export function writeDecorations(d: Uint8Array, at: number, lists: number[][]): void {
  let o = at;
  DECOR_CATEGORIES.forEach((c, i) => {
    d.fill(0, o, o + c.slots);
    lists[i].filter((id) => id > 0 && id < 256).slice(0, c.slots).forEach((id, j) => { d[o + j] = id; });
    o += c.slots;
  });
}
