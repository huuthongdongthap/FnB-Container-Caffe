/**
 * Signage Widget Tests - AURA CAFE
 * Tests for standalone Xibo HTML widgets using jsdom.
 * Verified pass: 2026-07-01
 */

import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

const WIDGET_DIR = path.join(__dirname, '..', 'signage-widgets');

/**
 * Create a jsdom instance from an HTML widget file.
 * Evaluates the inline script with auto-init stripped so tests
 * can call rendering functions manually.
 */
function createWidgetDOM(htmlPath: string, mockFetch?: any) {
  const html = fs.readFileSync(htmlPath, 'utf-8');

  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'http://localhost',
  });

  // Set up fetch mock on window before evaluating scripts
  (dom.window as any).fetch = mockFetch || vi.fn();

  // Extract all inline script content
  const scripts = dom.window.document.querySelectorAll('script');
  let scriptContent = '';
  scripts.forEach((s: any) => {
    scriptContent += s.textContent + '\n';
  });

  // Strip auto-init section using clear marker comment
  const markerIdx = scriptContent.indexOf('// === AUTO-INIT');
  const cleanScript = markerIdx >= 0
    ? scriptContent.substring(0, markerIdx).trim()
    : scriptContent.trim();

  if (cleanScript) {
    (dom.window as any).eval(cleanScript);
  }

  return dom;
}

// ──────────────────────────────────────────────
// Menu Board Widget Tests
// ──────────────────────────────────────────────
describe('Menu Board Widget (menu-board.html)', () => {
  const menuData = {
    categories: [
      {
        id: 1,
        name: 'Cà phê',
        name_en: 'Coffee',
        products: [
          {
            id: 1,
            name: 'Cà phê sữa đá',
            name_en: 'Iced Milk Coffee',
            price: 45000,
            image: '/images/ca-phe-sua-da.jpg',
            currency: 'VND',
          },
          {
            id: 2,
            name: 'Americano',
            name_en: 'Americano',
            price: 40000,
            image: '/images/americano.jpg',
            currency: 'VND',
          },
        ],
      },
      {
        id: 2,
        name: 'Trà',
        name_en: 'Tea',
        products: [
          {
            id: 3,
            name: 'Trà đào',
            name_en: 'Peach Tea',
            price: 45000,
            image: '/images/tra-dao.jpg',
            currency: 'VND',
          },
        ],
      },
    ],
  };

  it('renders category headings for each menu category', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'menu-board.html'));
    await (dom.window as any).renderMenu(menuData);

    const headings = dom.window.document.querySelectorAll('.category-title');
    expect(headings.length).toBe(2);
    expect(headings[0].textContent).toContain('Cà phê');
    expect(headings[1].textContent).toContain('Trà');
  });

  it('renders product items with name, price, and image', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'menu-board.html'));
    await (dom.window as any).renderMenu(menuData);

    const products = dom.window.document.querySelectorAll('.product-item');
    expect(products.length).toBe(3);

    // First product
    const p1 = products[0];
    expect(p1.querySelector('.product-name')!.textContent).toContain('Cà phê sữa đá');
    expect(p1.querySelector('.product-price')!.textContent).toContain('45,000');
    expect(p1.querySelector('.product-image')!.getAttribute('src')).toContain('ca-phe-sua-da');

    // Second product
    const p2 = products[1];
    expect(p2.querySelector('.product-name')!.textContent).toContain('Americano');
    expect(p2.querySelector('.product-price')!.textContent).toContain('40,000');

    // Third product
    const p3 = products[2];
    expect(p3.querySelector('.product-name')!.textContent).toContain('Trà đào');
    expect(p3.querySelector('.product-price')!.textContent).toContain('45,000');
  });

  it('shows error message overlay when fetch fails', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'menu-board.html'));
    (dom.window as any).handleMenuError(new Error('Network error'));

    const overlay = dom.window.document.querySelector('.error-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay!.textContent).toContain('Đang tải');
  });

  it('calls fetch with correct API endpoint and unwraps API response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: menuData.categories }),
    });
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'menu-board.html'), mockFetch);

    await (dom.window as any).fetchAndRender();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/signage/menu')
    );
    // Verify render received API-shaped data (unwrapped to { categories })
    const headings = dom.window.document.querySelectorAll('.category-title');
    expect(headings.length).toBe(2);
  });
});

