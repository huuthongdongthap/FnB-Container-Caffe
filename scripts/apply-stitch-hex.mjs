#!/usr/bin/env node
/**
 * apply-stitch-hex — consume /tmp/hex-nonvar.tsv (file\tline\thigh\token) from
 * migrate-stitch-hex.mjs and rewrite raw hex → var(--token, #hex) fallbacks.
 *
 * Rules:
 *   - Only touches lines NOT already containing var(<token>, #hex) for that hex.
 *   - Preserves existing var(--aura-*, #hex) fallbacks untouched.
 *   - rgba() with alpha < 1: rewrite to rgba(var(--token-rgb), <alpha>) when
 *     token has an -rgb variant, else skip (keep raw alpha overlay).
 *   - Reports every change as JSON lines to stdout for audit.
 *
 * Usage:
 *   node scripts/apply-stitch-hex.mjs [--tsv /tmp/hex-nonvar.tsv] [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = process.cwd();
const args = process.argv.slice(2);
const tsvIdx = args.indexOf('--tsv');
const tsvPath = tsvIdx >= 0 ? args[tsvIdx + 1] : '/tmp/hex-nonvar.tsv';
const dryRun = args.includes('--dry-run');

// token -> rgb core (for rgba rewrite)
const TOKEN_RGB = new Map();
{
  const brand = readFileSync(join(ROOT, 'src/styles/brand-tokens.css'), 'utf-8');
  for (const line of brand.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+-rgb)\s*:\s*(\d+),\s*(\d+),\s*(\d+)\s*;/);
    if (m) TOKEN_RGB.set(m[1], [+m[2], +m[3], +m[4]]);
  }
}
// also derive from --aura-foo: #hex by computing rgb
const HEX_TOKEN = new Map();
for (const line of readFileSync(join(ROOT, 'src/styles/brand-tokens.css'), 'utf-8').split('\n')) {
  const m = line.match(/^\s*(--[\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/);
  if (m) HEX_TOKEN.set(m[1], m[2]);
}

const rows = readFileSync(tsvPath, 'utf-8')
  .split('\n').filter(Boolean)
  .map(l => l.split('\t'));

// group by file
const byFile = new Map();
for (const [file, lineS, raw, token] of rows) {
  const line = +lineS;
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push({ line, raw, token });
}

let totalReplaced = 0, totalSkipped = 0, filesTouched = 0;
const log = [];
for (const [file, entries] of byFile) {
  const abs = join(ROOT, file);
  const src = readFileSync(abs, 'utf-8');
  const lines = src.split('\n');
  let fileReplaced = 0;
  // dedupe per line+raw
  const seen = new Set();
  for (const { line, raw, token } of entries) {
    const key = `${line}:${raw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const idx = line - 1;
    const code = lines[idx];
    if (!code.includes(raw)) { totalSkipped++; continue; }
    // skip if already wrapped in var(<something>, <same raw>)
    if (new RegExp(`var\\(--[\\w-]+,\\s*${escapeRe(raw)}\\)`).test(code)) {
      totalSkipped++; continue;
    }
    // rgba path
    const rgbaMatch = raw.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/);
    if (rgbaMatch) {
      const rgbToken = token + '-rgb';
      if (TOKEN_RGB.has(rgbToken)) {
        const [r,g,b] = TOKEN_RGB.get(rgbToken);
        const a = rgbaMatch[4];
        const next = code.replace(raw, `rgba(var(${rgbToken}, ${r},${g},${b}), ${a})`);
        lines[idx] = next;
        fileReplaced++;
        log.push(JSON.stringify({ file, line, raw, to: `rgba(var(${rgbToken}), ${a})` }));
      } else {
        totalSkipped++;
        log.push(JSON.stringify({ file, line, raw, action: 'skip-no-rgb-token' }));
      }
      continue;
    }
    // hex path: insert var(token, #hex) preserving fallback
    const next = code.replace(raw, `var(${token}, ${raw})`);
    lines[idx] = next;
    fileReplaced++;
    log.push(JSON.stringify({ file, line, raw, to: `var(${token}, ${raw})` }));
  }
  if (fileReplaced > 0) {
    if (!dryRun) writeFileSync(abs, lines.join('\n'));
    filesTouched++;
    totalReplaced += fileReplaced;
    console.error(`✓ ${file}: ${fileReplaced} replaced`);
  }
}
console.log(JSON.stringify({ dryRun, filesTouched, totalReplaced, totalSkipped, logPath: '/tmp/hex-apply-log.jsonl' }));
writeFileSync('/tmp/hex-apply-log.jsonl', log.join('\n'));
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
