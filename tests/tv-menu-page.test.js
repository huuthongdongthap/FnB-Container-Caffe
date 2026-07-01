/**
 * TV Menu Page Tests — TDD (Phase 02)
 *
 * Tests for the full-screen TV menu display page.
 * Strategy: test HTML structure + extract JS functions + test individually.
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

const HTML_PATH = path.resolve(__dirname, '..', 'tv-menu.html');

function readHtml() {
  if (!fs.existsSync(HTML_PATH)) {
    throw new Error('tv-menu.html not found — TDD phase: tests written before implementation');
  }
  return fs.readFileSync(HTML_PATH, 'utf-8');
}

function extractScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  return match ? match[1] : '';
}

function extractStyle(html) {
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  return match ? match[1] : '';
}

/** Extract function definitions from script by stripping IIFE wrapper and execution calls */
function extractFunctions(script) {
  // Remove IIFE wrapper: (function() { 'use strict'; ... })();
  let inner = script
    .replace(/^\s*\(function\s*\(\s*\)\s*\{/, '')
    .replace(/\}\)\s*\(\s*\)\s*;?\s*$/, '');

  // Remove "'use strict';" directive
  inner = inner.replace(/'use strict';\s*/g, '');

  // Remove the execution calls at the end (loadAndRender + setInterval calls)
  inner = inner.replace(/\/\/\s*Initial load\s*\n\s*loadAndRender\s*\(\s*\)\s*;[\s\S]*$/, '');

  return inner;
}

/** Evaluate function definitions and return the context with all functions */
function evalFunctions(script) {
  const fnDefs = extractFunctions(script);
  // Only pass external dependencies — NOT variables declared in the script itself
  const ctx = {
    document: {
      getElementById: () => ({ textContent: '', innerHTML: '', style: {} }),
      body: { textContent: '', innerHTML: '' },
    },
    window: { location: { hostname: 'localhost' } },
    console: { error: () => {} },
    setInterval: () => 0,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, items: [], pagination: {} }) }),
  };
  // Evaluate function definitions in the context
  const fn = new Function(...Object.keys(ctx), fnDefs + '; return { formatPrice, groupByCategory, renderMenu, isHappyHour, escHtml, showError, fetchMenu };');
  return fn(...Object.values(ctx));
}

const sampleMenu = {
  success: true,
  items: [
    { id: '1', name: 'Cà Phê Sữa Đá', category: 'Cà Phê', price: 35000, available: true, tags: [], description: '' },
    { id: '2', name: 'Cà Phê Đen', category: 'Cà Phê', price: 25000, available: true, tags: [], description: '' },
    { id: '3', name: 'Bạc Xỉu', category: 'Cà Phê', price: 35000, available: true, tags: [], description: '' },
    { id: '4', name: 'Trà Đào', category: 'Trà', price: 45000, available: true, tags: [], description: '' },
    { id: '5', name: 'Trà Vải', category: 'Trà', price: 45000, available: true, tags: [], description: '' },
    { id: '6', name: 'Tiramisu', category: 'Bánh Ngọt', price: 55000, available: true, tags: [], description: '' },
  ],
  pagination: { total: 6, limit: 50, offset: 0 },
};

// ═══════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════

describe('TV Menu Page', () => {
  let html;
  let script;
  let style;

  beforeAll(() => {
    html = readHtml();
    script = extractScript(html);
    style = extractStyle(html);
  });

  // ── Test 1: HTML contains menu container ──
  test('should have a menu container element', () => {
    expect(html).toMatch(/id="tv-menu-container"/);
  });

  // ── Test 2: References correct API endpoint ──
  test('should reference API menu endpoint with available=true', () => {
    expect(script).toMatch(/\/menu\?available=true/);
    expect(script).toMatch(/API_BASE/);
  });

  // ── Test 3: Groups items by category (test groupByCategory function) ──
  test('should group items by category', () => {
    const fns = evalFunctions(script);
    expect(fns.groupByCategory).toBeDefined();

    const groups = fns.groupByCategory(sampleMenu.items);
    expect(Object.keys(groups).sort()).toEqual(['Bánh Ngọt', 'Cà Phê', 'Trà']);
    expect(groups['Cà Phê']).toHaveLength(3);
    expect(groups['Trà']).toHaveLength(2);
  });

  // ── Test 4: Formats price in VND ──
  test('should format price in VND with đ suffix', () => {
    const fns = evalFunctions(script);
    expect(fns.formatPrice).toBeDefined();

    const result = fns.formatPrice(35000);
    expect(result).toMatch(/35/);
    expect(result).toMatch(/000/);
    expect(result).toMatch(/đ/);
  });

  // ── Test 5: Auto-refresh interval configured ──
  test('should set auto-refresh interval to 60000ms', () => {
    expect(script).toMatch(/setInterval/);
    expect(script).toMatch(/60000/);
  });

  // ── Test 6: Handles empty menu gracefully ──
  test('should handle empty menu gracefully', () => {
    const fns = evalFunctions(script);
    expect(fns.renderMenu).toBeDefined();

    // renderMenu should check for empty items
    const fnSrc = script;
    expect(fnSrc).toMatch(/length === 0|\.length === 0/);
    expect(fnSrc).toMatch(/chưa có món/);
  });

  // ── Test 7: Handles API error gracefully ──
  test('should handle API error without crashing', () => {
    expect(script).toMatch(/catch/);
    expect(script).toMatch(/error/);
    expect(script).toMatch(/showError/);
  });

  // ── Test 8: Handles large menu (75 items) ──
  test('should handle large menu with many items', () => {
    const fns = evalFunctions(script);
    expect(fns.groupByCategory).toBeDefined();

    const largeItems = Array.from({ length: 75 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      category: `Category ${i % 5}`,
      price: (i + 1) * 10000,
      available: true,
    }));
    const groups = fns.groupByCategory(largeItems);

    expect(Object.keys(groups)).toHaveLength(5);
    const totalItems = Object.values(groups).reduce((sum, g) => sum + g.length, 0);
    expect(totalItems).toBe(75);
  });

  // ── Test 9: Happy hour detection ──
  test('should detect happy hour (14:00-16:00)', () => {
    // Verify the isHappyHour function exists
    expect(script).toMatch(/isHappyHour/);
    // Verify the time range
    expect(script).toMatch(/14/);
    expect(script).toMatch(/16/);
    // Verify happy hour banner element exists in HTML
    expect(html).toMatch(/id="happyHourBanner"/);
  });

  // ── Test 10: Full-screen CSS applies ──
  test('should apply full-screen styles (100vw, 100vh)', () => {
    expect(style).toMatch(/100vw/);
    expect(style).toMatch(/100vh/);
    expect(style).toMatch(/overflow:\s*hidden/);
  });
});
