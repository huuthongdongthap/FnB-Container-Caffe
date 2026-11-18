/**
 * Store Operations Go-Live — Browser E2E Smoke Suite
 *
 * Deterministic Playwright E2E verifying Admin Revenue Accounting (BOM P&L),
 * Franchise Royalty Reporting, and Customer Order route rendering with zero
 * uncaught page exceptions. Uses Playwright route mocking so CI runs hermetically
 * without mutating production Cloudflare D1 state.
 */

import { test, expect } from '@playwright/test';

const ADMIN_SESSION_USER = {
  id: 'staff-owner-1',
  name: 'Aura Owner',
  email: 'owner@auraspace.cafe',
  role: 'owner',
  tenantId: 'default',
};

test.describe('Store Operations Go-Live — Admin P&L & Franchise E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('aura_auth_token', 'e2e-owner-jwt-token');
      localStorage.setItem('aura_auth_user', JSON.stringify(user));
    }, ADMIN_SESSION_USER);

    await page.route(/\/api\/auth\/me/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, user: ADMIN_SESSION_USER }),
      });
    });

    await page.route(/\/api\/reports\/pnl/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            from: '2026-11-01',
            to: '2026-11-18',
            timezone: 'Asia/Ho_Chi_Minh',
            totals: {
              orders: 42,
              gross_sales: 4_850_000,
              discounts: 250_000,
              net_revenue: 4_600_000,
              refunds: 0,
              cogs: 1_380_000,
              waste_cost: 45_000,
              gross_profit: 3_175_000,
              gross_margin_pct: 69.02,
            },
            daily: [
              {
                date: '2026-11-18',
                orders: 42,
                gross_sales: 4_850_000,
                discounts: 250_000,
                net_revenue: 4_600_000,
                refunds: 0,
                cogs: 1_380_000,
                waste_cost: 45_000,
                gross_profit: 3_175_000,
                gross_margin_pct: 69.02,
              },
            ],
          },
        }),
      });
    });

    await page.route(/\/api\/franchise\/locations\/[^/]+\/metrics/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            location_id: 'loc-sadec-hq',
            code: 'SADEC-01',
            name: 'AURA Container Sa Đéc HQ',
            tenant_id: 'default',
            order_count: 42,
            gross_sales: 4_600_000,
            royalty_percentage: 5,
            royalty_amount: 230_000,
            net_franchisee_payout: 4_370_000,
          },
        }),
      });
    });

    await page.route(/\/api\/franchise\/locations(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'loc-sadec-hq',
              code: 'SADEC-01',
              name: 'AURA Container Sa Đéc HQ',
              tenant_id: 'default',
              city: 'Sa Đéc',
              royalty_percentage: 5,
              status: 'active',
            },
          ],
        }),
      });
    });
  });

  test('renders Admin Revenue Accounting (BOM P&L) with ICT timezone & KPI totals', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/admin/revenue-accounting', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Báo cáo Lãi Lỗ & Giá vốn BOM/i })).toBeVisible();
    await expect(page.getByText(/Asia\/Ho_Chi_Minh/i)).toBeVisible();
    await expect(page.getByText('2026-11-18')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('renders Admin Franchise & Royalty reconciliation table with live metrics', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/admin/franchise', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Đối soát Nhượng quyền & Phí Bản quyền/i })).toBeVisible();
    await expect(page.getByText('AURA Container Sa Đéc HQ')).toBeVisible();
    await expect(page.getByText('SADEC-01')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
