// Writes the made-up saves the browser checks open (nothing here comes from a real game):
//   node e2e/make-fixtures.ts [folder]
//   sample.sav     the site's "Try a sample save" file: a Yellow save
//   rb.sav         the same trainer as a Red/Blue save (Yellow tells itself apart by Pikachu's friendship block)
//   rb-footer.sav  rb.sav with the 44-byte footer some emulators add (32,812 bytes)
//   gold.sav       the Crystal sample's trainer as a Gold save (the landing page only offers the Crystal one)
//   ruby.sav       a Ruby / Sapphire save, and emerald.sav the same trainer in Emerald (no Gen 3 sample on the landing page)
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSampleSave } from '../src/core/gen1/sample.ts';
import { GEN1_OFFSETS as O, checksum8 } from '../src/core/gen1/save.ts';
import { buildSampleSave as buildGen2Sample } from '../src/core/gen2/sample.ts';
import { buildSampleSave as buildGen3Sample } from '../src/core/gen3/sample.ts';

const out = process.argv[2] ?? 'e2e/out';
mkdirSync(out, { recursive: true });

const sample = buildSampleSave();
writeFileSync(`${out}/sample.sav`, sample);

const rb = sample.slice();
rb[O.pikachuFriendship] = 0; rb[O.pikachuMood] = 0;
rb[O.checksum] = checksum8(rb, O.checksumStart, O.checksumEnd);
writeFileSync(`${out}/rb.sav`, rb);

const footer = Uint8Array.from({ length: 44 }, (_, i) => 0xa5 ^ i);
writeFileSync(`${out}/rb-footer.sav`, Buffer.concat([rb, footer]));
writeFileSync(`${out}/gold.sav`, buildGen2Sample('gs'));
writeFileSync(`${out}/ruby.sav`, buildGen3Sample('rs'));
writeFileSync(`${out}/emerald.sav`, buildGen3Sample('emerald'));
console.log(`wrote sample.sav, rb.sav, rb-footer.sav, gold.sav, ruby.sav and emerald.sav to ${out}`);
