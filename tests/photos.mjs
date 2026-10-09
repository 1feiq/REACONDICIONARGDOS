import assert from 'node:assert/strict';
import sharp from 'sharp';
import { sanitizePhoto } from '../src/lib/photos.ts';

const base = await sharp({
  create: { width: 2400, height: 1200, channels: 3, background: '#123456' },
})
  .jpeg()
  .toBuffer();
// A real EXIF APP1 segment with a GPS IFD and latitude; it must disappear entirely.
const tiff = Buffer.alloc(80);
tiff.write('II');
tiff.writeUInt16LE(42, 2);
tiff.writeUInt32LE(8, 4);
tiff.writeUInt16LE(1, 8);
tiff.writeUInt16LE(0x8825, 10);
tiff.writeUInt16LE(4, 12);
tiff.writeUInt32LE(1, 14);
tiff.writeUInt32LE(26, 18);
tiff.writeUInt16LE(2, 26);
tiff.writeUInt16LE(1, 28);
tiff.writeUInt16LE(2, 30);
tiff.writeUInt32LE(2, 32);
tiff.write('N', 36);
tiff.writeUInt16LE(2, 40);
tiff.writeUInt16LE(5, 42);
tiff.writeUInt32LE(3, 44);
tiff.writeUInt32LE(56, 48);
for (const [i, n] of [51, 30, 0].entries()) {
  tiff.writeUInt32LE(n, 56 + i * 8);
  tiff.writeUInt32LE(1, 60 + i * 8);
}
const payload = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
const marker = Buffer.alloc(4);
marker.writeUInt16BE(0xffe1);
marker.writeUInt16BE(payload.length + 2, 2);
const withGps = Buffer.concat([base.subarray(0, 2), marker, payload, base.subarray(2)]);
assert.ok((await sharp(withGps).metadata()).exif);
const output = await sanitizePhoto(withGps);
const meta = await sharp(output).metadata();
assert.equal(meta.width, 1600);
assert.equal(meta.height, 800);
assert.equal(meta.format, 'webp');
assert.equal(meta.exif, undefined);
assert.equal(meta.xmp, undefined);
assert.equal(meta.icc, undefined);
assert.ok(output.length <= 2 * 1024 * 1024);
const small = await sharp({ create: { width: 20, height: 10, channels: 3, background: 'red' } })
  .png()
  .toBuffer();
assert.equal((await sharp(await sanitizePhoto(small)).metadata()).width, 20);
await assert.rejects(() => sanitizePhoto(new Uint8Array(2 * 1024 * 1024 + 1)));
await assert.rejects(() => sanitizePhoto(Buffer.from('not an image')));
await assert.rejects(() =>
  sanitizePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')),
);
console.log(
  'PASS photo resize, aspect ratio, no upscaling, WebP, EXIF/GPS removal, size and format validation',
);
