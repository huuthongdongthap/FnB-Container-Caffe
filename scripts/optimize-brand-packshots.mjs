/**
 * Re-encode the brand packshots under 1200px on the long edge.
 *
 * The source masters were written as lossless VP8L, so a 1204KB Dasani bottle
 * carried 1.2MB of bytes for a card that renders at roughly 600px wide. This
 * keeps every displayed pixel and drops the payload.
 *
 * Usage: node scripts/optimize-brand-packshots.mjs [--write]
 * Without --write this only reports what it would do.
 */
import fs from 'node:fs/promises';
import sharp from 'sharp';

const PACKSHOT_DIR = 'public/menu/aura-drinks';

/**
 * Only the four brand packshots are touched. They are the sole lossless (VP8L)
 * masters in the directory, so re-encoding them is their first lossy generation.
 * The 49 drink illustrations are already lossy VP8 and would take a second
 * generation loss for a small size win, so they are left alone.
 *
 * Matched by resolution signature rather than by hardcoded filename so a future
 * packshot is picked up automatically.
 */
const MAX_EDGE = 1200;
const QUALITY = 82;

const write = process.argv.includes('--write');

const candidates = [];
for (const file of (await fs.readdir(PACKSHOT_DIR)).filter((f) => f.endsWith('.webp'))) {
  const source = `${PACKSHOT_DIR}/${file}`;
  const header = (await fs.readFile(source)).toString('ascii', 12, 16);
  if (header !== 'VP8L') continue;
  candidates.push({ file, source });
}

if (candidates.length === 0) {
  console.log('No lossless packshots to optimize.');
  process.exit(0);
}

let before = 0;
let after = 0;

for (const { file, source } of candidates) {
  const metadata = await sharp(source).metadata();

  let pipeline = sharp(source);
  if (Math.max(metadata.width, metadata.height) > MAX_EDGE) {
    pipeline = pipeline.resize({
      width: metadata.width >= metadata.height ? MAX_EDGE : undefined,
      height: metadata.height > metadata.width ? MAX_EDGE : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const encoded = await pipeline.webp({ quality: QUALITY }).toBuffer();
  const decoded = await sharp(encoded).metadata();

  const originalBytes = (await fs.stat(source)).size;
  before += originalBytes;
  after += encoded.length;

  console.log(
    `${file.padEnd(22)}`,
    `${metadata.width}x${metadata.height}`.padEnd(12),
    `${Math.round(originalBytes / 1024)}KB`.padEnd(9),
    '->',
    `${decoded.width}x${decoded.height}`.padEnd(12),
    `${Math.round(encoded.length / 1024)}KB`,
  );

  if (write && encoded.length < originalBytes) {
    await fs.writeFile(source, encoded);
  }
}

console.log(
  'TOTAL'.padEnd(22),
  ''.padEnd(12),
  `${Math.round(before / 1024)}KB`.padEnd(9),
  '->',
  ''.padEnd(12),
  `${Math.round(after / 1024)}KB (-${Math.round((1 - after / before) * 100)}%)`,
);
