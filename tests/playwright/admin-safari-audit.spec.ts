import { test, expect } from '@playwright/test';

test.describe('Admin Terminal Safari & i18n Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept all API calls
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': '*',
          },
          body: JSON.stringify({
            success: true,
            user: {
              id: 'admin-test-01',
              email: 'admin@auraspace.cafe',
              name: 'Quản lý Sa Đéc',
              role: 'owner',
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': '*',
          },
          body: JSON.stringify({ success: true, data: [], orders: [] }),
        });
      }
    });

    // Seed authenticated session in localStorage before page load
    await page.addInitScript(() => {
      localStorage.setItem('aura_auth_token', 'mock-test-bearer-token');
      localStorage.setItem(
        'aura_auth_user',
        JSON.stringify({
          id: 'admin-test-01',
          email: 'admin@auraspace.cafe',
          name: 'Quản lý Sa Đéc',
          role: 'owner',
        })
      );
    });
  });

  test('Admin Terminal displays clean Terminal ID without CSS token leak', async ({ page }) => {
    await page.goto('/admin/orders');
    // Wait for the Terminal element to render in the DOM
    const terminalEl = page.locator('text=Terminal #04').first();
    await expect(terminalEl).toBeVisible({ timeout: 15000 });

    const content = await page.content();
    // Must NOT contain the corrupted string
    expect(content).not.toContain('Terminal var(--aura-noir-void');
    // Must contain Terminal #04
    expect(content).toContain('Terminal #04');
  });

  test('Admin Terminal does not show raw untranslated terminal.* keys', async ({ page }) => {
    await page.goto('/admin/orders');
    // Wait for the Admin Shell navigation/header to be visible
    const terminalEl = page.locator('text=Terminal #04').first();
    await expect(terminalEl).toBeVisible({ timeout: 15000 });

    const content = await page.content();
    // Check critical keys from Image #2
    expect(content).not.toContain('terminal.managementTitle');
    expect(content).not.toContain('terminal.searchPlaceholder');
    expect(content).not.toContain('terminal.generateReport');
    expect(content).not.toContain('terminal.logout');
    expect(content).not.toContain('terminal.errorTitle');
    expect(content).not.toContain('terminal.retry');
  });

  test('Short admin route aliases redirect to canonical paths', async ({ page }) => {
    // /admin/menu -> /admin/manage-menu
    await page.goto('/admin/menu');
    await page.waitForURL('**/admin/manage-menu', { timeout: 15000 });
    expect(page.url()).toContain('/admin/manage-menu');

    // /admin/tables -> /admin/table-management
    await page.goto('/admin/tables');
    await page.waitForURL('**/admin/table-management', { timeout: 15000 });
    expect(page.url()).toContain('/admin/table-management');

    // /admin/analytics -> /admin/metrics
    await page.goto('/admin/analytics');
    await page.waitForURL('**/admin/metrics', { timeout: 15000 });
    expect(page.url()).toContain('/admin/metrics');

    // /admin/finance -> /admin/sales-reports
    await page.goto('/admin/finance');
    await page.waitForURL('**/admin/sales-reports', { timeout: 15000 });
    expect(page.url()).toContain('/admin/sales-reports');

    // /admin/marketing -> /admin/campaigns
    await page.goto('/admin/marketing');
    await page.waitForURL('**/admin/campaigns', { timeout: 15000 });
    expect(page.url()).toContain('/admin/campaigns');

    // /admin/qr -> /admin/generate-qr
    await page.goto('/admin/qr');
    await page.waitForURL('**/admin/generate-qr', { timeout: 15000 });
    expect(page.url()).toContain('/admin/generate-qr');

    // /admin/settings -> /admin/notification-settings
    await page.goto('/admin/settings');
    await page.waitForURL('**/admin/notification-settings', { timeout: 15000 });
    expect(page.url()).toContain('/admin/notification-settings');
  });
});
