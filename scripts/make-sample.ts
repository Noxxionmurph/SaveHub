// Generates a small synthetic Gen 1 save for trying the editor: node scripts/make-sample.ts [out.sav]
import { writeFileSync } from 'node:fs';
import { DEX_TO_INTERNAL, expForLevel } from '../src/core/gen1/data.ts';
import { Gen1Save, SAVE_SIZE, checksum8, newMon, recalcPartyStats } from '../src/core/gen1/save.ts';
import { encodeText } from '../src/core/gen1/text.ts';

const d = new Uint8Array(SAVE_SIZE);
d.set(encodeText('ASH', 11), 0x2598);
d.set(encodeText('GARY', 11), 0x25f6);
d[0x25ca] = 0xff; d[0x27e7] = 0xff; d[0x2f2d] = 0xff; d[0x30c1] = 0xff;
for (const bank of [0x4000, 0x6000]) for (let i = 0; i < 6; i++) d[bank + i * 0x462 + 1] = 0xff;
d[0x3523] = checksum8(d, 0x2598, 0x3523);

const save = new Gen1Save(d);
save.trainerId = 12345;
save.money = 3000;
save.bag = [{ id: 4, count: 10 }, { id: 20, count: 5 }];
const pikachu = newMon(DEX_TO_INTERNAL[25], 20);
pikachu.moves = [84, 98, 86, 0];
pikachu.pp = [30, 30, 20, 0];
pikachu.exp = expForLevel('Medium Fast', 20);
pikachu.otName = 'ASH'; pikachu.otId = 12345;
recalcPartyStats(pikachu, true);
save.party = [pikachu];

writeFileSync(process.argv[2] ?? 'sample.sav', save.serialize());
console.log('wrote', process.argv[2] ?? 'sample.sav');
