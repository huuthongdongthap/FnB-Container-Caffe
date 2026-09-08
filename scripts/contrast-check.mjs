#!/usr/bin/env node
/**
 * WCAG AA Contrast Checker for Aura Cafe M3 design tokens.
 * Reads brand-tokens.css, resolves var(--aura-*) aliases to hex,
 * then checks 8 required foreground/background pairs.
 *
 * Usage: node scripts/contrast-check.mjs
 * Exit 0 = all pass, Exit 1 = any fail.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = resolve(__dirname, "../src/styles/brand-tokens.css");

// ── sRGB linearization ──────────────────────────────────────────────
function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(fg, bg) {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── hex / rgba parsing ──────────────────────────────────────────────
function parseHex(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Composite rgba over a solid background, return [r,g,b]. */
function compositeRgba(rgba, bgRgb) {
  const match = rgba.match(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/
  );
  if (!match) return null;
  const [, rS, gS, bS, aS] = match;
  const a = parseFloat(aS);
  const r = Math.round(parseInt(rS) * a + bgRgb[0] * (1 - a));
  const g = Math.round(parseInt(gS) * a + bgRgb[1] * (1 - a));
  const b = Math.round(parseInt(bS) * a + bgRgb[2] * (1 - a));
  return [r, g, b];
}

// ── CSS parsing ─────────────────────────────────────────────────────
function parseCssVars(cssText) {
  const vars = new Map();

  // Match --var-name: value; (inside any block, but we only care about :root)
  const rootMatch = cssText.match(/:root\s*\{([\s\S]*?)\n\s*\}/);
  if (!rootMatch) {
    console.error("ERROR: Could not find :root block in CSS.");
    process.exit(2);
  }
  const rootBlock = rootMatch[1];

  // First pass: collect direct hex and rgba values
  const propRe = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = propRe.exec(rootBlock)) !== null) {
    const name = m[1].trim();
    const val = m[2].trim();
    vars.set(name, val);
  }

  // Resolve var() aliases (up to 3 hops)
  const varRefRe = /var\(--([\w-]+)\)/;
  for (let hop = 0; hop < 3; hop++) {
    for (const [name, val] of vars) {
      const ref = val.match(varRefRe);
      if (ref && vars.has(ref[1])) {
        vars.set(name, vars.get(ref[1]));
      }
    }
  }

  return vars;
}

/** Resolve a token value to [r,g,b]. Handles hex, rgba (composites over surface), and var() refs. */
function resolveColor(raw, vars, surfaceBg) {
  // var() reference
  const varRef = raw.match(/var\(--([\w-]+)\)/);
  if (varRef) {
    const resolved = vars.get(varRef[1]);
    if (resolved) return resolveColor(resolved, vars, surfaceBg);
    return null;
  }
  // rgba — composite over surface
  if (raw.startsWith("rgba")) {
    return compositeRgba(raw, surfaceBg);
  }
  // hex
  if (raw.startsWith("#")) {
    return parseHex(raw);
  }
  return null;
}

// ── Main ────────────────────────────────────────────────────────────
function main() {
  const cssText = readFileSync(CSS_PATH, "utf-8");
  const vars = parseCssVars(cssText);

  const SURFACE_HEX = "#0A1A2E";
  const surfaceBg = parseHex(SURFACE_HEX);

  // Required WCAG AA pairs: [label, fgSpec, bgSpec, requiredRatio]
  // Specs read live from CSS tokens where they exist so the check tracks reality.
  const pairs = [
    ["on-surface → surface",             "var(--md-sys-color-on-surface)",        "var(--md-sys-color-surface)",              4.5],
    ["on-surface-variant → surface-cont", "var(--md-sys-color-on-surface-variant)", "var(--md-sys-color-surface-container)",  4.5],
    ["on-primary → primary",             "var(--md-sys-color-on-primary)",        "var(--md-sys-color-primary)",              4.5],
    ["primary → surface",                "var(--md-sys-color-primary)",           "var(--md-sys-color-surface)",              3.0],
    ["on-secondary → secondary",         "var(--md-sys-color-on-secondary)",     "var(--md-sys-color-secondary)",           4.5],
    ["on-tertiary → tertiary",           "var(--md-sys-color-on-tertiary)",       "var(--md-sys-color-tertiary)",             4.5],
    ["on-error-container → error-cont",  "var(--md-sys-color-on-error-container)", "var(--md-sys-color-error-container)",     4.5],
    ["text-muted → surface",             "var(--aura-text-muted)",                "var(--md-sys-color-surface)",              4.5],
  ];

  let allPass = true;
  const rows = [];

  for (const [label, fgSpec, bgSpec, reqRatio] of pairs) {
    let fg = fgSpec.startsWith("#") ? parseHex(fgSpec) : resolveColor(fgSpec, vars, surfaceBg);
    let bg;

    // Special handling: error-container is rgba composited over surface
    if (bgSpec.startsWith("var")) {
      const raw = vars.get(bgSpec.match(/var\(--([\w-]+)\)/)?.[1]) || bgSpec;
      bg = resolveColor(raw, vars, surfaceBg);
    } else {
      bg = bgSpec.startsWith("#") ? parseHex(bgSpec) : resolveColor(bgSpec, vars, surfaceBg);
    }

    if (!fg || !bg) {
      rows.push({ label, fgSpec, bgSpec, ratio: "ERR", reqRatio, pass: false });
      allPass = false;
      continue;
    }

    const ratio = contrastRatio(fg, bg);
    const pass = ratio >= reqRatio;
    if (!pass) allPass = false;

    const fgHex = fgSpec.startsWith("#") ? fgSpec : rgbToHex(fg);
    const bgHex = bgSpec.startsWith("#") ? bgSpec : rgbToHex(bg);
    rows.push({ label, fg: fgHex, bg: bgHex, ratio, reqRatio, pass });
  }

  // ── ASCII table output ──────────────────────────────────────────
  const sep = "+-" + "-".repeat(38) + "-+-" + "-".repeat(10) + "-+-" + "-".repeat(10) + "-+-" + "-".repeat(8) + "-+-" + "-".repeat(10) + "-+-" + "-".repeat(6) + "-+";
  const hdr = "| " + "Pair".padEnd(37) + " | " + "FG".padEnd(9) + " | " + "BG".padEnd(9) + " | " + "Ratio".padEnd(7) + " | " + "Required".padEnd(9) + " | " + "Result".padEnd(5) + " |";

  console.log("\n  Aura Cafe — WCAG AA Contrast Check\n");
  console.log(sep);
  console.log(hdr);
  console.log(sep);

  for (const r of rows) {
    const fg = r.fg ?? r.fgSpec;
    const bg = r.bg ?? r.bgSpec;
    const ratioStr = typeof r.ratio === "number" ? r.ratio.toFixed(2) + ":1" : r.ratio;
    const reqStr = r.reqRatio + ":1";
    const result = r.pass ? "PASS" : "FAIL";
    const row =
      "| " + r.label.padEnd(37) +
      " | " + (typeof fg === "string" ? fg : "").padEnd(9) +
      " | " + (typeof bg === "string" ? bg : "").padEnd(9) +
      " | " + ratioStr.padEnd(7) +
      " | " + reqStr.padEnd(9) +
      " | " + result.padEnd(5) + " |";
    console.log(row);
  }
  console.log(sep);

  console.log(
    allPass
      ? "\n  RESULT: ALL 8 pairs PASS — WCAG AA compliant.\n"
      : "\n  RESULT: SOME pairs FAIL — see table above.\n"
  );

  process.exit(allPass ? 0 : 1);
}

main();
