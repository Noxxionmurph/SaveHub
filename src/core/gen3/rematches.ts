// Emerald's trainer rematches (pokeemerald src/battle_setup.c gRematchTable, include/constants/rematches.h). Each
// Match Call trainer has a byte in SaveBlock1 trainerRematches: 0, or which of their five teams they'll use next when
// they call for a rematch. The game picks the first team the player hasn't beaten yet (SetRematchIdForTrainer: a
// team counts as beaten once its trainer flag, TRAINER_FLAGS_START + trainer id, is set). Gym leaders are picked by
// src/gym_leader_rematch.c instead, once the game is cleared (Wattson after New Mauville), counting from their first
// team. The Elite Four entries after these are never rematched this way.

export const TRAINER_FLAGS_START = 0x500;
/** A trainer's "registered in the PokéNav" flag is this plus their place in the table. */
export const REGISTERED_FLAGS_START = 0x15c;
export const REMATCHES_AT = 0x9ca;

/** [name, the trainer ids of their five teams], in table order. Wally is the Victory Road one; the gym leaders follow. */
export const REMATCH_TRAINERS: readonly (readonly [string, readonly number[]])[] = [
  ['Rose', [37, 40, 41, 42, 43]],
  ['Andres', [737, 812, 813, 814, 815]],
  ['Dusty', [44, 47, 48, 49, 50]],
  ['Lola', [57, 60, 61, 62, 63]],
  ['Ricky', [64, 67, 68, 69, 70]],
  ['Lila & Roy', [687, 688, 689, 690, 691]],
  ['Cristin', [767, 828, 829, 830, 831]],
  ['Brooke', [94, 101, 102, 103, 104]],
  ['Wilton', [78, 84, 85, 86, 87]],
  ['Valerie', [108, 110, 111, 112, 113]],
  ['Cindy', [114, 120, 121, 122, 123]],
  ['Thalia', [144, 844, 845, 846, 847]],
  ['Jessica', [127, 132, 133, 134, 135]],
  ['Winston', [136, 139, 140, 141, 142]],
  ['Steve', [143, 147, 148, 149, 150]],
  ['Tony', [155, 175, 176, 177, 178]],
  ['Nob', [183, 184, 185, 186, 187]],
  ['Koji', [672, 824, 825, 826, 827]],
  ['Fernando', [195, 832, 833, 834, 835]],
  ['Dalton', [196, 197, 198, 199, 200]],
  ['Bernie', [206, 207, 208, 209, 210]],
  ['Ethan', [216, 219, 220, 221, 222]],
  ['John & Jay', [681, 682, 683, 684, 685]],
  ['Jeffrey', [226, 228, 229, 230, 231]],
  ['Cameron', [238, 239, 240, 241, 242]],
  ['Jacki', [249, 250, 251, 252, 253]],
  ['Walter', [254, 257, 258, 259, 260]],
  ['Karen', [280, 282, 283, 284, 285]],
  ['Jerry', [273, 276, 277, 278, 279]],
  ['Anna & Meg', [287, 288, 289, 290, 291]],
  ['Isabel', [302, 303, 304, 305, 306]],
  ['Miguel', [293, 295, 296, 297, 298]],
  ['Timothy', [307, 308, 309, 310, 311]],
  ['Shelby', [313, 314, 315, 316, 317]],
  ['Calvin', [318, 328, 329, 330, 331]],
  ['Elliot', [339, 346, 347, 348, 349]],
  ['Isaiah', [376, 379, 380, 381, 382]],
  ['Maria', [369, 370, 371, 372, 373]],
  ['Abigail', [358, 360, 361, 362, 363]],
  ['Dylan', [364, 365, 366, 367, 368]],
  ['Katelyn', [386, 388, 389, 390, 391]],
  ['Benjamin', [353, 354, 355, 356, 357]],
  ['Pablo', [377, 820, 821, 822, 823]],
  ['Nicolas', [392, 393, 394, 395, 396]],
  ['Robert', [406, 409, 410, 411, 412]],
  ['Lao', [419, 421, 422, 423, 424]],
  ['Cyndy', [427, 430, 431, 432, 433]],
  ['Madeline', [434, 437, 438, 439, 440]],
  ['Jenny', [449, 465, 466, 467, 468]],
  ['Diana', [474, 477, 478, 479, 480]],
  ['Amy & Liv', [481, 482, 487, 488, 489]],
  ['Ernest', [492, 497, 498, 499, 500]],
  ['Cory', [740, 816, 817, 818, 819]],
  ['Edwin', [512, 515, 516, 517, 518]],
  ['Lydia', [545, 548, 549, 550, 551]],
  ['Isaac', [538, 541, 542, 543, 544]],
  ['Gabrielle', [9, 840, 841, 842, 843]],
  ['Catherine', [559, 562, 563, 564, 565]],
  ['Jackson', [552, 555, 556, 557, 558]],
  ['Haley', [604, 607, 608, 609, 610]],
  ['James', [621, 622, 623, 624, 625]],
  ['Trent', [627, 636, 637, 638, 639]],
  ['Sawyer', [1, 836, 837, 838, 839]],
  ['Kira & Dan', [642, 643, 644, 645, 646]],
  ['Wally', [657, 658, 659, 660, 660]],
  ['Roxanne', [265, 770, 771, 772, 773]],
  ['Brawly', [266, 774, 775, 776, 777]],
  ['Wattson', [267, 778, 779, 780, 781]],
  ['Flannery', [268, 782, 783, 784, 785]],
  ['Norman', [269, 786, 787, 788, 789]],
  ['Winona', [270, 790, 791, 792, 793]],
  ['Tate & Liza', [271, 794, 795, 796, 797]],
  ['Juan', [272, 798, 799, 800, 801]],
];

export const WALLY = 64;
export const FIRST_GYM_LEADER = 65;
const WATTSON = 67;
const FLAG_WATTSON_REMATCH_AVAILABLE = 0x5b, FLAG_DEFEATED_WALLY_VICTORY_ROAD = 0x7e, FLAG_SYS_GAME_CLEAR = 0x864;

/** The team a trainer would bring to a rematch now, as the game works it out (0 = none: a gym leader never beaten). */
export function nextRematchTeam(row: number, teams: readonly number[], beaten: (trainerId: number) => boolean): number {
  if (row >= FIRST_GYM_LEADER) { // GetRematchIndex
    let i = 0;
    for (; i < 5; i++) if (!beaten(teams[i])) break;
    return i;
  }
  let i = 1; // SetRematchIdForTrainer
  for (; i < 5; i++) if (!teams[i] || !beaten(teams[i])) break;
  return i;
}

/** Whether the game could ask this trainer for a rematch at all: registered in the PokéNav (Wally also beaten on
 * Victory Road), or for a gym leader the game cleared. */
export function rematchAvailable(row: number, flag: (n: number) => boolean): boolean {
  if (row >= FIRST_GYM_LEADER) return flag(FLAG_SYS_GAME_CLEAR) && (row !== WATTSON || flag(FLAG_WATTSON_REMATCH_AVAILABLE));
  return flag(REGISTERED_FLAGS_START + row) && (row !== WALLY || flag(FLAG_DEFEATED_WALLY_VICTORY_ROAD));
}
