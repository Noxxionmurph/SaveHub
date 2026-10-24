import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { crc32, makeZip } from '../src/ui/zip.ts';

test('crc32 matches Node zlib', () => {
  const data = new Uint8Array(5000).map((_, i) => (i * 31 + 7) & 0xff);
  assert.equal(crc32(data), nodeCrc32(data));
  assert.equal(crc32(new Uint8Array()), 0);
});

test('zip has the expected structure and embeds the file bytes', () => {
  const data = new Uint8Array(32768).map((_, i) => (i * 7) & 0xff);
  const zip = makeZip('pokemon-edited.sav', data);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint32(14, true), nodeCrc32(data));
  assert.equal(v.getUint32(22, true), data.length);
  const nameLen = v.getUint16(26, true);
  assert.equal(new TextDecoder().decode(zip.slice(30, 30 + nameLen)), 'pokemon-edited.sav');
  assert.deepEqual(zip.slice(30 + nameLen, 30 + nameLen + data.length), data);
  // End-of-central-directory record is the last 22 bytes and points at the central directory.
  const eocd = zip.length - 22;
  assert.equal(v.getUint32(eocd, true), 0x06054b50);
  const cdOffset = v.getUint32(eocd + 16, true);
  assert.equal(v.getUint32(cdOffset, true), 0x02014b50);
});
