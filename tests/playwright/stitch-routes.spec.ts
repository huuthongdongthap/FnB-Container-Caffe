/**
 * Stitch Routes E2E Tests — AURA CAFE
 *
 * Covers all routes NOT in the existing ui-audit/fnb-audit test suites.
 * Focuses on verifying pages load with Stitch component rendering.
 *
 * Requires: NEXT_PUBLIC_MOCK_AI_SERVICES=true env var (set in playwright.config.ts).
 *
 * Run: npx playwright test tests/playwright/stitch-routes.spec.ts
 */

import { test, expect } from '@playwright/test';

/* ─── Route definitions ──────────────────────────────────────────────── */

interface RouteDef {
  name: string;
  url: string;
  stitch: boolean;
  stitchComponent: string;
  /** Expected text fragment found on the page (content check) */
  contentHint?: string;
}

const PAGES: RouteDef[] = [
  // ── Pages with Stitch component rendering ──
  {
    name: 'Order Mobile',
    url: '/order',
    stitch: true,
    stitchComponent: 'StitchMobileOrderNew',
    contentHint: 'Order',
  },
  {
    name: 'Container Cafe',
    url: '/container',
    stitch: true,
    stitchComponent: 'StitchContainerNew1',
    contentHint: 'Container',
  },
  {
    name: 'Events',
    url: '/events',
    stitch: true,
    stitchComponent: 'StitchEventsNew2',
    contentHint: 'Events',
  },
  {
    name: 'Reviews',
    url: '/reviews',
    stitch: true,
    stitchComponent: 'StitchReviewsNew',
    contentHint: 'Review',
  },
  {
    name: 'Referral',
    url: '/referral',
    stitch: true,
    stitchComponent: 'StitchReferralNew1',
    contentHint: 'Referral',
  },
  {
    name: 'Order Success',
    url: '/order-success',
    stitch: true,
    stitchComponent: 'StitchOrderSuccessNew',
    contentHint: 'Order',
  },
  {
    name: 'KDS',
    url: '/kds',
    stitch: true,
    stitchComponent: 'StitchKDSNew',
    contentHint: 'KDS',
  },
  {
    name: 'Account',
    url: '/account',
    stitch: true,
    stitchComponent: 'StitchAccountDashNew',
    contentHint: 'Account',
  },
  // ── Other routes (non-Stitch but uncovered) ──
  {
    name: 'Brand Guideline',
    url: '/brand',
    stitch: false,
    stitchComponent: '-',
    contentHint: 'Brand',
  },
  {
    name: 'Check-in',
    url: '/checkin',
    stitch: false,
    stitchComponent: '-',
    contentHint: 'Check-in',
  },
  {
    name: 'Subscriptions',
    url: '/subscriptions',
    stitch: false,
    stitchComponent: '-',
    contentHint: 'Subscription',
  },
  {
    name: 'Loyalty Calculator',
    url: '/loyalty-calculator',
    stitch: false,
    stitchComponent: '-',
    contentHint: 'Loyalty',
  },
  {
    name: 'Track Order',
    url: '/track-order',
    stitch: false,
    stitchComponent: '-',
    contentHint: 'Track',
  },
  {
    name: 'TV Menu',
    url: '/tv-menu',
    stitch: false,
    stitchComponent: '-',
    contentHint: 'Menu',
  },
  {
    name: 'Order Failure',
    url: '/order-failure',
    stitch: false,
    stitchComponent: '-',
    contentHint: 'Error',
  },
];

/* ─── Banned Fire/Earth hex colors ──────────────────────────────────── */

const BANNED_HEX = [
  '#FFD700', '#D4AF37', '#B8860B', '#FFE970',
  '#FF6B35', '#FF1744', '#8B4513', '#C9A200', '#C9A962',
];

/* ─── Console error noise filter ────────────────────────────────────── */

const CONSOLE_NOISE = /vite|hmr|webSocket|websocket|import\.meta|__vite|ERR_CONNECTION_REFUSED|Failed to load resource|127\.0\.0\.1:8787|access control checks|Could not connect to the server/i;

/* ═══════════════════════════════════════════════════════════════════════
   Test Suite
   ═══════════════════════════════════════════════════════════════════════ */

