import sharp from 'sharp';
import { readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, extname, parse } from 'path';

const IMAGE_DIRS = ['images', 'assets/images', 'public/images'];
const SIZES = [320, 640, 960, 1280]; // Responsive widths

async function optimizeImages() {
  for (const dir of IMAGE_DIRS) {
    const fullPath = join(process.cwd(), dir);
    if (!existsSync(fullPath)) continue;

    const files = readdirSync(fullPath).filter(f => /\.(png|jpg|jpeg)$/i.test(f));

    for (const file of files) {
      const inputPath = join(fullPath, file);
      const { name } = parse(file);
      const webpPath = join(fullPath, `${name}.webp`);

      // Skip if webp already exists and is newer
      if (existsSync(webpPath) && statSync(webpPath).mtime > statSync(inputPath).mtime) {
        console.log(`Skipping ${file} — webp already up to date`);
        continue;
      }

      console.log(`Converting ${file}...`);
      const input = sharp(inputPath);
      const metadata = await input.metadata();

      // Main WebP (80% quality)
      await input
        .webp({ quality: 80 })
        .toFile(webpPath);

      const origSize = statSync(inputPath).size;
      const newSize = statSync(webpPath).size;
      const saved = ((origSize - newSize) / origSize * 100).toFixed(0);
      console.log(`  ${file}: ${(origSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB (${saved}% saved)`);
    }
  }

  console.log('Done!');
}

optimizeImages().catch(console.error);
