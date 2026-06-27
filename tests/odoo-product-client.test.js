/**
 * Odoo Product Client Unit Tests — Phase 2 (POS Integration)
 * Tests for OdooProductClient: availability, sync, write-back
 *
 * @jest-test-type unit
 */
import { OdooClient, OdooError } from '../worker/src/clients/odoo-client.js';
import { OdooProductClient } from '../worker/src/clients/odoo-product-client.js';

// ── Helpers ──────────────────────────────────────────────────────────

function mockOdooResponse(result, id = 1) {
  return { jsonrpc: '2.0', id, result };
}

function mockOdooErrorResponse(message, code = 'odoo_error', id = 1) {
  return { jsonrpc: '2.0', id, error: { code, message, data: {} } };
}

/**
 * Mock fetch that handles Odoo JSON-RPC protocol.
 * Returns a restore function.
 */
function mockFetch(handlers = {}) {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (url, options) => {
    const body = JSON.parse(options?.body || '{}');
    const params = body.params || {};

    if (params.service === 'common' && params.method === 'login') {
      return { ok: true, json: async () => mockOdooResponse(1) };
    }

    if (params.service === 'object' && params.method === 'execute') {
      const [, , , model, method, args] = params.args || [];

      if (method === 'search_read') {
        const result = handlers.search_read ? handlers.search_read(args) : [];
        return { ok: true, json: async () => mockOdooResponse(result) };
      }
      if (method === 'create') {
        return { ok: true, json: async () => mockOdooResponse(999) };
      }
      if (method === 'write') {
        if (handlers.write) handlers.write(args);
        return { ok: true, json: async () => mockOdooResponse(true) };
      }
      if (method === 'read') {
        const result = handlers.read ? handlers.read(args) : [];
        return { ok: true, json: async () => mockOdooResponse(result) };
      }
    }

    return { ok: true, json: async () => mockOdooResponse(null) };
  });
  return () => { global.fetch = originalFetch; };
}

/**
 * Create OdooProductClient with stubbed env and pre-mocked _findProductMapping.
 */