test.describe('AURA CAFE — New Stitch Routes E2E', () => {
  for (const p of PAGES) {
    test.describe(`${p.name} (${p.url})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(p.url);
        await page.waitForLoadState('networkidle');
      });

      /* ── Basic Load Checks ───────────────────────────────────── */

      test('loads without console errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => {
          if (!CONSOLE_NOISE.test(err.message)) errors.push(err.message);
        });
        page.on('console', (msg) => {
          if (msg.type() === 'error' && !CONSOLE_NOISE.test(msg.text())) {
            errors.push(msg.text());
          }
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
        expect(errors).toEqual([]);
      });

      test('theme tokens applied to root element', async ({ page }) => {
        const state = await page.evaluate(() => {
          const html = document.documentElement;
          return {
            bg: getComputedStyle(html).backgroundColor,
            hasCssVars:
              getComputedStyle(html).getPropertyValue('--aura-bg-page').trim().length > 0,
          };
        });
        // Dark navy theme background (#0A1A2E → rgb(10, 26, 46))
        expect(state.bg).not.toBe('rgba(0, 0, 0, 0)');
        expect(state.bg).not.toBe('transparent');
        expect(state.hasCssVars).toBe(true);
      });

      test('no banned fire/earth colors in computed styles', async ({ page }) => {
        const found = await page.evaluate((banned) => {
          const hits: string[] = [];
          document.querySelectorAll('*').forEach((el) => {
            const bg = getComputedStyle(el).backgroundColor;
            const fg = getComputedStyle(el).color;
            for (const hex of banned) {
              if (bg.includes(hex) || fg.includes(hex)) {
                hits.push(`${el.tagName}.${el.className} -> ${hex}`);
              }
            }
          });
          return [...new Set(hits)].slice(0, 10);
        }, BANNED_HEX);
        expect(found).toEqual([]);
      });

      /* ── Responsive: no horizontal overflow ──────────────────── */

      const viewports = [
        { name: 'mobile 375px', width: 375, height: 667 },
        { name: 'tablet 768px', width: 768, height: 1024 },
        { name: 'desktop 1440px', width: 1440, height: 900 },
      ];

      for (const vp of viewports) {
        test(`no horizontal overflow on ${vp.name}`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.reload();
          await page.waitForLoadState('networkidle');
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          expect(overflow).toBe(0);
        });
      }

      /* ── Content visible ─────────────────────────────────────── */

      test('page has visible content', async ({ page }) => {
        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        expect(bodyText.length).toBeGreaterThan(0);

        // Check that the main content area exists and has dimensions
        const main = page.locator('main, [role="main"]');
        if ((await main.count()) > 0) {
          const box = await main.first().boundingBox();
          if (box) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
          }
        }
      });

      test('all page images load without 404', async ({ page }) => {
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

      /* ── Stitch-specific checks ──────────────────────────────── */

      if (p.stitch) {
        test('Stitch component renders with glassmorphism theme', async ({ page }) => {
          // Verify the Stitch dark navy background is applied
          const bgColor = await page.evaluate(() => {
            const main = document.querySelector('main, [role="main"], [class*="min-h-screen"]');
            if (!main) return '';
            return getComputedStyle(main).backgroundColor;
          });
          // Dark navy #0A1A2E in RGB
          expect(bgColor).toMatch(/rgba?\(10,\s*26,\s*46/);

          // Verify Stitch CSS custom properties are resolved
          const primaryColor = await page.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue('--aura-primary')
              .trim(),
          );
          expect(primaryColor).toBeTruthy();
        });

        test('Stitch component renders interactive elements', async ({ page }) => {
          // Verify at least one interactive element (button, link) exists
          const interactiveCount = await page.locator('button, a').count();
          expect(interactiveCount).toBeGreaterThan(0);

          // Verify the elements are visible and sized
          const firstBtn = page.locator('button').first();
          if (await firstBtn.count() > 0) {
            await expect(firstBtn).toBeVisible({ timeout: 5000 });
          }
        });

        test('Stitch font families applied', async ({ page }) => {
          const fonts = await page.evaluate(() => {
            const body = document.body;
            return {
              fontFamily: getComputedStyle(body).fontFamily,
            };
          });
          expect(fonts.fontFamily.length).toBeGreaterThan(0);
        });
      }
    });
  }

  /* ── Cross-page consistency checks ───────────────────────────────── */

  test.describe('Cross-page consistency', () => {
    test('stitch-tokens.css CSS custom properties loaded on all pages', async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.url);
        await page.waitForLoadState('networkidle');
        const cssVar = await page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue('--aura-bg-page')
            .trim(),
        );
        expect(cssVar).toBeTruthy();
      }
    });

    test('viewport meta tag present on all pages', async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.url);
        const vp = page.locator('meta[name="viewport"]');
        await expect(vp).toHaveCount(1);
      }
    });

    test('html lang attribute set on all pages', async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.url);
        const lang = await page.getAttribute('html', 'lang');
        expect(lang).toBeTruthy();
      }
    });

    test('no 404s across all pages', async ({ page }) => {
      const failed: string[] = [];
      page.on('response', async (res) => {
        if (res.status() === 404) {
          const url = res.url();
          if (url.includes('127.0.0.1:8787') || url.includes('localhost:8787')) return;
          failed.push(url);
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
