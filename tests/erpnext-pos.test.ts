/**
 * ERPNext POS Routes Tests — handleErpnextPosRequest
 *
 * Tests for sales order creation, product availability, delta sync, webhooks.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock erpnext-client ──────────────────────────────────────────────────
const mockErpnextClient = {
  create: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../worker/src/clients/erpnext-client', () => ({
  createErpnextClient: vi.fn(() => mockErpnextClient),
  ErpnextClient: class {},
  ErpnextError: class extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s; } },
  ErpnextApiResponse: class {},
}));

// ── Mock erpnext-product-client ──────────────────────────────────────────
const mockProductClient = {
  getProductAvailability: vi.fn(),
  searchChangedProducts: vi.fn(),
  syncProductsToLocal: vi.fn(),
};

vi.mock('../worker/src/clients/erpnext-product-client', () => ({
  createErpnextProductClient: vi.fn(() => mockProductClient),
}));

let handleErpnextPosRequest: any;

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountHandler() {
  const mod = await import('../worker/src/routes/erpnext-pos');
  handleErpnextPosRequest = mod.handleErpnextPosRequest;
}

const configuredEnv = { ERPNEXT_URL: 'https://erp.test', ERPNEXT_API_KEY: 'key', ERPNEXT_API_SECRET: 'secret' };

describe('POST /sales-order', () => {
  test('creates sales order successfully', async () => {
    mockErpnextClient.create.mockResolvedValue({ data: { name: 'SAL-001' } });
    await mountHandler();

    const req = new Request('https://test/api/erpnext-pos/sales-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Test Customer',
        items: [{ item_code: 'COFFEE', qty: 2, rate: 25000 }],
      }),
    });
    const res = await handleErpnextPosRequest(req, configuredEnv);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('SAL-001');
    expect(mockErpnextClient.create).toHaveBeenCalledTimes(1);
  });

  test('returns 400 when sales order schema invalid', async () => {
    await mountHandler();

    const req = new Request('https://test/api/erpnext-pos/sales-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Test' }), // missing items
    });
    const res = await handleErpnextPosRequest(req, configuredEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('returns 503 when ERPNext not configured', async () => {
    const clientMod = await import('../worker/src/clients/erpnext-client');
    (clientMod.createErpnextClient as any).mockReturnValueOnce(null);
    await mountHandler();

    const req = new Request('https://test/api/erpnext-pos/sales-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });
    const res = await handleErpnextPosRequest(req, {});

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });
});

describe('GET /products/:code/availability', () => {
  test('returns product availability', async () => {
    mockProductClient.getProductAvailability.mockResolvedValue({
      available: true,
      stock: 42,
      estimatedRestock: null,
    });
    await mountHandler();

    const req = new Request('https://test/api/erpnext-pos/products/COFFEE/availability', { method: 'GET' });
    const res = await handleErpnextPosRequest(req, configuredEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.available).toBe(true);
    expect(body.data.stock).toBe(42);
  });

  test('returns 503 when product client not configured', async () => {
    const prodMod = await import('../worker/src/clients/erpnext-product-client');
    (prodMod.createErpnextProductClient as any).mockReturnValueOnce(null);
    await mountHandler();

    const req = new Request('https://test/api/erpnext-pos/products/COFFEE/availability', { method: 'GET' });
    const res = await handleErpnextPosRequest(req, {});

    expect(res.status).toBe(503);
  });
});

describe('GET /products/changed', () => {
  test('returns changed products since timestamp', async () => {
    mockProductClient.searchChangedProducts.mockResolvedValue([
      { name: 'COFFEE', modified: '2025-06-01T00:00:00Z' },
    ]);
    await mountHandler();

    const req = new Request('https://test/api/erpnext-pos/products/changed?since=2025-06-01T00:00:00Z', { method: 'GET' });
    const res = await handleErpnextPosRequest(req, configuredEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(mockProductClient.searchChangedProducts).toHaveBeenCalledWith('2025-06-01T00:00:00Z');
  });
});

describe('POST /products/sync', () => {
  test('syncs products to local database', async () => {
    mockProductClient.syncProductsToLocal.mockResolvedValue({ synced: 2, failed: 0 });
    await mountHandler();

    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ run: vi.fn(async () => ({ success: true })) })),
      })),
    };
    const env = { ...configuredEnv, AURA_DB: db };

    const req = new Request('https://test/api/erpnext-pos/products/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: [
          { name: 'COFFEE', item_code: 'COFFEE', item_name: 'Coffee', modified: null },
          { name: 'TEA', item_code: 'TEA', item_name: 'Tea', modified: null },
        ],
      }),
    });
    const res = await handleErpnextPosRequest(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.synced).toBe(2);
  });
});

describe('POST /webhook', () => {
  test('receives and stores ERPNext webhook', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ run: vi.fn(async () => ({ success: true })) })),
      })),
    };
    await mountHandler();

    const req = new Request('https://test/api/erpnext-pos/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctype: 'Sales Order',
        docname: 'SAL-001',
        action: 'submit',
      }),
    });
    const res = await handleErpnextPosRequest(req, { ...configuredEnv, AURA_DB: db });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/webhook received/i);
    expect(db.prepare).toHaveBeenCalled();
  });

  test('returns 400 for invalid webhook payload', async () => {
    await mountHandler();
    const req = new Request('https://test/api/erpnext-pos/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctype: 123 }), // number where string expected
    });
    const res = await handleErpnextPosRequest(req, configuredEnv);
    expect(res.status).toBe(400);
  });
});

describe('404', () => {
  test('returns 404 for unknown route', async () => {
    await mountHandler();
    const req = new Request('https://test/api/erpnext-pos/unknown', { method: 'GET' });
    const res = await handleErpnextPosRequest(req, configuredEnv);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