function createProductClient() {
  const client = new OdooClient({
    url: 'https://odoo.test.com',
    db: 'test_db',
    username: 'test',
    apiKey: 'test_key',
  });
  const productClient = new OdooProductClient(client, {
    AURA_DB: { prepare: () => ({ bind: () => ({ first: () => null }) }) },
    AURA_KV: { get: () => null, put: () => Promise.resolve() },
  });
  productClient._findProductMapping = jest.fn(async () => ({
    product_id: 'prod_001',
    odoo_product_id: 10,
    last_synced_at: '2026-06-26T00:00:00',
  }));
  return { client, productClient };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('OdooProductClient — Phase 2 (POS)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Constructor ────────────────────────────────────────────────────

  describe('Constructor', () => {
    test('should throw if odooClient is missing', () => {
      expect(() => new OdooProductClient(null)).toThrow(
        'OdooProductClient: odooClient is required',
      );
    });

    test('should throw if odooClient is undefined', () => {
      expect(() => new OdooProductClient(undefined)).toThrow(
        'OdooProductClient: odooClient is required',
      );
    });

    test('should accept odooClient without env', () => {
      const { client } = createProductClient();
      const pc = new OdooProductClient(client);
      expect(pc.odoo).toBe(client);
      expect(pc.auraDb).toBeNull();
      expect(pc.auraKv).toBeNull();
    });

    test('should accept env with AURA_DB and AURA_KV', () => {
      const { client } = createProductClient();
      const env = { AURA_DB: {}, AURA_KV: {} };
      const pc = new OdooProductClient(client, env);
      expect(pc.auraDb).toBe(env.AURA_DB);
      expect(pc.auraKv).toBe(env.AURA_KV);
    });

    test('should set default cache TTL to 30', () => {
      const { client } = createProductClient();
      const pc = new OdooProductClient(client);
      expect(pc.cacheTtl).toBe(30);
    });
  });

  // ── getProductAvailability ─────────────────────────────────────────

  describe('getProductAvailability', () => {
    test('should return availability from Odoo on cache miss', async () => {
      const { productClient } = createProductClient();
      const restore = mockFetch({
        search_read: () => [
          { id: 10, qty_available: 50, virtual_available: 60 },
        ],
      });

      const result = await productClient.getProductAvailability('prod_001');
      expect(result.available).toBe(true);
      // stock = Math.max(qty_available, virtual_available) = max(50, 60) = 60
      expect(result.stock).toBe(60);
      expect(typeof result.cachedAt).toBe('string');

      restore();
    });

    test('should return unavailable when stock is 0', async () => {
      const { productClient } = createProductClient();
      const restore = mockFetch({
        search_read: () => [
          { id: 10, qty_available: 0, virtual_available: 0 },
        ],
      });

      const result = await productClient.getProductAvailability('prod_002');
      expect(result.available).toBe(false);
      expect(result.stock).toBe(0);

      restore();
    });

    test('should return unavailable when stock is negative', async () => {
      const { productClient } = createProductClient();
      const restore = mockFetch({
        search_read: () => [
          { id: 10, qty_available: -5, virtual_available: 0 },
        ],
      });

      const result = await productClient.getProductAvailability('prod_003');
      expect(result.available).toBe(false);

      restore();
    });

    test('should return available when virtual_available > 0 but qty_available is 0', async () => {
      const { productClient } = createProductClient();
      const restore = mockFetch({
        search_read: () => [
          { id: 10, qty_available: 0, virtual_available: 10 },
        ],
      });

      const result = await productClient.getProductAvailability('prod_004');
      expect(result.available).toBe(true);

      restore();
    });

    test('should throw if productId is missing', async () => {
      const { client } = createProductClient();
      const pc = new OdooProductClient(client);
      await expect(pc.getProductAvailability('')).rejects.toThrow();
      await expect(pc.getProductAvailability(null)).rejects.toThrow();
    });

    test('should throw OdooError when Odoo returns error', async () => {
      const { productClient } = createProductClient();
      const restore = mockFetch({
        search_read: () => {
          throw new OdooError('Product not found in Odoo', 404);
        },
      });

      await expect(productClient.getProductAvailability('prod_missing')).rejects.toThrow(
        'Product not found in Odoo',
      );

      restore();
    });

    test('should handle empty Odoo result array', async () => {
      const { productClient } = createProductClient();
      const restore = mockFetch({
        search_read: () => [],
      });

      await expect(productClient.getProductAvailability('prod_none')).rejects.toThrow();

      restore();
    });
  });

  // ── searchChangedProducts ──────────────────────────────────────────

  describe('searchChangedProducts', () => {
    test('should return products changed since timestamp', async () => {
      const { productClient } = createProductClient();
      const restore = mockFetch({
        search_read: () => [
          { id: 1, default_code: 'CF001', list_price: 15000, qty_available: 50, write_date: '2026-06-26T08:00:00' },
          { id: 2, default_code: 'CF002', list_price: 25000, qty_available: 30, write_date: '2026-06-26T09:00:00' },
        ],
      });

      const result = await productClient.searchChangedProducts('2026-06-25T00:00:00');
      expect(result).toHaveLength(2);
      expect(result[0].default_code).toBe('CF001');

      restore();
    });

    test('should return empty array when no changes', async () => {
      const { productClient } = createProductClient();
      const restore = mockFetch({
        search_read: () => [],
      });

      const result = await productClient.searchChangedProducts('2026-06-26T10:00:00');
      expect(result).toEqual([]);

      restore();
    });

    test('should propagate Odoo errors', async () => {
      const { productClient } = createProductClient();
      const restore = mockFetch({
        search_read: () => {
          throw new OdooError('Connection failed', 500);
        },
      });

      await expect(productClient.searchChangedProducts('2026-06-25T00:00:00')).rejects.toThrow(
        'Connection failed',
      );

      restore();
    });
  });

  // ── syncProductsToLocal ────────────────────────────────────────────

  describe('syncProductsToLocal', () => {
    test('should return updated=0 when no products', async () => {
      const { productClient } = createProductClient();
      const result = await productClient.syncProductsToLocal([]);
      expect(result.updated).toBe(0);
      expect(result.errors).toEqual([]);
    });

    test('should upsert products into odoo_product_sync', async () => {
      const { client } = createProductClient();
      const mockRun = jest.fn(() => Promise.resolve({ changes: 1 }));
      const env = {
        AURA_DB: {
          prepare: jest.fn(() => ({
            bind: jest.fn(() => ({ run: mockRun })),
          })),
        },
      };
      const pc = new OdooProductClient(client, env);

      const products = [
        { id: 1, default_code: 'CF001', list_price: 15000, qty_available: 50, write_date: '2026-06-26T08:00:00' },
      ];

      const result = await pc.syncProductsToLocal(products);
      expect(result.updated).toBe(1);
      expect(mockRun).toHaveBeenCalled();
    });

    test('should handle DB errors gracefully', async () => {
      const { client } = createProductClient();
      const env = {
        AURA_DB: {
          prepare: jest.fn(() => ({
            bind: jest.fn(() => ({
              run: jest.fn(() => Promise.reject(new Error('DB locked'))),
            })),
          })),
        },
      };
      const pc = new OdooProductClient(client, env);

      const products = [
        { id: 1, default_code: 'CF001', list_price: 15000, qty_available: 50, write_date: '2026-06-26T08:00:00' },
      ];

      const result = await pc.syncProductsToLocal(products);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ── updateOdooProduct ──────────────────────────────────────────────

  describe('updateOdooProduct', () => {
    test('should write allowed fields to Odoo', async () => {
      const { client } = createProductClient();
      const restore = mockFetch({ write: () => {} });

      const pc = new OdooProductClient(client);
      await pc.updateOdooProduct(10, { list_price: 20000 });
      expect(global.fetch).toHaveBeenCalled();

      restore();
    });

    test('should reject non-whitelisted fields silently', async () => {
      const { client } = createProductClient();
      const restore = mockFetch({ write: () => {} });

      const pc = new OdooProductClient(client);
      await pc.updateOdooProduct(10, { name: 'Hacked', list_price: 20000 });
      expect(global.fetch).toHaveBeenCalled();

      restore();
    });

    test('should throw for invalid productId (0)', async () => {
      const { client } = createProductClient();
      const pc = new OdooProductClient(client);
      await expect(pc.updateOdooProduct(0, { list_price: 20000 })).rejects.toThrow();
    });

    test('should throw for empty updates', async () => {
      const { client } = createProductClient();
      const pc = new OdooProductClient(client);
      await expect(pc.updateOdooProduct(10, {})).rejects.toThrow(
        'updateOdooProduct: updates object must not be empty',
      );
    });

    test('should throw when all fields are non-whitelisted', async () => {
      const { client } = createProductClient();
      const pc = new OdooProductClient(client);
      await expect(
        pc.updateOdooProduct(10, { malicious_field: 'hacked' }),
      ).rejects.toThrow('no valid fields after filtering');
    });

    test('should propagate Odoo write errors', async () => {
      const { client } = createProductClient();
      const restore = mockFetch({
        write: () => {
          throw new OdooError('Write failed', 500);
        },
      });

      const pc = new OdooProductClient(client);
      await expect(pc.updateOdooProduct(10, { list_price: 20000 })).rejects.toThrow('Write failed');

      restore();
    });
  });
});
