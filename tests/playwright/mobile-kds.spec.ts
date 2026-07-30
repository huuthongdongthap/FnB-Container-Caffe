import { test, expect } from '@playwright/test';

const BACKEND = 'https://aura-space-worker.agencyos-openclaw.workers.dev';

const MOCK_KDS_USER = { id: 'staff-kds', name: 'Bep Test', role: 'kitchen', device_id: 'dev-kds' };
const MOCK_WAITER_USER = { id: 'staff-waiter', name: 'Phuc vu Test', role: 'waiter', device_id: 'dev-waiter' };

const MOCK_KDS_EMPTY = { success: true, orders: [] };

const MOCK_KDS_WITH_ORDERS = {
  success: true,
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
      items: [
        { name: 'Tra dao', quantity: 1, modifiers: [], notes: '' },
      ],
    },
  ],
};

function mockLogin(page: typeof test.prototype.page, user: Record<string, unknown>) {
  page.route(`${BACKEND}/mobile/login`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, token: 'test-jwt-token', user, expires_in: 86400 }),
    }),
  );
}

function mockKDS(page: typeof test.prototype.page, data: unknown, status = 200) {
  page.route(`${BACKEND}/mobile/kds/orders`, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) }),
  );
}

async function loginAs(page: typeof test.prototype.page, user: Record<string, unknown>) {
  mockLogin(page, user);
  await page.goto('/mobile/login');
  const pinInputs = page.locator('input[inputmode="numeric"]');
  await page.fill('input#device-token', 'tablet-bep-01');
  for (let i = 0; i < 4; i++) await pinInputs.nth(i).fill('1');
  await page.click('button:has-text("Đăng nhập")');
  await page.waitForURL(/\/mobile/);
}

test.describe('Mobile KDS', () => {
  test('shows KDS shell at /mobile when authenticated - kitchen role', { tag: '@smoke' }, async ({ page }) => {
    await loginAs(page, MOCK_KDS_USER);
    mockKDS(page, MOCK_KDS_EMPTY);
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.getByRole('heading', { name: /KDS/ })).toBeVisible();
  });

  test('displays empty state when no pending orders', { tag: '@empty' }, async ({ page }) => {
    await loginAs(page, MOCK_KDS_USER);
    mockKDS(page, MOCK_KDS_EMPTY);
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.getByText('Không có đơn')).toBeVisible();
  });

  test('shows error state when API fails', { tag: '@error' }, async ({ page }) => {
    await loginAs(page, MOCK_KDS_USER);
    mockKDS(page, { success: false }, 500);
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.getByText(/Không thể tải đơn hàng|Failed to load orders/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Thử lại|Retry/ })).toBeVisible();
  });

  test('refreshes orders on manual retry after error', { tag: '@error' }, async ({ page }) => {
    await loginAs(page, MOCK_KDS_USER);
    mockKDS(page, { success: false }, 500);
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.getByText(/Failed to load orders/)).toBeVisible();
    mockKDS(page, MOCK_KDS_WITH_ORDERS);
    await page.getByRole('button', { name: /Thử lại|Retry/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Ca phe sua/)).toBeVisible();
  });

  test('role-based: waiter cannot access KDS tab', { tag: '@rbac' }, async ({ page }) => {
    await loginAs(page, MOCK_WAITER_USER);
    await expect(page.getByRole('heading', { name: /KDS/ })).not.toBeVisible();
    await expect(page.getByText(/Đơn|Orders/)).toBeVisible();
    const kdsTab = page.locator('button:has-text("KDS")');
    await expect(kdsTab).not.toBeVisible();
  });
});
