/**
 * Odoo CRM Client Unit Tests — Phase 3 (CRM Sync)
 * Tests for OdooCrmClient: createLead, updatePartner, addTag, removeTag, getPartnerInfo
 *
 * @jest-test-type unit
 */
import { OdooClient, OdooError } from '../worker/src/clients/odoo-client.js';
import { OdooCrmClient, createOdooCrmClient } from '../worker/src/clients/odoo-crm-client.js';

// ── Helpers ──────────────────────────────────────────────────────────

function mockOdooResponse(result, id = 1) {
  return { jsonrpc: '2.0', id, result };
}

function mockOdooErrorResponse(message, code = 'odoo_error', id = 1) {
  return { jsonrpc: '2.0', id, error: { code, message, data: {} } };
}

/**
 * Mock fetch handling Odoo JSON-RPC.
 * Returns restore function.
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
      const allArgs = params.args || [];
      const model = allArgs[3];
      const method = allArgs[4];
      const methodArgs = allArgs.slice(5);

      if (method === 'search_read') {
        const result = handlers.search_read ? handlers.search_read(methodArgs, model) : [];
        return { ok: true, json: async () => mockOdooResponse(result) };
      }
      if (method === 'create') {
        const values = methodArgs[0];
        const id = handlers.create ? handlers.create(values, model) : 999;
        return { ok: true, json: async () => mockOdooResponse(id) };
      }
      if (method === 'write') {
        const ids = methodArgs[0];
        const values = methodArgs[1];
        if (handlers.write) handlers.write(ids, values, model);
        return { ok: true, json: async () => mockOdooResponse(true) };
      }
      if (method === 'read') {
        const ids = methodArgs[0];
        const fields = methodArgs[1];
        const result = handlers.read ? handlers.read(ids, fields, model) : [];
        return { ok: true, json: async () => mockOdooResponse(result) };
      }
      if (method === 'unlink') {
        return { ok: true, json: async () => mockOdooResponse(true) };
      }
    }

    return { ok: true, json: async () => mockOdooResponse(null) };
  });
  return () => { global.fetch = originalFetch; };
}

/**
 * Create OdooCrmClient with a mocked OdooClient that has auraDb stub.
 */
