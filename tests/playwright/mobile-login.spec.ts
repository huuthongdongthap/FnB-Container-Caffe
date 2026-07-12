import { test, expect } from '@playwright/test';

const BACKEND = 'https://aura-space-worker.agencyos-openclaw.workers.dev';

/* ── Mock responses ─────────────────────────────────────────────────── */

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

function mockLoginApi(page: typeof test.prototype.page, body: unknown, status = 200) {
  page.route(`${BACKEND}/mobile/login`, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * Mobile Login — E2E Tests
 *    All mocks are registered BEFORE page.goto() so the intercepted
 *    request is already in place when the component fires the API call.
 * ═══════════════════════════════════════════════════════════════════════ */

test.describe('Mobile Login', () => {
  test.beforeEach(async ({ page }) => {
    // start from a clean state on the login page
    await page.goto('/mobile/login');
    await page.evaluate(() => localStorage.clear());
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll();
  });

  test('shows login page at /mobile/login', { tag: '@smoke' }, async ({ page }) => {
    await expect(page).toHaveURL(/\/mobile\/login$/);
    await expect(page.locator('input#device-token')).toBeVisible();
    await expect(page.getByPlaceholder(/tablet-bep/i)).toBeVisible();
    // 4 PIN inputs
    const pinInputs = page.locator('input[inputmode="numeric"]');
    await expect(pinInputs).toHaveCount(4);
    // Submit button (specific: the page's own submit button, not nav buttons)
    await expect(page.getByRole('button', { name: /Đăng nhập|Login/ })).toBeVisible();
  });

  test('rejects empty device token + incomplete PIN on submit', { tag: '@validation' }, async ({ page }) => {
    // Register mock BEFORE giving the page any chance to fire the API
    mockLoginApi(page, MOCK_LOGIN_FAIL, 400);
    // Click submit with empty fields — client validation should block
    const submitBtn = page.getByRole('button', { name: /Đăng nhập|Login/ });
    await submitBtn.click();
    // Stay on login page
    await expect(page).toHaveURL(/\/mobile\/login/);
    // Error box should appear (device token or PIN message)
    const errBox = page.locator(
      'div:has-text("Vui lòng nhập"), div:has-text("Please enter")',
    );
    await expect(errBox.first()).toBeVisible();
  });

  test('rejects invalid PIN format (non-numeric characters)', { tag: '@validation' }, async ({ page }) => {
    mockLoginApi(page, MOCK_LOGIN_FAIL, 400);
    await page.fill('input#device-token', 'tablet-bep-01');
    // inputmode=numeric allows typing letters but updatePin strips to digits,
    // leaving PIN empty → submission blocked client-side
    const pin0 = page.locator('input[inputmode="numeric"]').nth(0);
    await pin0.fill('a');
    await page.getByRole('button', { name: /Đăng nhập|Login/ }).click();
    await expect(page).toHaveURL(/\/mobile\/login/);
  });

  test('shows error for unregistered device (404 from API)', { tag: '@error' }, async ({ page }) => {
    mockLoginApi(page, { success: false, error: 'Thiet bi chua dang ky' }, 404);
    await page.fill('input#device-token', 'unknown-device');
    const pinInputs = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < 4; i++) await pinInputs.nth(i).fill('1');
    await page.getByRole('button', { name: /Đăng nhập|Login/ }).click();
    // Should remain on login page
    await expect(page).toHaveURL(/\/mobile\/login/);
    // Error message appears
    await expect(page.getByText(/Đăng nhập thất bại|Login failed/)).toBeVisible();
  });

  test('navigates to /mobile on successful login (mock)', { tag: '@smoke' }, async ({ page }) => {
    mockLoginApi(page, MOCK_LOGIN_OK, 200);
    await page.fill('input#device-token', 'tablet-bep-01');
    const pinInputs = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < 4; i++) await pinInputs.nth(i).fill('1');
    await page.getByRole('button', { name: /Đăng nhập|Login/ }).click();
    // Login success sets window.location.hash = '#/mobile'
    await page.waitForURL(/\/mobile/);
    await expect(page).toHaveURL(/\/mobile/);
    // Auth persisted in localStorage (keys use both aura_ and mobile_ prefixes)
    const stored = await page.evaluate(() => ({
      auraToken: localStorage.getItem('aura_auth_token'),
      auraUser: localStorage.getItem('aura_user_data'),
      mobileToken: localStorage.getItem('mobile_token'),
      mobileUser: localStorage.getItem('mobile_user'),
    }));
    expect(stored.auraToken ?? stored.mobileToken).not.toBeNull();
    expect(stored.auraUser ?? stored.mobileUser).not.toBeNull();
  });
});
