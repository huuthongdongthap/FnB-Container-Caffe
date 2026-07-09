import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KVNamespace } from '@cloudflare/workers-types';
import { ErpnextProductClient, createErpnextProductClient, createErpnextProductClientWithKv } from '../../clients/erpnext-product-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENV = {
  ERPNEXT_URL: 'https://erp.example.com',
  ERPNEXT_API_KEY: 'k',
  ERPNEXT_API_SECRET: 's',
  ERPNEXT_SYNC_ENABLED: 'true'
};

function makeKv(entries: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    get: vi.fn(async(key: string) => entries[key] ?? null),
    put: vi.fn(async() => {}),
    delete: vi.fn(async() => {})
  };
}

function makeErpnext(methods: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    create: vi.fn(),
    read: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    getProductAvailability: vi.fn(),
    searchModified: vi.fn(),
    ...methods
  };
}

function buildProduct(kv: Record<string, unknown>, erpnext: Record<string, unknown>): ErpnextProductClient {
  return new ErpnextProductClient(erpnext as unknown as import('../../clients/erpnext-client').ErpnextClient, {
    AURA_KV: kv as unknown as KVNamespace
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe('createErpnextProductClient', () => {
  it('returns null when URL missing', () => {
    expect(createErpnextProductClient({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getProductAvailability — cache + stock aggregation
// ---------------------------------------------------------------------------

describe('getProductAvailability', () => {
  it('returns cached value when KV has entry', async() => {
    const kv = makeKv({ 'erpnext:product:availability:ITM-1': { available: true, stock: 50 } });
    const client = buildProduct(kv, makeErpnext());
    const result = await (client as unknown as { getProductAvailability: (code: string) => Promise<{ available: boolean; stock: number; cachedAt?: string }> }).getProductAvailability('ITM-1');
    expect(result.available).toBe(true);
    expect(result.stock).toBe(50);
    expect(result.cachedAt).toBeDefined();
    // Should NOT call ERPNext when cache hit
    expect((kv.get as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches from ERPNext and caches on miss', async() => {
    const kv = makeKv({});
    const erpnext = makeErpnext({
      getProductAvailability: vi.fn().mockResolvedValue({
        stock: [{ actual_qty: 10 }, { actual_qty: 25 }]
      })
    });
    const client = buildProduct(kv, erpnext);
    const result = await (client as unknown as { getProductAvailability: (code: string) => Promise<{ available: boolean; stock: number }> }).getProductAvailability('ITM-1');
    expect(result.stock).toBe(35); // 10 + 25
    expect(result.available).toBe(true);
    expect(kv.put).toHaveBeenCalled();
  });

  it('returns not available when stock is zero', async() => {
    const kv = makeKv({});
    const erpnext = makeErpnext({
      getProductAvailability: vi.fn().mockResolvedValue({ stock: [] })
    });
    const client = buildProduct(kv, erpnext);
    const result = await (client as unknown as { getProductAvailability: (code: string) => Promise<{ available: boolean; stock: number }> }).getProductAvailability('ITM-1');
    expect(result.available).toBe(false);
    expect(result.stock).toBe(0);
  });

  it('handles string qty values via Number() coercion', async() => {
    const kv = makeKv({});
    const erpnext = makeErpnext({
      getProductAvailability: vi.fn().mockResolvedValue({
        stock: [{ actual_qty: '15.5' }]
      })
    });
    const client = buildProduct(kv, erpnext);
    const result = await (client as unknown as { getProductAvailability: (code: string) => Promise<{ stock: number }> }).getProductAvailability('ITM-1');
    expect(result.stock).toBe(15.5);
  });

  it('throws when itemCode is empty', async() => {
    const client = new ErpnextProductClient(makeErpnext() as unknown as import('../../clients/erpnext-client').ErpnextClient);
    await expect(
      (client as unknown as { getProductAvailability: (code: string) => Promise<never> }).getProductAvailability('')
    ).rejects.toThrow('itemCode is required');
  });
});

// ---------------------------------------------------------------------------
// searchChangedProducts
// ---------------------------------------------------------------------------

describe('searchChangedProducts', () => {
  it('delegates to searchModified and maps fields', async() => {
    const searchSpy = vi.fn().mockResolvedValue({
      data: [
        { name: 'ITM-1', item_code: 'ITM-1', item_name: 'Coffee', modified: '2026-07-08 12:00:00' },
        { name: 'ITM-2', item_code: '', item_name: 'Tea', modified: null }
      ]
    });
    const client = buildProduct(makeKv({}), makeErpnext({ searchModified: searchSpy }));
    const result = await (client as unknown as { searchChangedProducts: (since: Date | string) => Promise<{ name: string; item_code: string; item_name: string; modified: string | null }[]> }).searchChangedProducts('2026-07-01');
    expect(result).toHaveLength(2);
    expect(result[0].item_code).toBe('ITM-1');
    expect(result[1].item_code).toBe('ITM-2'); // falls back to name
    expect(result[1].modified).toBeNull();
  });

  it('passes ISO timestamp string to searchModified', async() => {
    const searchSpy = vi.fn().mockResolvedValue({ data: [] });
    const client = buildProduct(makeKv({}), makeErpnext({ searchModified: searchSpy }));
    await (client as unknown as { searchChangedProducts: (since: Date | string) => Promise<never> }).searchChangedProducts('2026-07-01T00:00:00Z');
    const callArgs = searchSpy.mock.calls[0];
    // searchModified(doctype, since, fields) — since is the second arg (idx 1)
    const [, since] = callArgs as [string, string, unknown];
    expect(typeof since).toBe('string');
    expect(since).toContain('2026-07-01');
  });
});

// ---------------------------------------------------------------------------
// syncProductsToLocal — ON CONFLICT DO UPDATE
// ---------------------------------------------------------------------------

describe('syncProductsToLocal', () => {
  it('inserts products with UPSERT SQL', async() => {
    const runSpy = vi.fn().mockResolvedValue({ success: true });
    const db = {
      prepare: () => ({ bind: () => ({ run: runSpy }) })
    };
    const client = new ErpnextProductClient(makeErpnext() as unknown as import('../../clients/erpnext-client').ErpnextClient);
    const result = await (client as unknown as { syncProductsToLocal: (env: { AURA_DB: unknown }, products: unknown[]) => Promise<{ updated: number; errors: unknown[] }> }).syncProductsToLocal(
      { AURA_DB: db },
      [{ item_code: 'ITM-1', name: 'ITM-1', modified: '2026-07-08' }]
    );
    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(0);
    // Should include ON CONFLICT DO UPDATE
    expect(runSpy).toHaveBeenCalled();
  });

  it('returns empty when no products', async() => {
    const client = new ErpnextProductClient(makeErpnext() as unknown as import('../../clients/erpnext-client').ErpnextClient);
    const result = await (client as unknown as { syncProductsToLocal: (env: unknown, products: unknown[]) => Promise<{ updated: number }> }).syncProductsToLocal(
      { AURA_DB: {} },
      []
    );
    expect(result.updated).toBe(0);
  });

  it('skips products with empty item_code and name and reports error', async() => {
    const runSpy = vi.fn();
    const db = { prepare: () => ({ bind: () => ({ run: runSpy }) }) };
    const client = new ErpnextProductClient(makeErpnext() as unknown as import('../../clients/erpnext-client').ErpnextClient);
    const result = await (client as unknown as { syncProductsToLocal: (env: { AURA_DB: unknown }, products: { name?: string; item_code?: string }[]) => Promise<{ updated: number; errors: { productId: string; error: string }[] }> }).syncProductsToLocal(
      { AURA_DB: db },
      [{ name: '', item_code: '' }]
    );
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Missing item_code');
  });

  it('throws when AURA_DB not configured', async() => {
    const client = new ErpnextProductClient(makeErpnext() as unknown as import('../../clients/erpnext-client').ErpnextClient);
    await expect(
      (client as unknown as { syncProductsToLocal: (env: {}, products: unknown[]) => Promise<never> }).syncProductsToLocal({}, [{ item_code: 'X' }])
    ).rejects.toThrow('AURA_DB not configured');
  });
});

// ---------------------------------------------------------------------------
// updateProduct — field whitelist
// ---------------------------------------------------------------------------

describe('updateProduct', () => {
  it('sends only whitelisted fields to ERPNext', async() => {
    const updateSpy = vi.fn().mockResolvedValue({ data: {} });
    const client = new ErpnextProductClient(makeErpnext({ update: updateSpy }) as unknown as import('../../clients/erpnext-client').ErpnextClient);
    await (client as unknown as { updateProduct: (code: string, d: Record<string, unknown>) => Promise<boolean> }).updateProduct('ITM-1', {
      item_name: 'New Name',
      standard_rate: 5000,
      custom_aura_price: 4500,
      blocked_field: 'nope'
    });
    expect(updateSpy).toHaveBeenCalledWith('Item', 'ITM-1', {
      item_name: 'New Name',
      standard_rate: 5000,
      custom_aura_price: 4500
    });
  });

  it('throws when no valid fields after filtering', async() => {
    const updateSpy = vi.fn();
    const client = new ErpnextProductClient(makeErpnext({ update: updateSpy }) as unknown as import('../../clients/erpnext-client').ErpnextClient);
    await expect(
      (client as unknown as { updateProduct: (code: string, d: Record<string, unknown>) => Promise<boolean> }).updateProduct('ITM-1', { bad: 1 })
    ).rejects.toThrow('no valid fields');
  });

  it('invalidates KV cache on successful update', async() => {
    const kv = makeKv({});
    const updateSpy = vi.fn().mockResolvedValue({});
    const client = new ErpnextProductClient(
      makeErpnext({ update: updateSpy }) as unknown as import('../../clients/erpnext-client').ErpnextClient,
      { AURA_KV: kv as unknown as KVNamespace }
    );
    await (client as unknown as { updateProduct: (code: string, d: Record<string, unknown>) => Promise<boolean> }).updateProduct('ITM-1', { item_name: 'X' });
    expect(kv.delete).toHaveBeenCalledWith('erpnext:product:availability:ITM-1');
  });
});
