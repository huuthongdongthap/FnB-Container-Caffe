import { test, expect } from '@playwright/test';

const BACKEND = 'https://aura-space-worker.agencyos-openclaw.workers.dev';

/* ── Mock data ──────────────────────────────────────────────────────── */

const MOCK_KDS_USER = {
  id: 'staff-kds', name: 'Bep Test', role: 'kitchen', device_id: 'dev-kds',
};

const MOCK_WAITER_USER = {
  id: 'staff-waiter', name: 'Phuc vu Test', role: 'waiter', device_id: 'dev-waiter',
};

const MOCK_ORDERS_EMPTY = { success: true as const, orders: [] };

const MOCK_ORDERS_FULL = {
  success: true as const,
  orders: [
    {
      id: 'ord-kds-001',
      table_name: 'B01',
      status: 'pending',
      created_at: new Date(Date.now() - 120000).toISOString(),
      items: [
        { name: 'Ca phe sua', quantity: 2, modifiers: ['Nong'], notes: '' },
        { name: 'Banh mi', quantity: 1, modifiers: [], notes: 'It duong' },
      ],
    },
    {
      id: 'ord-kds-002',
      table_name: 'B03',
      status: 'preparing',
      created_at: new Date(Date.now() - 300000).toISOString(),
      items: [{ name: 'Tra dao', quantity: 1, modifiers: [], notes: '' }],
    },
  ],
};

/* ── Helpers ────────────────────────────────────────────────────────── */

/** Seed both localStorage namespaces used by the app (aura_ and mobile_ prefixes). */
function seedAuth(
  page: typeof test.prototype.page,
  user: Record<string, unknown>,
) {
  const state = {
    aura_auth_token: 'mock-jwt-token',
    aura_user_data: JSON.stringify(user),
    aura_device_token: String(user.device_id),
    mobile_token: 'mock-jwt-token',
    mobile_user: JSON.stringify(user),
    mobile_device: String(user.device_id),
  };
  return page.evaluate((s) => {
    Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v));
  }, state);
}

function mockKDS(
  page: typeof test.prototype.page,
  data: unknown,
  status = 200,
) {
  page.route(`${BACKEND}/mobile/kds/orders`, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    }),
  );
}

/**
 * Full login flow:
 * 1. Register login mock
 * 2. Navigate to /mobile/login
 * 3. Clear stale storage, then seed auth directly
 * 4. Navigate to /mobile — auth is already in place, no login click needed
 *
 * Why seed auth directly instead of going through the login form:
 * - Avoids depending on login api response storage keys (aura_ vs mobile_ mismatch)
 * - Tests focus on the /mobile shell, not the login form
 */
async function loginAs(
  page: typeof test.prototype.page,
  user: Record<string, unknown>,
) {
  // Register KDS mock before any navigation
  mockKDS(page, MOCK_ORDERS_EMPTY);

  // Start from login page (clean browser state)
  await page.goto('/mobile/login');
  await page.evaluate(() => localStorage.clear());

  // Seed auth directly — bypasses the login form's key mismatch
  await seedAuth(page, user);

  // Navigate to the mobile shell
  await page.goto('/mobile');
  // Wait for first KDS fetch + render
  await page.waitForTimeout(1200);
}

/* ═══════════════════════════════════════════════════════════════════════
 * Mobile KDS (Kitchen Display System) — E2E Tests
 * ═══════════════════════════════════════════════════════════════════════ */

test.describe('Mobile KDS', () => {
  test('shows KDS shell at /mobile when authenticated — kitchen role', { tag: '@smoke' }, async ({ page }) => {
    await loginAs(page, MOCK_KDS_USER);
    // Kitchen defaults to KDS tab — heading renders "KDS / Bếp"
    await expect(page.getByText(/KDS/)).toBeVisible();
    // Brand "AURA Mobile" in the shell top bar
    await expect(page.getByText('AURA Mobile')).toBeVisible();
  });

  test('displays empty state when no pending orders', { tag: '@empty' }, async ({ page }) => {
    await loginAs(page, MOCK_KDS_USER);
    mockKDS(page, MOCK_ORDERS_EMPTY);
    await page.reload();
    await page.waitForTimeout(1500);
    // Empty state text (VI + EN rendered together)
    await expect(page.getByText('Không có đơn')).toBeVisible();
  });

  test('shows error state when API fails', { tag: '@error' }, async ({ page }) => {
    await loginAs(page, MOCK_KDS_USER);
    mockKDS(page, { success: false, error: 'Server error' }, 500);
    await page.reload();
    await page.waitForTimeout(1500);
    // Error banner text
    await expect(page.getByText(/Không thể tải đơn hàng|Failed to load orders/)).toBeVisible();
    // Retry button
    await expect(page.getByRole('button', { name: /Thử lại|Retry/ })).toBeVisible();
  });

  test('refreshes orders on manual retry after error', { tag: '@error' }, async ({ page }) => {
    await loginAs(page, MOCK_KDS_USER);
    // First poll → fail
    mockKDS(page, { success: false }, 500);
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Failed to load orders/)).toBeVisible();
    // Swap to success mock, click retry
    mockKDS(page, MOCK_ORDERS_FULL);
    await page.getByRole('button', { name: /Thử lại|Retry/ }).click();
    await page.waitForTimeout(600);
    // Order data should now be visible on screen
    await expect(page.getByText(/Ca phe sua/)).toBeVisible();
  });

  test('role-based: waiter cannot access KDS tab', { tag: '@rbac' }, async ({ page }) => {
    await loginAs(page, MOCK_WAITER_USER);
    // Waiter's default tab is "orders" — KDS heading should NOT appear
    await expect(page.getByRole('heading', { name: /KDS|KDS \/ Bếp/ })).not.toBeVisible();
    // Waiter page shows orders overview (specific h1 heading)
    await expect(page.getByRole('heading', { name: /Đơn hàng|Orders/ })).toBeVisible();
  });
});
