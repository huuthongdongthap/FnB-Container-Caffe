import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'Home', url: '/', checks: ['hero', 'pills', 'zones', 'cta', 'svg-icons'] },
  { name: 'Menu', url: '/menu', checks: ['menu-grid', 'filters', 'prices'] },
  { name: 'Checkout', url: '/checkout', checks: ['form', 'payment', 'cart'] },
  { name: 'Loyalty', url: '/loyalty', checks: ['tier-card', 'points'] },
  { name: 'Reservation', url: '/table-reservation', checks: ['seat-grid', 'blueprint'] },
  { name: 'Contact', url: '/contact', checks: ['form', 'map', 'info'] },
  { name: 'About', url: '/about', checks: ['story', 'zones'] },
  { name: 'Promo', url: '/promotions', checks: ['cards', 'cta'] },
];

const BANNED_HEX = [
  '#FFD700', '#D4AF37', '#B8860B', '#FFE970',
  '#FF6B35', '#FF1744', '#8B4513', '#C9A200', '#C9A962',
];

test.describe('FnB UI — X100 Deep Audit', () => {
  for (const p of PAGES) {
    test.describe(`${p.name} (${p.url})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(p.url);
        await page.waitForLoadState('networkidle');
      });

      test('loads without console errors', async ({ page }) => {
        const errors: string[] = [];
        const noise = /vite|hmr|webSocket|websocket|import\.meta|__vite|ERR_CONNECTION_REFUSED|Failed to load resource|127\.0\.0\.1:8787|access control checks|Could not connect to the server|cal\.com|Cal\b/i;
        page.on('pageerror', err => {
          if (!noise.test(err.message)) errors.push(err.message);
        });
        page.on('console', msg => {
          if (msg.type() === 'error' && !noise.test(msg.text())) errors.push(msg.text());
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
        expect(errors).toEqual([]);
      });

      test('no FOVT — theme applied at load', async ({ page }) => {
        const state = await page.evaluate(() => {
          const html = document.documentElement;
          return {
            theme: html.getAttribute('data-theme'),
            bg: getComputedStyle(html).backgroundColor,
          };
        });
        expect(['light', 'dark', null]).toContain(state.theme);
        expect(state.bg).not.toBe('rgba(0, 0, 0, 0)');
      });

      test('no banned Fire/Earth colors in computed styles', async ({ page }) => {
        const found = await page.evaluate((banned) => {
          const hits: string[] = [];
          document.querySelectorAll('*').forEach(el => {
            const bg = getComputedStyle(el).backgroundColor;
            const fg = getComputedStyle(el).color;
            for (const hex of banned) {
              if (bg.includes(hex) || fg.includes(hex)) {
                hits.push(`${el.tagName}.${el.className} → ${hex}`);
              }
            }
          });
          return [...new Set(hits)].slice(0, 10);
        }, BANNED_HEX);
        expect(found).toEqual([]);
      });

      test('no horizontal overflow — mobile 375px', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.reload();
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBe(0);
      });

      test('no horizontal overflow — tablet 768px', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.reload();
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBe(0);
      });

      test('no horizontal overflow — desktop 1440px', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.reload();
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBe(0);
      });

      test('no raw emoji in body text', async ({ page }) => {
        const hasEmoji = await page.evaluate(() => /[\u{1F300}-\u{1FAFF}]/u.test(document.body.innerText));
        expect(hasEmoji).toBe(false);
      });

      test('hero/critical sections visible and sized', async ({ page }) => {
        const selectors = ['.hero', '.hero-v8', '#hero', '.space-grid', '.menu-grid', '.checkout-form'];
        for (const sel of selectors) {
          const el = page.locator(sel);
          if (await el.count() > 0) {
            const box = await el.first().boundingBox();
            if (box) {
              expect(box.width).toBeGreaterThan(0);
              expect(box.height).toBeGreaterThan(0);
            }
          }
        }
      });

      test('primary CTA buttons visible and styled', async ({ page }) => {
        const buttons = page.locator('.btn-primary, .btn.btn-primary, button[type="submit"], a[href*="reservation"]');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < Math.min(count, 3); i++) {
          const box = await buttons.nth(i).boundingBox();
          if (box) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
          }
        }
      });

      test('all images load without 404', async ({ page }) => {
        const failed: string[] = [];
        page.on('response', async (res) => {
          if (res.status() === 404 && res.request().resourceType() === 'image') {
            failed.push(res.url());
          }
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
        expect(failed).toEqual([]);
      });
    });
  }

  test.describe('Cross-page consistency', () => {
    test('brand-tokens.css linked on all pages', async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.url);
        const css = page.locator('link[href*="brand-tokens.css"], link[href*="homepage-v6.css"]');
        await expect(css.first()).toBeAttached({ timeout: 5000 });
      }
    });

    test('no 404s across all pages', async ({ page }) => {
      const failed: string[] = [];
      page.on('response', async (res) => {
        if (res.status() === 404) failed.push(res.url());
      });
      for (const p of PAGES) {
        await page.goto(p.url);
        await page.waitForLoadState('networkidle');
      }
      expect(failed).toEqual([]);
    });

    test('viewport meta tag on all pages', async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.url);
        const vp = page.locator('meta[name="viewport"]');
        await expect(vp).toHaveCount(1);
      }
    });

    test('lang attribute on all pages', async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.url);
        const lang = await page.getAttribute('html', 'lang');
        expect(lang).toBeTruthy();
      }
    });
  });
});
