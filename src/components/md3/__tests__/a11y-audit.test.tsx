/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A11y audit: WCAG AA contrast matrix from live CSS tokens.
 * Mirrors scripts/contrast-check.mjs — same math, runs inside vitest CI.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = resolve(__dirname, '../../../styles/brand-tokens.css');
const GLOBAL_CSS_PATH = resolve(__dirname, '../../../styles/global.css');

type Rgb = [number, number, number];

/* ── WCAG relative luminance ─────────────────────────────── */
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: Rgb): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(fg: Rgb, bg: Rgb): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ── token parsing (regex over :root block) ──────────────── */
function parseHex(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function compositeRgba(rgba: string, bgRgb: Rgb): Rgb | null {
  const m = rgba.match(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
  );
  if (!m) return null;
  const [, rS, gS, bS, aS] = m;
  const a = parseFloat(aS!);
  return [
    Math.round(parseInt(rS!, 10) * a + bgRgb[0] * (1 - a)),
    Math.round(parseInt(gS!, 10) * a + bgRgb[1] * (1 - a)),
    Math.round(parseInt(bS!, 10) * a + bgRgb[2] * (1 - a)),
  ];
}

function parseCssVars(cssText: string): Map<string, string> {
  const vars = new Map<string, string>();
  const rootMatch = cssText.match(/:root\s*\{([\s\S]*?)\n\s*\}/);
  if (!rootMatch) throw new Error(':root block not found in brand-tokens.css');
  const rootBlock = rootMatch[1]!;

  const propRe = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(rootBlock)) !== null) {
    vars.set(m[1]!.trim(), m[2]!.trim());
  }

  // Resolve var() aliases (up to 3 hops)
  const varRefRe = /var\(--([\w-]+)\)/;
  for (let hop = 0; hop < 3; hop++) {
    for (const [name, val] of vars) {
      const ref = val.match(varRefRe);
      if (ref && vars.has(ref[1]!)) {
        vars.set(name, vars.get(ref[1]!)!);
      }
    }
  }
  return vars;
}

function resolveColor(
  raw: string,
  vars: Map<string, string>,
  surfaceBg: Rgb,
): Rgb | null {
  const varRef = raw.match(/var\(--([\w-]+)\)/);
  if (varRef) {
    const resolved = vars.get(varRef[1]!);
    if (resolved) return resolveColor(resolved, vars, surfaceBg);
    return null;
  }
  if (raw.startsWith('rgba')) return compositeRgba(raw, surfaceBg);
  if (raw.startsWith('#')) return parseHex(raw);
  return null;
}

/* ── pairs under test ────────────────────────────────────── */
const SURFACE_HEX = '#0A1A2E';

interface Pair {
  label: string;
  fg: string;
  bg: string;
  req: number;
}

const PAIRS: Pair[] = [
  { label: 'on-surface → surface', fg: 'var(--md-sys-color-on-surface)', bg: 'var(--md-sys-color-surface)', req: 4.5 },
  { label: 'on-surface-variant → surface-container', fg: 'var(--md-sys-color-on-surface-variant)', bg: 'var(--md-sys-color-surface-container)', req: 4.5 },
  { label: 'on-primary → primary', fg: 'var(--md-sys-color-on-primary)', bg: 'var(--md-sys-color-primary)', req: 4.5 },
  { label: 'primary → surface', fg: 'var(--md-sys-color-primary)', bg: 'var(--md-sys-color-surface)', req: 3.0 },
  { label: 'on-secondary → secondary', fg: 'var(--md-sys-color-on-secondary)', bg: 'var(--md-sys-color-secondary)', req: 4.5 },
  { label: 'on-tertiary → tertiary', fg: 'var(--md-sys-color-on-tertiary)', bg: 'var(--md-sys-color-tertiary)', req: 4.5 },
  { label: 'on-error-container → error-container', fg: 'var(--md-sys-color-on-error-container)', bg: 'var(--md-sys-color-error-container)', req: 4.5 },
  { label: 'text-muted → surface', fg: 'var(--aura-text-muted)', bg: 'var(--md-sys-color-surface)', req: 4.5 },
];

describe('M3 a11y audit — WCAG AA contrast matrix', () => {
  const cssText = readFileSync(CSS_PATH, 'utf-8');
  const vars = parseCssVars(cssText);
  const surfaceBg = parseHex(SURFACE_HEX);

  it.each(PAIRS)('AA %s', ({ label, fg, bg, req }: Pair) => {
    expect.hasAssertions();
    const fgRgb = resolveColor(fg, vars, surfaceBg);
    const bgRgb = resolveColor(bg, vars, surfaceBg);
    expect(fgRgb, `FG token unresolved: ${label}`).not.toBeNull();
    expect(bgRgb, `BG token unresolved: ${label}`).not.toBeNull();
    const ratio = contrastRatio(fgRgb!, bgRgb!);
    expect(
      ratio,
      `${label} contrast ${ratio.toFixed(2)}:1 < ${req}:1 — bump token lightness`,
    ).toBeGreaterThanOrEqual(req);
  });

  it('reduced-motion CSS present in global.css', () => {
    const global = readFileSync(GLOBAL_CSS_PATH, 'utf-8');
    expect(global).toContain('prefers-reduced-motion: reduce');
    expect(global).toContain('transition-duration: 0.01ms !important');
  });
});

/* ── ARIA smoke: every interactive primitive touches a11y attrs ─ */
describe('M3 a11y audit — roles/labels smoke (static markup)', () => {
  it('primitives carry role/aria attributes', () => {
    const md3Dir = resolve(__dirname, '..');
    const files = readdirSync(md3Dir).filter(
      (f) => f.endsWith('.tsx') && !f.includes('.test.'),
    );
    expect(files.length).toBeGreaterThanOrEqual(12);
    for (const f of files) {
      const src = readFileSync(resolve(md3Dir, f), 'utf-8');
      // Passes if the file uses explicit a11y attrs OR native semantic
      // interactive elements (button/input/nav/label/header/h1) — either
      // path satisfies accessible markup.
      expect(
        /aria-|role=|<button|<input|<nav|<label|<header|<h1/.test(src),
        `${f} lacks aria-*/role/native-semantic markup`,
      ).toBe(true);
    }
  });
});
