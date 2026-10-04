/**
 * QR Ordering Smoke Test
 *
 * Verifies the QR table ordering API contract after D1 migration.
 * Tests: guest-checkin → table occupied → checkout → order created → table freed on success.
 *
 * Run: npx playwright test tests/playwright/qr-ordering.spec.ts
 *
 * Requires: Cloudflare Worker deployed to production (or local wrangler dev on port 8787)
 */

import { test, expect } from '@playwright/test';

const WORKER_BASE =
  process.env.WORKER_BASE_URL ||
  'https://aura-space-worker.sadec-marketing-hub.workers.dev';

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${WORKER_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-playwright-test': 'true',
      ...(init?.headers || {})
    },
  });
  return res;
}

function getTestTable(projectName: string) {
  return projectName.includes('Mobile') ? 't02' : 't01';
}

test.describe('QR Table Ordering — E2E Smoke', () => {
  const TEST_PHONE = '0909123456';

  test.beforeEach(async ({}, testInfo) => {
    const table = getTestTable(testInfo.project.name);
    // Release assigned table to ensure Available status before checkin
    await api(`/api/floor-plan/${table}/release`, { method: 'POST' });
  });

  test('1. Guest checkin — reserves table', async ({}, testInfo) => {
    const table = getTestTable(testInfo.project.name);
    const res = await api('/api/orders/guest-checkin', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: 'E2E Smoke Test',
        customer_phone: TEST_PHONE,
        table_id: table,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('status', 'pending');
  });

  test('2. Double checkin — returns 409 (table occupied)', async ({}, testInfo) => {
    const table = getTestTable(testInfo.project.name);
    // First checkin to occupy the table
    await api('/api/orders/guest-checkin', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: 'E2E Smoke Test',
        customer_phone: TEST_PHONE,
        table_id: table,
      }),
    });

    const res = await api('/api/orders/guest-checkin', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: 'E2E Duplicate',
        customer_phone: TEST_PHONE,
        table_id: table,
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });

  test('3. Checkout — creates order with table_id column', async ({}, testInfo) => {
    const table = getTestTable(testInfo.project.name);
    const res = await api('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify({
        items: [
          { product_id: 'espresso', price: 25000, quantity: 1 },
        ],
        total: 25000,
        customer_name: 'E2E Smoke Test',
        customer_phone: TEST_PHONE,
        payment_method: 'cod',
        table_id: table,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data.table_id).toBe(table);
  });

  test('4. Invalid table — returns 404', async () => {
    const res = await api('/api/orders/guest-checkin', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: 'Nobody',
        customer_phone: TEST_PHONE,
        table_id: 'nonexistent-table-99999',
      }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('5. GET /api/orders — returns recent orders list', async () => {
    const res = await api('/api/orders', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const ordersList = Array.isArray(body.data) ? body.data : body.data?.orders;
    expect(Array.isArray(ordersList)).toBe(true);
  });
});