function createCrmClient() {
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        run: jest.fn(() => Promise.resolve({ changes: 1 })),
      }),
    }),
  };
  const client = new OdooClient({
    url: 'https://odoo.test.com',
    db: 'test_db',
    username: 'test',
    apiKey: 'test_key',
    auraDb: mockDb,
  });
  return new OdooCrmClient(client);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('OdooCrmClient — Phase 3 (CRM Sync)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Factory ────────────────────────────────────────────────────────

  describe('createOdooCrmClient', () => {
    test('should return OdooCrmClient with valid env', () => {
      const env = {
        ODOO_URL: 'https://odoo.test.com',
        ODOO_DB: 'test_db',
        ODOO_USERNAME: 'test',
        ODOO_API_KEY: 'test_key',
      };
      const client = createOdooCrmClient(env);
      expect(client).toBeInstanceOf(OdooCrmClient);
    });

    test('should return null if ODOO_URL missing', () => {
      const env = { ODOO_DB: 'test', ODOO_USERNAME: 'u', ODOO_API_KEY: 'k' };
      expect(createOdooCrmClient(env)).toBeNull();
    });

    test('should return null if ODOO_DB missing', () => {
      const env = { ODOO_URL: 'https://odoo.test.com', ODOO_USERNAME: 'u', ODOO_API_KEY: 'k' };
      expect(createOdooCrmClient(env)).toBeNull();
    });
  });

  // ── createLead ─────────────────────────────────────────────────────

  describe('createLead', () => {
    test('should create partner and lead for consented customer', async () => {
      const crm = createCrmClient();
      const restore = mockFetch({
        search_read: (args, model) => {
          if (model === 'res.partner' && args[0] && args[0][0] === 'x_our_customer_id') return [];
          return [];
        },
        create: (values, model) => {
          if (model === 'res.partner') return 100;
          if (model === 'crm.lead') return 200;
          return 999;
        },
        write: () => {},
      });

      const customer = {
        id: 'cust_001',
        name: 'Nguyen Van A',
        phone: '0912345678',
        email: 'nguyena@test.com',
        loyalty_tier: 'gold',
        consent_marketing: true,
        consent_odoo_sync: true,
      };

      const result = await crm.createLead(customer);
      expect(result.partnerId).toBe(100);
      expect(result.leadId).toBe(200);

      restore();
    });

    test('should return null if customer has no consent', async () => {
      const crm = createCrmClient();
      const customer = {
        id: 'cust_002',
        name: 'No Consent',
        consent_marketing: false,
        consent_odoo_sync: false,
      };
      const result = await crm.createLead(customer);
      expect(result).toBeNull();
    });

    test('should return null if consent_odoo_sync is false', async () => {
      const crm = createCrmClient();
      const customer = {
        id: 'cust_003',
        name: 'Partial Consent',
        consent_marketing: true,
        consent_odoo_sync: false,
      };
      const result = await crm.createLead(customer);
      expect(result).toBeNull();
    });

    test('should throw if customer is null', async () => {
      const crm = createCrmClient();
      await expect(crm.createLead(null)).rejects.toThrow();
    });

    test('should throw if customer is undefined', async () => {
      const crm = createCrmClient();
      await expect(crm.createLead(undefined)).rejects.toThrow();
    });

    test('should apply loyalty tier tags', async () => {
      const crm = createCrmClient();
      const tagCalls = [];
      const writeCalls = [];
      const restore = mockFetch({
        search_read: (args, model) => {
          if (model === 'res.partner' && args[0] && args[0][0] === 'x_our_customer_id') return [];
          if (model === 'res.partner.category' && args[0] && args[0][0] === 'name') {
            return []; // No existing tag, will create
          }
          return [];
        },
        create: (values, model) => {
          if (model === 'res.partner') return 100;
          if (model === 'crm.lead') return 200;
          if (model === 'res.partner.category') {
            tagCalls.push(values.name);
            return 300 + tagCalls.length;
          }
          return 999;
        },
        write: (ids, values, model) => {
          if (model === 'res.partner') {
            writeCalls.push(values);
          }
        },
      });

      const customer = {
        id: 'cust_004',
        name: 'Gold Customer',
        loyalty_tier: 'gold',
        consent_marketing: true,
        consent_odoo_sync: true,
      };

      await crm.createLead(customer);
      // Should have created "Gold Member" tag
      expect(tagCalls).toContain('Gold Member');
      // Should have written tag_ids to partner
      expect(writeCalls.length).toBeGreaterThan(0);

      restore();
    });
  });

  // ── updatePartner ──────────────────────────────────────────────────

  describe('updatePartner', () => {
    test('should update allowed fields', async () => {
      const crm = createCrmClient();
      const restore = mockFetch({
        write: () => {},
      });

      await crm.updatePartner(100, { name: 'New Name', phone: '0999999999' });
      expect(global.fetch).toHaveBeenCalled();

      restore();
    });

    test('should not update non-whitelisted fields', async () => {
      const crm = createCrmClient();
      const writeValues = [];
      const restore = mockFetch({
        write: (ids, values) => {
          writeValues.push(values);
        },
      });

      await crm.updatePartner(100, { name: 'OK', email: 'hacked@evil.com', x_custom_field: 'bad' });
      // x_custom_field should be filtered out
      expect(writeValues[0].x_custom_field).toBeUndefined();
      expect(writeValues[0].name).toBe('OK');

      restore();
    });

    test('should return true for empty updates', async () => {
      const crm = createCrmClient();
      const result = await crm.updatePartner(100, {});
      expect(result).toBe(true);
    });

    test('should return true for null updates', async () => {
      const crm = createCrmClient();
      const result = await crm.updatePartner(100, null);
      expect(result).toBe(true);
    });

    test('should throw for invalid partnerId (0)', async () => {
      const crm = createCrmClient();
      await expect(crm.updatePartner(0, { name: 'X' })).rejects.toThrow();
    });

    test('should throw for invalid partnerId (negative)', async () => {
      const crm = createCrmClient();
      await expect(crm.updatePartner(-1, { name: 'X' })).rejects.toThrow();
    });
  });

  // ── addTag ─────────────────────────────────────────────────────────

  describe('addTag', () => {
    test('should find existing tag and link to partner', async () => {
      const crm = createCrmClient();
      const restore = mockFetch({
        search_read: (args, model) => {
          if (model === 'res.partner.category' && args[0] && args[0][0] === 'name') {
            return [{ id: 50, name: 'VIP' }];
          }
          return [];
        },
        write: () => {},
      });

      await crm.addTag(100, 'VIP');
      expect(global.fetch).toHaveBeenCalled();

      restore();
    });

    test('should create tag if not exists', async () => {
      const crm = createCrmClient();
      const restore = mockFetch({
        search_read: (args, model) => {
          if (model === 'res.partner.category' && args[0] && args[0][0] === 'name') {
            return []; // Not found, will create
          }
          return [];
        },
        create: (values, model) => {
          if (model === 'res.partner.category') return 55;
          return 999;
        },
        write: () => {},
      });

      await crm.addTag(100, 'New Tag');
      expect(global.fetch).toHaveBeenCalled();

      restore();
    });

    test('should throw for invalid partnerId', async () => {
      const crm = createCrmClient();
      await expect(crm.addTag(0, 'VIP')).rejects.toThrow();
      await expect(crm.addTag(-1, 'VIP')).rejects.toThrow();
    });

    test('should throw for empty tagName', async () => {
      const crm = createCrmClient();
      await expect(crm.addTag(100, '')).rejects.toThrow();
      await expect(crm.addTag(100, null)).rejects.toThrow();
    });
  });

  // ── removeTag ──────────────────────────────────────────────────────

  describe('removeTag', () => {
    test('should unlink tag from partner', async () => {
      const crm = createCrmClient();
      const restore = mockFetch({
        search_read: (args, model) => {
          if (model === 'res.partner.category' && args[0] && args[0][0] === 'name') {
            return [{ id: 50, name: 'VIP' }];
          }
          return [];
        },
        write: () => {},
      });

      await crm.removeTag(100, 'VIP');
      expect(global.fetch).toHaveBeenCalled();

      restore();
    });

    test('should return true silently if tag does not exist', async () => {
      const crm = createCrmClient();
      const restore = mockFetch({
        search_read: (args, model) => {
          if (model === 'res.partner.category' && args[0] && args[0][0] === 'name') {
            return []; // Tag not found
          }
          return [];
        },
      });

      const result = await crm.removeTag(100, 'NonExistent');
      expect(result).toBe(true);

      restore();
    });

    test('should throw for invalid partnerId', async () => {
      const crm = createCrmClient();
      await expect(crm.removeTag(0, 'VIP')).rejects.toThrow();
    });

    test('should throw for empty tagName', async () => {
      const crm = createCrmClient();
      await expect(crm.removeTag(100, '')).rejects.toThrow();
    });
  });

  // ── getPartnerInfo ─────────────────────────────────────────────────

  describe('getPartnerInfo', () => {
    test('should return partner notes and tags', async () => {
      const crm = createCrmClient();
      const restore = mockFetch({
        read: (ids, fields, model) => {
          if (model === 'res.partner' && fields && fields.includes('category_id')) {
            return [{
              id: 100,
              name: 'Test Partner',
              note: 'Important customer',
              category_id: [[4, 50], [4, 51]],
              write_date: '2026-06-26T10:00:00',
            }];
          }
          // Tag name lookup for res.partner.category
          if (model === 'res.partner.category') {
            return [
              { id: 50, name: 'VIP' },
              { id: 51, name: 'Gold Member' },
            ];
          }
          return [];
        },
        search_read: (args, model) => {
          if (model === 'res.partner.category') {
            return [
              { id: 50, name: 'VIP' },
              { id: 51, name: 'Gold Member' },
            ];
          }
          return [];
        },
      });

      const result = await crm.getPartnerInfo(100);
      expect(result.notes).toBe('Important customer');
      expect(result.tags).toContain('VIP');
      expect(result.tags).toContain('Gold Member');
      expect(result.lastActivity).toBe('2026-06-26T10:00:00');

      restore();
    });

    test('should return empty tags if no categories', async () => {
      const crm = createCrmClient();
      const restore = mockFetch({
        read: (ids, fields) => {
          return [{ id: 100, name: 'Partner', note: '', category_id: [], write_date: '' }];
        },
      });

      const result = await crm.getPartnerInfo(100);
      expect(result.tags).toEqual([]);
      expect(result.notes).toBe('');

      restore();
    });

    test('should throw for invalid partnerId (0)', async () => {
      const crm = createCrmClient();
      await expect(crm.getPartnerInfo(0)).rejects.toThrow();
    });

    test('should throw for invalid partnerId (negative)', async () => {
      const crm = createCrmClient();
      await expect(crm.getPartnerInfo(-1)).rejects.toThrow();
    });
  });

  // ── mapLoyaltyTier (static) ────────────────────────────────────────

  describe('mapLoyaltyTier (static)', () => {
    test('should map bronze', () => {
      expect(OdooCrmClient.mapLoyaltyTier('bronze')).toEqual(['Bronze Member']);
    });
    test('should map silver', () => {
      expect(OdooCrmClient.mapLoyaltyTier('silver')).toEqual(['Silver Member']);
    });
    test('should map gold', () => {
      expect(OdooCrmClient.mapLoyaltyTier('gold')).toEqual(['Gold Member']);
    });
    test('should map platinum', () => {
      expect(OdooCrmClient.mapLoyaltyTier('platinum')).toEqual(['VIP']);
    });
    test('should handle case insensitivity', () => {
      expect(OdooCrmClient.mapLoyaltyTier('GOLD')).toEqual(['Gold Member']);
    });
    test('should return empty for unknown tier', () => {
      expect(OdooCrmClient.mapLoyaltyTier('unknown')).toEqual([]);
    });
    test('should return empty for null', () => {
      expect(OdooCrmClient.mapLoyaltyTier(null)).toEqual([]);
    });
  });
});
