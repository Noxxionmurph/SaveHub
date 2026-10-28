// The game's own counters (pokeemerald include/constants/game_stat.h, pokeruby the same up to 49). Each is a u32 in
// SaveBlock1, XORed with the key in Emerald. The game stops counting at 16,777,215. Stat 1 is the play time of the
// first Hall of Fame entry, packed as hours << 16 | minutes << 8 | seconds; stats 22 and 31 are never used.

import type { Gen3Game } from './data.ts';

export const GAME_STAT_MAX = 0xffffff;
export const HOF_TIME_STAT = 1;
export const HOF_ENTERED_STAT = 10;

export interface GameStat { index: number; name: string }

/** The counters in groups, as the editor shows them. */
export function gameStatGroups(game: Gen3Game): { title: string; stats: GameStat[] }[] {
  const em = game === 'emerald';
  const s = (index: number, name: string): GameStat => ({ index, name });
  return [
    { title: 'Battles', stats: [
      s(7, 'Battles'), s(8, 'Wild battles'), s(9, 'Trainer battles'), s(10, 'Hall of Fame entries'),
      s(26, 'Splash used'), s(27, 'Struggle used'),
      s(30, 'Battle Tower visits'), s(32, em ? 'Battle Tower singles streak' : 'Battle Tower best streak'),
    ] },
    { title: 'Pokémon', stats: [
      s(11, 'Pokémon caught'), s(12, em ? 'Fishing encounters' : 'Pokémon caught fishing'), s(13, 'Eggs hatched'),
      s(14, 'Pokémon evolved'), s(21, 'Trades'), s(47, 'Day Care visits'), s(42, 'Ribbons received'), s(41, 'Pokédex checks'),
    ] },
    { title: 'Getting around', stats: [
      s(5, 'Steps'), s(43, 'Ledges jumped'), s(18, 'Cut used'), s(19, 'Rock Smash used'), s(48, 'Cable Car rides'),
      s(17, 'Safari Zone visits'), s(49, 'Hot spring visits'), s(40, 'Times rained on'), s(39, 'Itemfinder uses'),
    ] },
    { title: 'Everyday', stats: [
      s(0, 'Times saved'), s(15, 'Pokémon Center visits'), s(16, 'Rests at home'), s(38, 'Shopping trips'),
      s(44, 'TV watched'), s(45, 'Clock checks'), s(6, 'Interviews'), s(2, 'Trends started'), s(3, 'Berries planted'),
      s(4, 'Bikes traded'), s(20, 'Secret Base moves'),
    ] },
    { title: 'Contests and games', stats: [
      s(36, 'Contests entered'), s(37, 'Contests won'), s(35, 'Link contests won'), s(33, 'Pokéblocks made'),
      s(34, 'Pokéblocks made with friends'), s(28, 'Slot jackpots'), s(29, 'Roulette win streak'), s(46, 'Lottery wins'),
      ...(em ? [s(51, 'Berry Crush games')] : []),
    ] },
    { title: 'Link', stats: [
      s(23, 'Link battle wins'), s(24, 'Link battle losses'), s(25, 'Link battle draws'),
      ...(em ? [s(50, 'Union Room battles')] : []),
    ] },
  ];
}

/** How many counters the game keeps (Ruby and Sapphire 50, Emerald 52). */
export const gameStatCount = (game: Gen3Game) => (game === 'emerald' ? 52 : 50);

/** Stat 1 as hours, minutes and seconds. */
export const unpackHofTime = (v: number) => ({ hours: v >>> 16, minutes: (v >>> 8) & 0xff, seconds: v & 0xff });
export const packHofTime = (t: { hours: number; minutes: number; seconds: number }) =>
  ((Math.min(t.hours, 999) << 16) | (Math.min(t.minutes, 59) << 8) | Math.min(t.seconds, 59)) >>> 0;
