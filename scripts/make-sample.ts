// Writes the same made-up Gen 1 save the site's "Try a sample save" button uses:
//   node scripts/make-sample.ts [out.sav]
import { writeFileSync } from 'node:fs';
import { buildSampleSave } from '../src/core/gen1/sample.ts';

const out = process.argv[2] ?? 'sample.sav';
writeFileSync(out, buildSampleSave());
console.log('wrote', out);
