// Writes the made-up saves the browser checks open (nothing here comes from a real game):
//   node e2e/make-fixtures.ts [folder]
//   sample.sav     the site's "Try a sample save" file: a Yellow save
//   rb.sav         the same trainer as a Red/Blue save (Yellow tells itself apart by Pikachu's friendship block)
//   rb-footer.sav  rb.sav with the 44-byte footer some emulators add (32,812 bytes)
//   gold.sav       the Crystal sample's trainer as a Gold save (the landing page only offers the Crystal one)
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSampleSave } from '../src/core/gen1/sample.ts';
import { checksum8 } from '../src/core/gen1/save.ts';
import { buildSampleSave as buildGen2Sample } from '../src/core/gen2/sample.ts';

const out = process.argv[2] ?? 'e2e/out';
mkdirSync(out, { recursive: true });

const sample = buildSampleSave();
writeFileSync(`${out}/sample.sav`, sample);

const rb = sample.slice();
rb[0x271c] = 0; rb[0x271d] = 0;
rb[0x3523] = checksum8(rb, 0x2598, 0x3523);
writeFileSync(`${out}/rb.sav`, rb);

const footer = Uint8Array.from({ length: 44 }, (_, i) => 0xa5 ^ i);
writeFileSync(`${out}/rb-footer.sav`, Buffer.concat([rb, footer]));
writeFileSync(`${out}/gold.sav`, buildGen2Sample('gs'));
console.log(`wrote sample.sav, rb.sav, rb-footer.sav and gold.sav to ${out}`);
