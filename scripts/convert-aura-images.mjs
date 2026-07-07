/**
 * convert-aura-images.mjs — Batch PNG/JPEG → WebP converter
 *
 * Targets: public/images/ and public/stitch-designs/
 * Quality: 80 (WebP)
 * Skips: files already converted (WebP newer than source)
 * Prints: per-file savings + total summary
 */

import sharp from 'sharp';
import { readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, extname, parse, relative } from 'path';

const ROOT = process.cwd();
const TARGET_DIRS = ['public/images', 'public/stitch-designs'];
const QUALITY = 80;
const EXTS = new Set(['.png', '.jpg', '.jpeg']);

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (EXTS.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

async function main() {
  console.log('=== AURA Image Optimization — PNG/JPEG → WebP ===\n');

  // Sharp install check (Cloudflare Workers build: uses @img/sharp-win32-ia32 etc)
  try { await sharp(Buffer.alloc(1)).metadata(); } catch { /* skip metadata, will fail on real convert */ }

  let totalOrig = 0, totalNew = 0, converted = 0, skipped = 0;

  for (const rel of TARGET_DIRS) {
    const dir = join(ROOT, rel);
    if (!existsSync(dir)) { console.log(`Skip: ${rel} not found`); continue; }

    const files = collect(dir);
    console.log(`\n${rel}/ — ${files.length} image(s)`);

    for (const file of files) {
      const relFile = relative(ROOT, file);        // e.g. "public/images/foo.png"
      const parsed = parse(relFile);               // dir is now relative: "public/images"
      const { name, dir: relSubdir } = parsed;
      const webpPath = join(ROOT, relSubdir, `${name}.webp`);

      // Skip if WebP exists and is newer
      if (existsSync(webpPath)) {
        const srcTime = statSync(file).mtimeMs;
        const webpTime = statSync(webpPath).mtimeMs;
        if (webpTime >= srcTime) {
          skipped++;
          continue;
        }
      }

      try {
        const meta = await sharp(file).metadata();
        await sharp(file).webp({ quality: QUALITY }).toFile(webpPath);

        const origSize = statSync(file).size;
        const newSize = statSync(webpPath).size;
        const saved = ((origSize - newSize) / origSize * 100).toFixed(1);
        const relFile = relative(ROOT, file);

        console.log(`  ✓ ${relFile}  ${(origSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB  (-${saved}%)`);
        totalOrig += origSize;
        totalNew += newSize;
        converted++;
      } catch (err) {
        console.error(`  ✗ ${relative(ROOT, file)}: ${err.message}`);
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Converted: ${converted}  |  Skipped (up-to-date): ${skipped}`);
  if (converted > 0) {
    const totalSaved = totalOrig - totalNew;
    console.log(`Total: ${(totalOrig/1024/1024).toFixed(2)} MB → ${(totalNew/1024/1024).toFixed(2)} MB  (-${(totalSaved/1024/1024).toFixed(2)} MB, ${(totalSaved/totalOrig*100).toFixed(1)}%)`);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
