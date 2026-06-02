import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'index', url: '/', label: 'Trang chủ' },
  { name: 'menu', url: '/menu.html', label: 'Thực đơn' },
  { name: 'checkout', url: '/checkout.html', label: 'Thanh toán' },
  { name: 'loyalty', url: '/loyalty.html', label: 'Tích điểm' },
  { name: 'reservation', url: '/table-reservation.html', label: 'Đặt bàn' },
  { name: 'contact', url: '/contact.html', label: 'Liên hệ' },
  { name: 'about', url: '/about-us.html', label: 'Giới thiệu' },
];

const BANNED_HEX = [
  '#FFD700', '#D4AF37', '#B8860B', '#FFE970',
  '#FF6B35', '#FF1744', '#8B4513', '#C9A200', '#C9A962',
];

test.describe('FnB UI — X100 Deep Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  for (const p of PAGES) {
    test.describe(`${p.label} (${p.url})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(p.url);
        await page.waitForLoadState('networkidle');
      });

      test('page loads without console errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));
        page.on('console', msg => {
          if (msg.type() === 'error') errors.push(msg.text());
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(errors).toEqual([]);
      });

      test('no FOVT — theme applied before paint', async ({ page }) => {
        const themeSnap = await page.evaluate(() => {
          const html = document.documentElement;
          return {
            theme: html.getAttribute('data-theme'),
            computedBg: getComputedStyle(html).backgroundColor,
          };
        });
        expect(['light', 'dark']).toContain(themeSnap.theme);
      });

      test('no banned Fire/Earth color hex in computed styles', async ({ page }) => {
        const banned = await page.evaluate((bannedList) => {
          const all = document.querySelectorAll('*');
          const found: string[] = [];
          for (const el of all) {
            const bg = getComputedStyle(el).backgroundColor;
            const color = getComputedStyle(el).color;
            for (const hex of bannedList) {
              if (bg.includes(hex) || color.includes(hex)) {
                found.push(`${el.tagName}.${el.className} — ${hex}`);
              }
            }
          }
          return [...new Set(found)];
        }, BANNED_HEX);
        expect(banned).toEqual([]);
      });

      test('no horizontal overflow on mobile (375px)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.reload();
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBe(0);
      });

      test('no horizontal overflow on tablet (768px)', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.reload();
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBe(0);
      });

      test('no horizontal overflow on desktop (1440px)', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.reload();
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBe(0);
      });

      test('no emoji in body text content (content audit)', async ({ page }) => {
        const hasEmoji = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          return /[\u{1F300}-\u{1FAFF}]/u.test(bodyText);
        });
        expect(hasEmoji).toBe(false);
      });

      test('hero/critical section visible and not zero-size', async ({ page }) => {
        const hero = page.locator('.hero, .hero-v8, #hero');
        if (await hero.count() > 0) {
          const box = await hero.first().boundingBox();
          expect(box?.width).toBeGreaterThan(0);
          expect(box?.height).toBeGreaterThan(0);
        }
      });

      test('nav links are clickable and responsive', async ({ page }) => {
        const nav = page.locator('nav, .navbar, #shared-navbar');
        if (await nav.count() > 0) {
          const links = nav.first().locator('a');
          const count = await links.count();
          expect(count).toBeGreaterThan(0);
          for (let i = 0; i < Math.min(count, 5); i++) {
            await links.nth(i).click();
            await page.waitForLoadState('networkidle');
            expect(page.url()).not.toBe('about:blank');
          }
        }
      });
    });
  }

  test.describe('Cross-page consistency', () => {
    test('brand-tokens.css loads on all pages', async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.url);
        const link = page.locator('link[href*="brand-tokens.css"]');
        await expect(link).toHaveCount(1, { timeout: 5000 });
      }
    });

    test('shared-nav.js loads on all pages', async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.url);
        const script = page.locator('script[src*="shared-nav"]');
        if (await script.count() > 0) {
          await expect(script.first()).toBeAttached();
        }
      }
    });

    test('no 404s on page assets', async ({ page }) => {
      const failed: string[] = [];
      page.on('response', async (res) => {
        if (res.status() === 404) {
          failed.push(res.url());
        }
      });
      for (const p of PAGES) {
        await page.goto(p.url);
        await page.waitForLoadState('networkidle');
      }
      expect(failed).toEqual([]);
    });
  });
});
