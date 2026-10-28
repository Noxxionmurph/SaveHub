// A Gen 3 Pokémon's ribbons (pokeemerald include/pokemon.h, the ribbon bits of the misc substructure's word at 0x08).
// The five contest ribbons are a rank (0 none, 1 Normal ... 4 Master) and a Pokémon holds every rank up to it; the
// rest are one bit each. Bits 27-31 aren't ribbons (bit 31 is the fateful-encounter flag) and are never touched.

export const CONTEST_CATEGORIES = ['Cool', 'Beauty', 'Cute', 'Smart', 'Tough'] as const;
export const CONTEST_RANKS = ['Normal', 'Super', 'Hyper', 'Master'] as const;

/** The one-bit ribbons: bit, the game's ribbon id (for its picture), name, and how it's earned. */
export const SINGLE_RIBBONS = [
  { bit: 15, id: 0, name: 'Champion', how: 'Beat the Champion' },
  { bit: 16, id: 21, name: 'Winning', how: 'Battle Tower, Level 50' },
  { bit: 17, id: 22, name: 'Victory', how: 'Battle Tower, Open Level' },
  { bit: 18, id: 23, name: 'Artist', how: 'Master Rank portrait' },
  { bit: 19, id: 24, name: 'Effort', how: 'Maximum EVs' },
] as const;

/** The seven event ("gift") ribbons. Which event each stands for is kept once per save (SaveBlock1 giftRibbons). */
export const GIFT_RIBBONS = [
  { bit: 20, id: 25, name: 'Marine' }, { bit: 21, id: 26, name: 'Land' }, { bit: 22, id: 27, name: 'Sky' },
  { bit: 23, id: 28, name: 'Country' }, { bit: 24, id: 29, name: 'National' }, { bit: 25, id: 30, name: 'Earth' },
  { bit: 26, id: 31, name: 'World' },
] as const;

/** All the ribbon bits (0-26). */
export const RIBBON_MASK = (1 << 27) - 1;

/** A contest category's rank, 0 (none) to 4 (Master). */
export const contestRank = (ribbons: number, cat: number) => (ribbons >>> (cat * 3)) & 7;

export function setContestRank(ribbons: number, cat: number, rank: number): number {
  return ((ribbons & ~(7 << (cat * 3))) | ((Math.max(0, Math.min(4, rank)) & 7) << (cat * 3))) >>> 0;
}

export const hasRibbon = (ribbons: number, bit: number) => ((ribbons >>> bit) & 1) === 1;

export const setRibbon = (ribbons: number, bit: number, on: boolean) =>
  (on ? ribbons | (1 << bit) : ribbons & ~(1 << bit)) >>> 0;

/** The game's ribbon id for a contest ribbon (COOL_RIBBON_NORMAL 1 ... TOUGH_RIBBON_MASTER 20), for its picture. */
export const contestRibbonId = (cat: number, rank: number) => 1 + cat * 4 + (rank - 1);

/** How many ribbons the game counts (the PokéNav and the summary screen): each contest rank held counts. */
export function ribbonCount(ribbons: number): number {
  let n = 0;
  for (let c = 0; c < 5; c++) n += Math.min(contestRank(ribbons, c), 4);
  for (let b = 15; b <= 26; b++) n += (ribbons >>> b) & 1;
  return n;
}

/** Every ribbon a Pokémon has, by name, for the review list. */
export function ribbonNames(ribbons: number): string[] {
  const out: string[] = [];
  CONTEST_CATEGORIES.forEach((cat, c) => {
    const r = contestRank(ribbons, c);
    if (r) out.push(`${cat} ${CONTEST_RANKS[Math.min(r, 4) - 1]}`);
  });
  for (const r of [...SINGLE_RIBBONS, ...GIFT_RIBBONS]) if (hasRibbon(ribbons, r.bit)) out.push(r.name);
  return out;
}
