import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the menu payload budget against regression.
 *
 * Thresholds come from the 293px image cell in StitchMenuNew.tsx
 * (xl:grid-cols-4 inside max-w-7xl px-6): 400px covers 1x, 800px retina,
 * 1200px is a ceiling. The numbers below sit above the largest file actually
 * measured so the test catches regressions, not normal encoder variance.
 */
const IMAGE_DIR = join(process.cwd(), 'public/menu/aura-drinks');

/** Max bytes per generated variant, by width. Both formats share a ceiling. */
const MAX_BYTES: Record<number, number> = {
  400: 40 * 1024,
  800: 90 * 1024,
  1200: 160 * 1024,
};

/** Ceiling for a full menu first paint, all 49 items at their 1x variant. */
const MAX_FIRST_PAINT = 768 * 1024;

function isMaster(fileName: string): boolean {
  return /^[a-z0-9-]+\.webp$/.test(fileName) && !/-\d+\.webp$/.test(fileName);
}

const masters = readdirSync(IMAGE_DIR).filter(isMaster);

describe('menu image payload budget', () => {
/**
 * Source assets shipped smaller than the smallest generated variant. A variant
 * narrower than its own master is only an upscale: it fits the byte budget
 * above while giving the browser no extra detail, so those cards render soft
 * however well the file compresses. They need a larger original, not a
 * re-encode — tracked in docs/05_TASKS/menu.md.
 */
const KNOWN_UNDERSIZED: ReadonlySet<string> = new Set(['pepsi.webp', 'red-bull.webp']);

/** Canvas width read straight out of the RIFF header, no image decoder needed. */
function webpWidth(path: string): number | null {
  const header = readFileSync(path);
  const chunk = header.toString('latin1', 12, 16);
  const byte = (offset: number) => header[offset] ?? 0;
  if (chunk === 'VP8X') return (byte(24) | (byte(25) << 8) | (byte(26) << 16)) + 1;
  if (chunk === 'VP8 ') return (byte(26) | (byte(27) << 8)) & 0x3fff;
  if (chunk === 'VP8L') return (((byte(21) | (byte(22) << 8) | (byte(23) << 16)) + (byte(24) << 24)) & 0x3fff) + 1;
  return null;
}

it('keeps every master at least as wide as its smallest variant', () => {
  const smallest = Math.min(...Object.keys(MAX_BYTES).map(Number));
  const offenders = masters.filter((master) => {
    const width = webpWidth(join(IMAGE_DIR, master));
    return width !== null && width < smallest && !KNOWN_UNDERSIZED.has(master);
  });
  expect(offenders).toEqual([]);
});

it('still lists exactly the masters it already knew were too small', () => {
  // Deleting an entry from KNOWN_UNDERSIZED after re-shooting that asset is the
  // fix; the asset disappearing behind the list's back is the regression.
  const listed = masters.filter((master) => KNOWN_UNDERSIZED.has(master)).sort();
  expect(listed).toEqual([...KNOWN_UNDERSIZED].sort());
});

  it('generated a variant for every master at every width', () => {
    const present = new Set(readdirSync(IMAGE_DIR));
    const missing: string[] = [];
    for (const master of masters) {
      for (const width of Object.keys(MAX_BYTES)) {
        for (const extension of ['avif', 'webp']) {
          const name = master.replace('.webp', `-${width}.${extension}`);
          if (!present.has(name)) missing.push(name);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps every variant within its width budget', () => {
    const all = readdirSync(IMAGE_DIR);
    const oversized: Array<{ file: string; kb: number; limit: number }> = [];

    // Walk what is actually on disk rather than what the masters imply, so a
    // variant added by hand is still measured.
    for (const file of all) {
      const match = /^(?<name>.+)-(?<width>\d+)\.(?<extension>avif|webp)$/.exec(file);
      if (!match?.groups) continue;

      const limit = MAX_BYTES[Number(match.groups.width)];
      if (!limit) continue;

      const bytes = statSync(join(IMAGE_DIR, file)).size;
      if (bytes > limit) oversized.push({ file, kb: Math.round(bytes / 1024), limit: limit / 1024 });
    }
    expect(oversized).toEqual([]);
  });

  it('keeps a full first paint under budget', () => {
    const bytes = masters.reduce((total, master) => {
      const oneX = master.replace('.webp', '-400.avif');
      return total + statSync(join(IMAGE_DIR, oneX)).size;
    }, 0);
    expect(bytes).toBeLessThan(MAX_FIRST_PAINT);
  });

  it('never leaves a stacked-suffix variant behind', () => {
    // The generator matches on a bare .webp filename; if that regresses a
    // second width gets appended and the file becomes unreachable.
    const stacked = readdirSync(IMAGE_DIR).filter((file) => /-\d+-\d+\.\w+$/.test(file));
    expect(stacked).toEqual([]);
  });
});