// ──────────────────────────────────────────────
// Promo Screen Widget Tests
// ──────────────────────────────────────────────
describe('Promo Screen Widget (promo-screen.html)', () => {
  const promosData = {
    promos: [
      {
        code: 'AURA20',
        percent: 20,
        max_discount: 50000,
        expires_at: '2026-07-15T23:59:59Z',
      },
      {
        code: 'WELCOME',
        percent: 50,
        max_discount: 30000,
        expires_at: '2026-08-01T23:59:59Z',
      },
    ],
  };

  it('renders promo cards with title and discount percentage', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'promo-screen.html'));
    await (dom.window as any).renderPromos(promosData);

    const cards = dom.window.document.querySelectorAll('.promo-card');
    expect(cards.length).toBe(2);

    expect(cards[0].textContent).toContain('AURA20');
    expect(cards[0].textContent).toContain('20%');

    expect(cards[1].textContent).toContain('WELCOME');
    expect(cards[1].textContent).toContain('50%');
  });

  it('shows expiry date on promo cards', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'promo-screen.html'));
    await (dom.window as any).renderPromos(promosData);

    const cards = dom.window.document.querySelectorAll('.promo-card');
    expect(cards[0].querySelector('.promo-expiry')).toBeTruthy();
    expect(cards[0].querySelector('.promo-expiry')!.textContent).toContain('HSD');
    expect(cards[0].querySelector('.promo-expiry')!.textContent).toMatch(/07\/2026/);
  });

  it('renders carousel indicators', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'promo-screen.html'));
    await (dom.window as any).renderPromos(promosData);

    const indicators = dom.window.document.querySelectorAll('.carousel-dot, .indicator');
    expect(indicators.length).toBe(2);
  });

  it('shows fallback message when no promos returned', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'promo-screen.html'));
    await (dom.window as any).renderPromos({ promos: [] });

    const fallback = dom.window.document.querySelector('.fallback-msg, .no-promos');
    expect(fallback).toBeTruthy();
    expect(fallback!.textContent).toContain('Hiện không có');
  });

  it('shows error message on fetch failure', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'promo-screen.html'));
    (dom.window as any).handlePromoError(new Error('Network error'));

    const overlay = dom.window.document.querySelector('.error-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay!.textContent).toContain('Đang tải khuyến mãi');
  });
});

// ──────────────────────────────────────────────
// Welcome Screen Widget Tests
// ──────────────────────────────────────────────
describe('Welcome Screen Widget (welcome-screen.html)', () => {
  const promosData = {
    promos: [
      {
        code: 'AURA20',
        percent: 20,
        max_discount: 50000,
        expires_at: '2026-07-15T23:59:59Z',
      },
    ],
  };

  it('renders welcome section with heading', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'welcome-screen.html'));
    await (dom.window as any).renderWelcome();

    const welcome = dom.window.document.querySelector('.welcome-section');
    expect(welcome).toBeTruthy();
    expect(welcome!.textContent).toContain('Chào mừng');
  });

  it('renders wifi info section', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'welcome-screen.html'));
    await (dom.window as any).renderWelcome();

    const wifi = dom.window.document.querySelector('.wifi-section');
    expect(wifi).toBeTruthy();
    expect(wifi!.textContent).toContain('Wi-Fi');
  });

  it('renders loyalty highlights section', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'welcome-screen.html'));
    await (dom.window as any).renderWelcome();

    const loyalty = dom.window.document.querySelector('.loyalty-section');
    expect(loyalty).toBeTruthy();
    expect(loyalty!.textContent).toContain('Tích điểm');
  });

  it('renders today specials section with promo data', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'welcome-screen.html'));
    await (dom.window as any).renderSpecials(promosData);

    const specials = dom.window.document.querySelector('.specials-section');
    expect(specials).toBeTruthy();
    expect(specials!.textContent!.toLowerCase()).toContain('đặc biệt');
  });

  it('renders section rotation indicators', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'welcome-screen.html'));
    await (dom.window as any).renderWelcome();

    const indicators = dom.window.document.querySelectorAll('.section-indicator, .rotate-dot');
    expect(indicators.length).toBeGreaterThanOrEqual(3);
  });

  it('contains Aura branding text', async () => {
    const dom = createWidgetDOM(path.join(WIDGET_DIR, 'welcome-screen.html'));
    await (dom.window as any).renderWelcome();

    const body = dom.window.document.body.textContent;
    expect(body).toContain('AURA');
  });
});

// ──────────────────────────────────────────────
// File Existence Tests
// ──────────────────────────────────────────────
describe('Widget file structure', () => {
  it('menu-board.html exists and is valid HTML', () => {
    const html = fs.readFileSync(path.join(WIDGET_DIR, 'menu-board.html'), 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('API_BASE');
  });

  it('promo-screen.html exists and is valid HTML', () => {
    const html = fs.readFileSync(path.join(WIDGET_DIR, 'promo-screen.html'), 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('API_BASE');
  });

  it('welcome-screen.html exists and is valid HTML', () => {
    const html = fs.readFileSync(path.join(WIDGET_DIR, 'welcome-screen.html'), 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('API_BASE');
  });
});
