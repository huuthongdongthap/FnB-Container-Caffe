#!/usr/bin/env node
/**
 * migrate-stitch-hex — scan Stitch components for raw hex/rgba colors,
 * match against brand-tokens.css, report suggested replacements.
 *
 * Report-only by design: no file edits. Apply via Edit tool per file.
 *
 * Usage:
 *   node scripts/migrate-stitch-hex.mjs [--dir src/components/stitch]
 *   node scripts/migrate-stitch-hex.mjs --file src/components/stitch/StitchEventsNew.tsx
 *   node scripts/migrate-stitch-hex.mjs --json   # machine-readable
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DEFAULT_DIR = 'src/components/stitch';

// --- args ---
const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const fileIdx = args.indexOf('--file');
const dirIdx = args.indexOf('--dir');
const singleFile = fileIdx >= 0 ? args[fileIdx + 1] : null;
const scanDir = dirIdx >= 0 ? args[dirIdx + 1] : DEFAULT_DIR;

// --- parse brand-tokens.css: hex value -> token names ---
const TOKEN_FILE = join(ROOT, 'src/styles/brand-tokens.css');
const tokenSource = readFileSync(TOKEN_FILE, 'utf-8');

// hex -> [tokenNames]  (a hex may be shared by multiple tokens)
const hexToTokens = new Map();
// tokenName -> hex (first definition wins; @media/dark overrides skipped)
const tokenToHex = new Map();
// line-by-line so we can stop at @media boundaries (dark-mode overrides
// alias the same token to different hexes — we only want the light/default)
let inDarkBlock = false;
for (const line of tokenSource.split('\n')) {
  if (line.includes('@media')) {
    inDarkBlock = !line.includes('}'); // handle one-liners
  }
  if (line.trim().startsWith('}')) { inDarkBlock = false; }
  if (inDarkBlock) continue;
  const m = line.match(/^\s*(--[\w-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;/);
  if (!m) continue;
  const [, token, hex] = m;
  const norm = normalizeHex(hex);
  if (!tokenToHex.has(token)) tokenToHex.set(token, norm);
  if (!hexToTokens.has(norm)) hexToTokens.set(norm, []);
  if (!hexToTokens.get(norm).includes(token)) hexToTokens.get(norm).push(token);
}

function normalizeHex(hex) {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return h.toUpperCase();
}

// --- color math for fuzzy matching ---
function hexToRgb(h) {
  const n = normalizeHex(h);
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}
function rgbToHex(r, g, b) {
  return [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
// WCAG relative luminance
function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function lightness([r, g, b]) {
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
}
function deltaE93(aHex, bHex) {
  // Simplified CIE94: weighted RGB distance approximating perceptual delta
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(0.26 * dr * dr + 0.7 * dg * dg + 0.04 * db * db);
}

const FUZZY_MAX_DE = 20; // deltaE93 threshold — conservative
const FUZZY_MAX_LIGHTNESS = 0.03; // 3% lightness delta gate (plan rule 5.4)

// Canonical overrides for Stitch legacy colors with no exact token match.
// Key: normalized uppercase hex. Value: target token (without var() wrapper).
// Rationale: v6 gold/bronze palette was remapped to chrome in v7;
// these hexes are the v6 originals still referenced by Stitch exports.
const CANONICAL = {
  // bronze/gold family → chrome (v7 brand direction)
  D4A574: '--aura-chrome-light',
  F2C08D: '--aura-chrome-light',
  EFBD8A: '--aura-chrome-light',
  CD7F32: '--aura-chrome-mid',
  '8A7A6A': '--aura-text-muted',
  EAE1DB: '--aura-chrome-bright',
  C49271: '--aura-chrome-mid',
  FFB779: '--aura-chrome-bright',
  A0522D: '--aura-chrome-mid',
  E5C099: '--aura-chrome-light',
  DFAF7E: '--aura-chrome-light',
  FFDDBA: '--aura-chrome-bright',
  '472A03': '--aura-noir-void',
  FF6B6B: '--aura-danger',
  '7C838A': '--aura-text-muted',
  C0C0C0: '--aura-chrome-light',
  FFD700: '--aura-chrome-mid',
  '955200': '--aura-chrome-mid',
  '64421A': '--aura-chrome-mid',
  '6B5D50': '--aura-text-muted',
  '5A4A3A': '--aura-text-muted',
  '4A4A4A': '--aura-text-muted',
  '454748': '--aura-text-muted',
  '343536': '--aura-noir-steel',
  '292A2C': '--aura-noir-mid',
  '131313': '--aura-noir-void',
  '012': '--aura-noir-void',
  '475569': '--aura-text-muted',
  A8B2BD: '--aura-chrome-light',
  FFFDD8DC: '--aura-chrome-light',
  E2E8F0: '--aura-chrome-bright',
  E5E7EB: '--aura-chrome-bright',
  '90A4AE': '--aura-text-secondary',
  '546E7A': '--aura-text-muted',
  C5C6CD: '--aura-text-body',
  FFFD8DC: '--aura-chrome-light',
  '273A55': '--st-surface-container-highest',
  '39475E': '--aura-noir-steel',
  CFD8DC: '--aura-chrome-light',
  B5C8E7: '--aura-chrome-bright',
  C4C6CE: '--aura-text-body',
  C7C6C4: '--aura-text-body',
  E5E4E2: '--aura-chrome-bright',
  E5E2E1: '--aura-chrome-bright',
  E4E2E4: '--aura-chrome-bright',
  E3E2E3: '--aura-chrome-bright',
  BCC6CC: '--aura-text-body',
  C1C7CF: '--aura-text-body',
  // navy-trap: --text-white (#0F172A) is actually navy — these dark navy hexes
  // wrongly fuzzy-match it. Override to correct noir tokens.
  '1A1A2E': '--aura-noir-deep',
  '091421': '--aura-noir-void',
  '0A1628': '--aura-noir-void',
  '2C1700': '--aura-noir-void',
  '2B1701': '--aura-noir-void',
  // high-count fuzzy overrides that were resolving to wrong tokens
  C6C6C7: '--aura-text-body',         // 72× fuzzy to --text-body #C5C8CC
  E8E8E8: '--aura-chrome-bright',     // 53× fuzzy to --chrome-bright #E8EEF3
  '1E3550': '--st-on-primary',        // 43× fuzzy to #223146
  '273647': '--st-surface-container-highest', // 16× fuzzy to #2A3548
  '8E9097': '--aura-text-muted',      // 13× fuzzy to #8A8E96
  '23364E': '--st-surface-container-highest', // 12×
  D4E4FA: '--aura-chrome-bright',     // 11×
  '1A1008': '--aura-noir-void',       // 8× fuzzy to #050D1A
  D9E3F6: '--aura-chrome-bright',     // 6×
  '0B2038': '--aura-noir-deep',       // 6×
  '071C33': '--aura-noir-deep',       // 5×
  '0C1C30': '--aura-noir-deep',       // 5×
  '162A44': '--aura-bg-elevated',     // 5×
  '0D1B2A': '--aura-noir-deep',       // 5×
  '00142B': '--aura-noir-void',       // 4×
  '1E314A': '--st-on-primary',        // 4×
  '94A3B8': '--aura-text-secondary',  // 2×
  '050D17': '--aura-noir-void',       // 2×
  '131315': '--aura-noir-void',       // 2×
  '0B203A': '--aura-noir-deep',       // 2×
  '152031': '--aura-noir-deep',       // 2×
  D8E3FB: '--aura-chrome-bright',     // 2×
  '291500': '--aura-noir-void',       // 2×
  '051424': '--aura-noir-void',       // 2×
  '061C35': '--aura-noir-deep',       // 2×
  '000F22': '--aura-noir-void',       // 2×
  D3E4FF: '--aura-chrome-bright',     // 3×
  ADC8F5: '--aura-chrome-bright',     // 3×
  D4D4D8: '--aura-chrome-light',      // 3×
  A1A1AA: '--aura-text-muted',        // 1×
  '1F2A3C': '--aura-noir-steel',      // 1×
  '0C1A2D': '--aura-noir-deep',       // 1×
  '0C2038': '--aura-noir-deep',       // 1×
  '001A38': '--aura-noir-deep',       // 1×
  '6984AD': '--aura-text-muted',      // 1×
  '050F1C': '--aura-noir-void',       // 1×
  '010F1F': '--aura-noir-void',       // 1×
  '000E22': '--aura-noir-void',       // 1×
  '000E23': '--aura-noir-void',       // 1×
  '2A1E10': '--aura-noir-void',       // 1×
  '00142C': '--aura-noir-deep',       // 3× hero footer/visual
  '16130F': '--aura-noir-void',       // 5× POS/ordermgmt warm-black bg
};

// RGBA classification: rgb core (r,g,b as "R,G,B" string) → token
// Alpha is preserved by the caller (color-mix or rgba rebuilt from token not possible;
// we only report — the edit keeps the raw alpha via var() where token is opaque,
// meaning these need manual color-mix handling; see report note)
const RGBA_CANONICAL = {
  '242,192,141': '--aura-chrome-light', // old gold-bright rgba
  '212,165,116': '--aura-chrome-light', // old gold-primary rgba
  '239,189,138': '--aura-chrome-light',
  '205,127,50': '--aura-chrome-mid',    // bronze rgba
  '229,192,153': '--aura-chrome-light',
  '255,221,186': '--aura-chrome-bright',
  '198,198,199': '--aura-chrome-light', // grey glass
  '30,41,59': '--aura-glass-bg',        // noir-mid glass (slate-800)
  '18,37,61': '--aura-glass-bg',
  '26,38,53': '--aura-glass-bg',
  '11,32,56': '--aura-glass-bg',
  '2,20,41': '--aura-glass-bg',
  '8,20,37': '--aura-glass-bg',
  '21,32,49': '--aura-glass-bg',
  '10,26,46': '--aura-glass-bg',        // exact noir-deep
  '12,32,56': '--aura-glass-bg',
  '22,42,68': '--aura-glass-bg',
  '21,33,43': '--aura-glass-bg',
  '22,32,47': '--aura-glass-bg',
  '11,32,58': '--aura-glass-bg',
  '0,20,44': '--aura-glass-bg',
  '26,43,66': '--aura-glass-bg',
  '25,45,75': '--aura-glass-bg',
  '16,20,23': '--aura-glass-bg',
  '148,163,184': '--aura-glass-border', // slate blue glass
  '184,199,226': '--aura-glass-border',
  '187,199,222': '--aura-glass-border',
  '107,159,184': '--aura-glass-border',
  '201,214,223': '--aura-glass-border',
  '142,144,151': '--aura-border-muted',
  '168,169,173': '--aura-border-muted',
  '68,71,77': '--aura-border-chrome',
  '255,180,171': '--aura-error',
  '161,161,170': '--aura-border-muted',
  '229,228,226': '--aura-chrome-bright',
  '255,183,121': '--aura-chrome-bright', // light warm (ffb779 core)
  '196,146,113': '--aura-chrome-light',  // c49271 core
  '100,66,26': '--aura-chrome-mid',      // 64421a core
  '28,20,14': '--aura-noir-void',        // 1c140e warm-black glass/overlay
  '24,16,10': '--aura-noir-void',        // 18100a warm-black glass/overlay
  '197,198,205': '--aura-glass-border',  // c5c6cd core (slate grey glass)
  '229,231,235': '--aura-border-muted',  // e5e7eb core (grey-200)
};

function findMatch(hex) {
  const norm = normalizeHex(hex);
  // exact
  if (hexToTokens.has(norm)) {
    return { status: 'exact', token: hexToTokens.get(norm)[0], allTokens: hexToTokens.get(norm) };
  }
  // canonical legacy override
  if (CANONICAL[norm]) {
    return { status: 'canonical', token: CANONICAL[norm], note: 'legacy v6 gold/bronze → v7 chrome' };
  }
  // fuzzy: candidate must be within both lightness gate and deltaE gate
  let best = null;
  for (const [candidateHex, tokens] of hexToTokens) {
    const lDelta = Math.abs(lightness(hexToRgb(norm)) - lightness(hexToRgb(candidateHex)));
    if (lDelta > FUZZY_MAX_LIGHTNESS) continue;
    const de = deltaE93(norm, candidateHex);
    if (de <= FUZZY_MAX_DE && (best === null || de < best.de)) {
      best = { de, token: tokens[0], allTokens: tokens, hex: candidateHex };
    }
  }
  if (best) return { status: 'fuzzy', token: best.token, allTokens: best.allTokens, delta: best.de, matchedHex: `#${best.hex}` };
  return { status: 'unmatched' };
}

// --- scan files ---
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = singleFile
  ? [join(ROOT, singleFile)]
  : walk(join(ROOT, scanDir)).sort();

// 3/6/8-digit hex only (4-digit is rare and catches false positives like order IDs)
const HEX_RE = /#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![0-9A-Fa-f])/g;
const RGBA_RE = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:[01]?\.?\d+|0?\.\d+))?\s*\)/g;

const report = { scanned: files.length, files: [], generatedAt: new Date().toISOString() };
let totalRaw = 0, totalExact = 0, totalFuzzy = 0, totalUnmatched = 0;
const unmatchedGlobal = new Map(); // hex -> count

for (const f of files) {
  const rel = relative(ROOT, f);
  const src = readFileSync(f, 'utf-8');
  const lines = src.split('\n');
  const findings = [];
  lines.forEach((lineText, i) => {
    const lineNo = i + 1;
    // skip comment-only lines
    const trimmed = lineText.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    for (const m of lineText.matchAll(HEX_RE)) {
      const hex = m[0];
      const match = findMatch(hex);
      findings.push({ line: lineNo, raw: hex, ...match });
    }
    for (const m of lineText.matchAll(RGBA_RE)) {
      // rgba strings: classify by rgb core against canonical + glass tokens
      const raw = m[0];
      const nums = raw.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (!nums) continue;
      const hex = rgbToHex(+nums[1], +nums[2], +nums[3]);
      const alphaMatch = raw.match(/,\s*([01]?\.?\d+)\s*\)$/);
      const alpha = alphaMatch ? +alphaMatch[1] : 1;
      const key = `${nums[1]},${nums[2]},${nums[3]}`;
      if (RGBA_CANONICAL[key]) {
        findings.push({ line: lineNo, raw, hex, alpha, status: 'canonical', token: RGBA_CANONICAL[key], note: 'rgba core → token; keep alpha' });
      } else if (key === '255,255,255' && alpha <= 0.12) {
        findings.push({ line: lineNo, raw, hex, alpha, status: 'exact', token: '--aura-glass-bg', note: 'white glass' });
      } else if (key === '10,26,46' && alpha <= 0.3) {
        findings.push({ line: lineNo, raw, hex, alpha, status: 'exact', token: '--aura-glass-bg', note: 'glass pattern' });
      } else {
        findings.push({ line: lineNo, raw, hex, alpha, status: 'rgba', token: null, note: 'no direct token — review' });
      }
    }
  });
  if (findings.length) {
    totalRaw += findings.length;
    const exact = findings.filter((x) => x.status === 'exact' || x.status === 'canonical').length;
    const fuzzy = findings.filter((x) => x.status === 'fuzzy').length;
    const unmatched = findings.filter((x) => x.status === 'unmatched' || x.status === 'rgba').length;
    totalExact += exact; totalFuzzy += fuzzy; totalUnmatched += unmatched;
    report.files.push({
      file: rel,
      total: findings.length, exact, fuzzy, unmatched,
      findings,
    });
    for (const fnd of findings) {
      if (fnd.status === 'unmatched' || fnd.status === 'rgba') {
        unmatchedGlobal.set(fnd.raw, (unmatchedGlobal.get(fnd.raw) || 0) + 1);
      }
    }
  }
}

// one-line summary per file for batch planning: file<TAB>exact<TAB>fuzzy<TAB>unmatched
if (process.argv.includes('--batch-view')) {
  const lines = report.files.map((f) => `${f.file}\t${f.exact}\t${f.fuzzy}\t${f.unmatched}`);
  writeFileSync(join(ROOT, 'plans/260908-1439-m3-architecture-migration/hex-batch-view.tsv'), lines.join('\n') + '\n');
  console.log(`Batch view: plans/260908-1439-m3-architecture-migration/hex-batch-view.tsv (${report.files.length} files)`);
}

report.summary = { totalRaw, totalExact, totalFuzzy, totalUnmatched, unmatchedUnique: unmatchedGlobal.size };
report.unmatchedHistogram = Object.fromEntries(
  [...unmatchedGlobal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
);

// --- output ---
if (wantJson) {
  const outPath = join(ROOT, 'plans/260908-1439-m3-architecture-migration/hex-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${outPath}`);
} else {
  console.log(`Scanned ${report.scanned} files`);
  console.log(`Raw color occurrences: ${totalRaw} (exact ${totalExact}, fuzzy ${totalFuzzy}, unmatched/rgba ${totalUnmatched})`);
  console.log('');
  for (const fileReport of report.files) {
    console.log(`${fileReport.file}  [exact ${fileReport.exact} / fuzzy ${fileReport.fuzzy} / unmatched ${fileReport.unmatched}]`);
    for (const fnd of fileReport.findings) {
      const tag = fnd.status === 'exact' || fnd.status === 'canonical' ? 'EXACT' : fnd.status === 'fuzzy' ? 'FUZZY' : fnd.status === 'rgba' ? 'RGBA' : 'UNMATCHED';
      console.log(`  L${fnd.line} ${tag} ${fnd.raw} → ${fnd.token ?? '(none)'}${fnd.delta !== undefined ? ` (ΔE ${fnd.delta.toFixed(1)}, via ${fnd.matchedHex})` : ''}`);
    }
  }
  console.log('');
  console.log('Unmatched histogram (top 40):');
  for (const [hex, count] of Object.entries(report.unmatchedHistogram)) {
    console.log(`  ${hex} × ${count}`);
  }
}
