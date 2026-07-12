import { test, expect } from '@playwright/test';

const BACKEND = 'https://aura-space-worker.agencyos-openclaw.workers.dev';

const MOCK_LOGIN_OK = {
  success: true,
  token: 'test-mobile-jwt',
  user: { id: 'staff-001', name: 'Test Staff', role: 'waiter', device_id: 'dev-001' },
  expires_in: 86400,
};

const MOCK_LOGIN_FAIL = {
  success: false,
  error: 'Đăng nhập thất bại — kiểm tra mã PIN',
};

function mockLogin(page: typeof test.prototype.page, body: unknown, status = 200) {
  page.route(`${BACKEND}/mobile/login`, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

test.describe('Mobile Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mobile/login');
  });

  test('shows login page at /mobile/login', { tag: '@smoke' }, async ({ page }) => {
    await expect(page).toHaveURL(/\/mobile\/login$/);
    await expect(page.locator('input#device-token')).toBeVisible();
    await expect(page.getByPlaceholder(/tablet-bep/i)).toBeVisible();
  });

  test('rejects empty device token on submit', { tag: '@validation' }, async ({ page }) => {
    mockLogin(page, MOCK_LOGIN_FAIL, 400);
    await page.click('button:has-text("Đăng nhập")');
    const body = await page.content();
    expect(body).toContain('Vui lòng nhập mã thiết bị');
  });

  test('rejects invalid PIN format (non-numeric characters)', { tag: '@validation' }, async ({ page }) => {
    mockLogin(page, MOCK_LOGIN_FAIL, 400);
    await page.fill('input#device-token', 'tablet-bep-01');
    const pinInputs = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < 4; i++) await pinInputs.nth(i).fill('');
    await page.click('button:has-text("Đăng nhập")');
    const body = await page.content();
    expect(body).toContain('Vui lòng nhập đủ 4 chữ số');
  });

  test('shows error for unregistered device (404 from API)', { tag: '@error' }, async ({ page }) => {
    mockLogin(page, { success: false, error: 'Thiet bi chua dang ky' }, 404);
    await page.fill('input#device-token', 'nonexistent-device');
    const pinInputs = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < 4; i++) await pinInputs.nth(i).fill('1');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page).toHaveURL(/\/mobile\/login$/);
    const body = await page.content();
    expect(body).toContain('Đăng nhập thất bại');
  });

  test('navigates to /mobile on successful login (mock)', { tag: '@smoke' }, async ({ page }) => {
    mockLogin(page, MOCK_LOGIN_OK, 200);
    await page.fill('input#device-token', 'tablet-bep-01');
    const pinInputs = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < 4; i++) await pinInputs.nth(i).fill('1');
    await page.click('button:has-text("Đăng nhập")');
    await page.waitForURL(/\/mobile/);
    await expect(page).toHaveURL(/\/mobile/);
  });
});
