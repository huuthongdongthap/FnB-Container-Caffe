#!/usr/bin/env node

/**
 * convert-to-webp.mjs
 *
 * Batch PNG (and JPEG) -> WebP converter using sharp.
 *
 * - Walks images/ recursively
 * - Preserves originals by moving them to images/originals/<rel-path>/
 * - WebP quality=80
 * - Skips files already converted (WebP exists && newer than source)
 * - Prints summary of conversions + size savings
 */

import sharp from 'sharp';
import { readdirSync, statSync, existsSync, mkdirSync, renameSync, copyFileSync } from 'fs';
import { join, extname, parse, relative } from 'path';

const ROOT = process.cwd();
const IMAGES_DIR = join(ROOT, 'images');
const ORIGINALS_DIR = join(IMAGES_DIR, 'originals');
const QUALITY = 80;
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg']);

function collectImages(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'originals') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectImages(fullPath));
    } else if (IMAGE_EXTS.has(extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function convertToWebp(inputPath) {
  const relPath = relative(IMAGES_DIR, inputPath);        // e.g. "hero.png" or "stitch-preview/home-design.png"
  const { dir, name } = parse(relPath);
  const outputName = `${name}.webp`;
  const outputRelPath = dir ? `${dir}/${outputName}` : outputName;

  const outputPath = join(IMAGES_DIR, outputRelPath);
  const originalDir = join(ORIGINALS_DIR, dir);
  const originalPath = join(originalDir, `${name}${extname(inputPath)}`);

  // Skip if WebP already exists and is newer than source
  if (existsSync(outputPath)) {
    const srcMtime = statSync(inputPath).mtimeMs;
    const webpMtime = statSync(outputPath).mtimeMs;
    if (webpMtime >= srcMtime) {
      return null; // already up to date
    }
  }

  // Ensure originals directory exists
  ensureDir(originalDir);

  // Copy original to originals/ (keep original for PNG fallback)
  copyFileSync(inputPath, originalPath);

  // Convert moved original to WebP at original location
  await sharp(originalPath)
    .webp({ quality: QUALITY })
    .toFile(outputPath);

  const origSize = statSync(originalPath).size;
  const newSize = statSync(outputPath).size;
  const saved = origSize - newSize;
  const savedPct = ((saved / origSize) * 100).toFixed(1);

  return { file: outputRelPath, originalSize: origSize, newSize, saved, savedPct };
}

async function main() {
  console.log('=== PNG/JPEG -> WebP Converter (sharp, quality=80) ===\n');

  if (!existsSync(IMAGES_DIR)) {
    console.error('Error: images/ directory not found');
    process.exit(1);
  }

  const files = collectImages(IMAGES_DIR);
  console.log(`Found ${files.length} image(s) to check.\n`);

  const results = [];
  for (const file of files) {
    const result = await convertToWebp(file);
    if (result) {
      results.push(result);
      const rel = relative(IMAGES_DIR, file);
      const savedKB = (result.saved / 1024).toFixed(0);
      console.log(
        `  Converted: ${rel}  (${(result.originalSize / 1024).toFixed(0)}KB → ${(result.newSize / 1024).toFixed(0)}KB, -${savedKB}KB, ${result.savedPct}%)`
      );
    }
  }

  console.log('\n=== Summary ===');
  if (results.length === 0) {
    console.log('All images are already converted. Nothing to do.');
  } else {
    const totalOrig = results.reduce((s, r) => s + r.originalSize, 0);
    const totalNew = results.reduce((s, r) => s + r.newSize, 0);
    const totalSaved = totalOrig - totalNew;
    const totalPct = ((totalSaved / totalOrig) * 100).toFixed(1);
    console.log(`  Images converted: ${results.length}`);
    console.log(`  Total original:   ${(totalOrig / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Total WebP:       ${(totalNew / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Total saved:      ${(totalSaved / 1024 / 1024).toFixed(2)} MB (${totalPct}%)`);

    // Check against target: 47MB -> < 10MB
    if (totalOrig >= 45 * 1024 * 1024) {
      console.log(`\n  Target: 47MB -> < 10MB (${(totalNew / 1024 / 1024).toFixed(2)} MB)`);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
