/**
 * Generate width/format variants for the menu drink photographs.
 *
 * The menu grid renders an image cell at roughly 293px, so the 1200px sources
 * ship more than twice the pixels any display uses. This emits AVIF and WebP
 * derivatives at the widths below; the component picks one via <picture>.
 *
 * AVIF is listed first on purpose: at equal perceptual quality it is about half
 * the size of WebP, but support is not universal, so the WebP derivative is the
 * fallback and the original 1200px file stays on disk untouched.
 *
 * Usage:
 *   node scripts/build-menu-image-variants.mjs           # dry run, report only
 *   node scripts/build-menu-image-variants.mjs --write   # generate missing/stale
 *   node scripts/build-menu-image-variants.mjs --write --force  # regenerate all
 */
import fs from 'node:fs/promises';
import sharp from 'sharp';

const SOURCE_DIR = 'public/menu/aura-drinks';

/** Widths in CSS pixels. 400 covers 1x cards, 800 retina, 1200 the ceiling. */
const WIDTHS = [400, 800, 1200];

const JPEG_LIKE = { effort: 6 };
const WEBP_QUALITY = 80;
/** AVIF tolerates a lower number than WebP for the same visual result. */
const AVIF_QUALITY = 50;

const write = process.argv.includes('--write');
const force = process.argv.includes('--force');

function atWidth(fileName, width, extension) {
  return fileName.replace(/\.(webp|avif)$/, `-${width}.${extension}`);
}

/**
 * Only the original masters. The generated variants also end in .webp, so
 * matching on the extension alone would treat them as sources and stack width
 * suffixes on top of each other.
 */
const files = (await fs.readdir(SOURCE_DIR)).filter(
  (file) => /^[a-z0-9-]+\.webp$/.test(file) && !/-\d+\.webp$/.test(file),
);

let sourceBytes = 0;
let variantBytes = 0;
let generated = 0;
let skipped = 0;

for (const file of files) {
  const source = `${SOURCE_DIR}/${file}`;
  const sourceStat = await fs.stat(source);
  const sourceSize = sourceStat.size;
  sourceBytes += sourceSize;

  const metadata = await sharp(source).metadata();

  for (const width of WIDTHS) {
    for (const format of ['avif', 'webp']) {
      const target = `${SOURCE_DIR}/${atWidth(file, width, format)}`;
      const options = format === 'avif'
        ? { quality: AVIF_QUALITY, ...JPEG_LIKE }
        : { quality: WEBP_QUALITY, ...JPEG_LIKE };

      let pipeline = sharp(source);
      // Never blow up the smaller packshots (Pepsi is 191x635) just to fill
      // a width the grid will never use.
      if (Math.max(metadata.width, metadata.height) > width) {
        pipeline = pipeline.resize({
          width: metadata.width >= metadata.height ? width : undefined,
          height: metadata.height > metadata.width ? width : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      const encoded = await pipeline[format](options).toBuffer();
      variantBytes += encoded.length;

      const existing = await fs.stat(target).catch(() => null);
      const isCurrent = existing && existing.mtimeMs >= sourceStat.mtimeMs;
      if (isCurrent && !force) {
        skipped += 1;
        continue;
      }

      if (write) {
        await fs.writeFile(target, encoded);
        generated += 1;
        continue;
      }

      generated += 1;
    }
  }
}

const label = write ? 'wrote' : 'would write';
console.log(`${label}: ${generated} variants (${skipped} up to date)`);
console.log(`sources: ${files.length} files, ${(sourceBytes / 1048576).toFixed(2)} MiB`);
console.log(`variants: ${(variantBytes / 1048576).toFixed(2)} MiB total`);
