import sharp from 'sharp';

export async function sanitizePhoto(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 2 * 1024 * 1024)
    throw new Error('Cada foto debe pesar como máximo 2 MB.');
  const image = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
    throw new Error('Usá una imagen JPG, PNG o WebP sin animación.');
  // Re-encoding strips EXIF/GPS; never use keepMetadata or withMetadata here.
  const output = await image
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  if (output.length > 2 * 1024 * 1024) throw new Error('La foto optimizada supera los 2 MB.');
  return output;
}
