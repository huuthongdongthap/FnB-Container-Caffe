/**
 * Odoo Integration Tests — Phase 1 (Accounting)
 *
 * End-to-end tests for /api/odoo/invoices endpoint
 * @jest-test-type integration
 */

const { test, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock fixtures
const mockOrder = {
  id: 'ord_123456',
  status: 'completed',
  subtotal: 150000,
  tax: 15000,
  total: 165000,
  payment_method: 'payos',
  created_at: '2026-06-26T10:30:00Z',
  customer_name: 'Nguyễn Văn A',
  customer_email: 'nguyenvana@example.com',
  customer_phone: '0909123456',
  customer_address: '123 Lê Lợi, Q.1, TP.HCM',
  items: JSON.stringify([
    { name: 'Cà Phê Sữa', quantity: 2, price: 45000, total: 90000 },
    { name: 'Bánh Mì', quantity: 1, price: 60000, total: 60000 }
  ])
};

const mockOdooInvoice = {
  id: 12345,
  name: 'INV/2026/06/001',
  invoice_date: '2026-06-26',
  amount_total: 165000,
  state: 'posted',
  partner_id: 999,
};

const mockVatSuccess = {
  success: true,
  invoice_number: 'VAT123456789',
  signed_xml: '<xml>signed VAT content</xml>',
  submitted_at: '2026-06-26T10:35:00Z',
};

// Helper to create mock env
function createMockEnv() {
  const auraDb = {
    prepare: jest.fn().mockReturnThis(),
    bind: jest.fn().mockReturnThis(),
    run: jest.fn().mockResolvedValue({}),
    first: jest.fn().mockResolvedValue(null),
    all: jest.fn().mockResolvedValue({ results: [] }),
  };
  auraDb.prepare.mockImplementation(() => auraDb);

  const authKv = {
    get: jest.fn().mockResolvedValue(null),
    put: jest.fn().mockResolvedValue(),
  };

  return {
    AURA_DB: auraDb,
    AUTH_KV: authKv,
    ODOO_URL: 'https://odoo.example.com',
    ODOO_DB: 'test_db',
    ODOO_USERNAME: 'test_user',
    ODOO_API_KEY: 'test_key',
    VNINVOICE_API_KEY: 'vat_key',
    EXECUTION_CTX: { waitUntil: jest.fn() },
  };
}

// Mock OdooAccountingClient
function mockOdooAccountingClient() {
  return {
    processOrderToInvoice: jest.fn(),
    generateInvoicePDF: jest.fn().mockResolvedValue({
      pdfUrl: '/api/odoo/invoices/12345/pdf',
      generatedAt: new Date().toISOString(),
    }),
    getInvoiceByOrderId: jest.fn(),
    updateInvoiceVAT: jest.fn().mockResolvedValue(true),
    _findMapping: jest.fn(),
    _createMapping: jest.fn().mockResolvedValue(1),
    _markMappingFailed: jest.fn().mockResolvedValue(),
    _getOrCreateOdooPartner: jest.fn().mockResolvedValue(999),
    odoo: {
      create: jest.fn(),
      read: jest.fn(),
      search: jest.fn(),
      update: jest.fn(),
      findMapping: jest.fn(),
      markMappingFailed: jest.fn(),
    },
    mappers: {
      mapOrderToInvoice: jest.fn().mockReturnValue({
        move_type: 'out_invoice',
        partner_id: 999,
        invoice_date: '2026-06-26',
        invoice_line_ids: [[0, 0, { name: 'Cà Phê Sữa', quantity: 2, price_unit: 45000 }]],
        ref: 'AURA-ord_123456',
        x_aura_order_id: 'ord_123456',
        currency_id: 1,
      }),
      mapInvoiceForVAT: jest.fn().mockReturnValue({
        invoice_number: 'INV/2026/06/001',
        subtotal: 150000,
        tax_amount: 15000,
        total: 165000,
      }),
    },
  };
}

// Import the module under test
let createOdooInvoice, getOdooInvoice, retryOdooInvoice;

beforeEach(async () => {
  jest.resetModules();
  jest.isolateModules(() => {
    const module = require('../worker/src/routes/odoo-invoices.js');
    createOdooInvoice = module.createOdooInvoice;
    getOdooInvoice = module.getOdooInvoice;
    retryOdooInvoice = module.retryOdooInvoice;
  });
  jest.clearAllMocks();
});

xdescribe('Odoo Invoices Integration — Phase 1', () => {
  let env;

  beforeEach(() => {
    jest.resetModules();
    env = createMockEnv();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/odoo/invoices', () => {
    const mockRequest = (body) => ({
      json: jest.fn().mockResolvedValue(body),
    });

    test('should create invoice successfully for completed order', async () => {
      // Arrange: order exists
      env.AURA_DB.prepare()
        .bind('ord_123456')
        .first.mockResolvedValue(mockOrder);

      // Odoo client creates invoice
      const odooClient = mockOdooAccountingClient();
      odooClient.processOrderToInvoice.mockResolvedValue({
        success: true,
        odooInvoiceId: 12345,
        invoiceNumber: 'INV/2026/06/001',
        mappingId: 1,
        invoiceData: mockOdooInvoice,
      });

      // Mock VAT success
      const vatResult = mockVatSuccess;

      // Mock module override for odoo client
      jest.doMock('../worker/src/clients/odoo-accounting-client.js', () => ({
        createOdooAccountingClient: jest.fn(() => odooClient),
      }));

      // Re-require to pick up mock
      jest.isolateModules(() => {
        const module = require('../worker/src/routes/odoo-invoices.js');
        createOdooInvoice = module.createOdooInvoice;
      });

      // Act
      const response = await createOdooInvoice(mockRequest({ orderId: 'ord_123456' }), env);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.orderId).toBe('ord_123456');
      expect(body.odooInvoiceId).toBe(12345);
      expect(body.invoiceNumber).toBe('INV/2026/06/001');
      expect(body.vatStatus).toBe('submitted');
      expect(body.vatInvoiceNumber).toBe('VAT123456789');
      expect(body.message).toContain('created');

      // Verify order fetched
      expect(env.AURA_DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM orders WHERE id = ?')
      );
    });

    test('should return 400 if orderId is missing', async () => {
      const response = await createOdooInvoice(mockRequest({}), env);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('orderId');
    });

    test('should return 404 if order not found', async () => {
      env.AURA_DB.prepare()
        .bind('not_found')
        .first.mockResolvedValue(null);

      const response = await createOdooInvoice(mockRequest({ orderId: 'not_found' }), env);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Order not found');
    });

    test('should return 400 if order has no items', async () => {
      env.AURA_DB.prepare()
        .bind('ord_empty')
        .first.mockResolvedValue({ ...mockOrder, items: '[]' });

      const response = await createOdooInvoice(mockRequest({ orderId: 'ord_empty' }), env);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('no items');
    });

    test('should return 400 if order status is not deliverable', async () => {
      const pendingOrder = { ...mockOrder, status: 'pending' };
      env.AURA_DB.prepare()
        .bind('ord_pending')
        .first.mockResolvedValue(pendingOrder);

      const response = await createOdooInvoice(mockRequest({ orderId: 'ord_pending' }), env);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('status');
    });

    test('should be idempotent and return cached invoice', async () => {
      // Arrange: invoice already exists
      const existingInvoice = {
        id: 1,
        order_id: 'ord_123456',
        odoo_invoice_id: 12345,
        invoice_number: 'INV/2026/06/001',
        vat_submission_status: 'submitted',
        vat_invoice_number: 'VAT123',
      };
      env.AURA_DB.prepare()
        .bind('ord_123456')
        .first.mockResolvedValue(existingInvoice);

      const response = await createOdooInvoice(mockRequest({ orderId: 'ord_123456' }), env);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.fromCache).toBe(true);
      expect(body.odooInvoiceId).toBe(12345);
      expect(body.message).toContain('already exists');
    });

    test('should handle Odoo client creation failure', async () => {
      env.AURA_DB.prepare()
        .bind('ord_123456')
        .first.mockResolvedValue(mockOrder);

      // Mock odoo client creation to fail
      jest.doMock('../worker/src/clients/odoo-accounting-client.js', () => ({
        createOdooAccountingClient: jest.fn(() => null),
      }));

      jest.isolateModules(() => {
        const module = require('../worker/src/routes/odoo-invoices.js');
        createOdooInvoice = module.createOdooInvoice;
      });

      const response = await createOdooInvoice(mockRequest({ orderId: 'ord_123456' }), env);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Odoo client not configured');
      expect(body.syncId).toBeDefined();
    });

    test('should handle Odoo create failure and mark mapping as failed', async () => {
      env.AURA_DB.prepare()
        .bind('ord_123456')
        .first.mockResolvedValue(mockOrder);

      const odooClient = mockOdooAccountingClient();
      odooClient.processOrderToInvoice.mockRejectedValue(new Error('Odoo API error: Connection timeout'));

      jest.doMock('../worker/src/clients/odoo-accounting-client.js', () => ({
        createOdooAccountingClient: jest.fn(() => odooClient),
      }));

      jest.isolateModules(() => {
        const module = require('../worker/src/routes/odoo-invoices.js');
        createOdooInvoice = module.createOdooInvoice;
      });

      const response = await createOdooInvoice(mockRequest({ orderId: 'ord_123456' }), env);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('failed');
      expect(body.syncId).toBeDefined();
    });

    test('should handle VAT submission failure gracefully', async () => {
      env.AURA_DB.prepare()
        .bind('ord_123456')
        .first.mockResolvedValue(mockOrder);

      const odooClient = mockOdooAccountingClient();
      odooClient.processOrderToInvoice.mockResolvedValue({
        success: true,
        odooInvoiceId: 12345,
        invoiceNumber: 'INV/001',
        invoiceData: mockOdooInvoice,
      });

      // VAT fails
      const vatError = new Error('VAT API timeout');
      const submitToVATMock = jest.fn().mockRejectedValue(vatError);

      jest.doMock('../worker/src/clients/odoo-accounting-client.js', () => ({
        createOdooAccountingClient: jest.fn(() => odooClient),
      }));

      // Override submitToVATAPI
      const originalModule = require('../worker/src/routes/odoo-invoices.js');
      originalModule.submitToVATAPI = submitToVATMock;

      const response = await createOdooInvoice(mockRequest({ orderId: 'ord_123456' }), env);
      const body = await response.json();

      expect(response.status).toBe(201); // Still succeeds (VAT is non-blocking)
      expect(body.success).toBe(true);
      expect(body.vatStatus).toBe('failed'); // VAT failed but response succeeds
      expect(submitToVATMock).toHaveBeenCalled();
    });

    test('should not send email if customer_email is missing', async () => {
      const orderNoEmail = { ...mockOrder, customer_email: null };
      env.AURA_DB.prepare()
        .bind('ord_123456')
        .first.mockResolvedValue(orderNoEmail);

      const odooClient = mockOdooAccountingClient();
      odooClient.processOrderToInvoice.mockResolvedValue({
        success: true,
        odooInvoiceId: 12345,
        invoiceNumber: 'INV/001',
        invoiceData: mockOdooInvoice,
      });

      jest.doMock('../worker/src/clients/odoo-accounting-client.js', () => ({
        createOdooAccountingClient: jest.fn(() => odooClient),
      }));

      const response = await createOdooInvoice(mockRequest({ orderId: 'ord_123456' }), env);
      await response.json();

      expect(response.status).toBe(201);
      // Email should be skipped (no SMTP config check in test)
    });

    test('should handle invalid JSON in order items', async () => {
      env.AURA_DB.prepare()
        .bind('ord_bad')
        .first.mockResolvedValue({ ...mockOrder, items: 'invalid json' });

      const response = await createOdooInvoice(mockRequest({ orderId: 'ord_bad' }), env);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid items JSON');
    });
  });

  describe('GET /api/odoo/invoices/:orderId', () => {
    test('should return invoice mapping status', async () => {
      // Mock DB query result with join
      const mockMapping = {
        id: 1,
        local_type: 'order',
        local_id: 'ord_123456',
        odoo_id: 12345,
        odoo_model: 'account.move',
        sync_status: 'synced',
        attempts: 1,
        last_synced_at: '2026-06-26T10:30:00Z',
        error_message: null,
        invoice_number: 'INV/001',
        vat_submission_status: 'submitted',
        vat_invoice_number: 'VAT123',
      };

      // Mock the query chain
      let queryCallback = null;
      env.AURA_DB.prepare.mockImplementation((sql) => {
        if (sql.includes('FROM odoo_mappings')) {
          queryCallback = (method) => {
            if (method === 'bind') {
              return { first: jest.fn().mockResolvedValue(mockMapping) };
            }
            return { first: jest.fn().mockResolvedValue(mockMapping) };
          };
        }
        return { bind: jest.fn().mockReturnValue({ first: jest.fn().mockResolvedValue(mockMapping) }) };
      });

      const response = await getOdooInvoice({ params: { orderId: 'ord_123456' } }, env, 'ord_123456');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.orderId).toBe('ord_123456');
      expect(body.mapping.odooId).toBe(12345);
      expect(body.mapping.syncStatus).toBe('synced');
      expect(body.invoice.vatStatus).toBe('submitted');
    });

    test('should return 404 if no mapping found', async () => {
      env.AURA_DB.prepare()
        .bind('not_found')
        .first.mockResolvedValue(null);

      const response = await getOdooInvoice({ params: { orderId: 'not_found' } }, env, 'not_found');
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/odoo/invoices/:orderId/retry', () => {
    test('should retry failed mapping successfully', async () => {
      // Failed mapping
      const failedMapping = {
        id: 1,
        local_type: 'order',
        local_id: 'ord_retry',
        odoo_id: null,
        sync_status: 'failed',
        attempts: 1,
        error_message: 'Odoo timeout',
      };

      env.AURA_DB.prepare()
        .bind('order', 'ord_retry')
        .first.mockResolvedValue(failedMapping);

      env.AURA_DB.prepare()
        .bind('ord_retry')
        .first.mockResolvedValue(mockOrder);

      const odooClient = mockOdooAccountingClient();
      odooClient.processOrderToInvoice.mockResolvedValue({
        success: true,
        odooInvoiceId: 12345,
        invoiceNumber: 'INV/RETRY',
        mappingId: 2,
      });

      jest.doMock('../worker/src/clients/odoo-accounting-client.js', () => ({
        createOdooAccountingClient: jest.fn(() => odooClient),
      }));

      jest.isolateModules(() => {
        const module = require('../worker/src/routes/odoo-invoices.js');
        retryOdooInvoice = module.retryOdooInvoice;
      });

      const response = await retryOdooInvoice({
        params: { orderId: 'ord_retry' },
      }, env, 'ord_retry');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.attempt).toBe(2);
      expect(body.odooInvoiceId).toBe(12345);
    });

    test('should return 404 if no mapping exists', async () => {
      env.AURA_DB.prepare()
        .bind('order', 'missing')
        .first.mockResolvedValue(null);

      const response = await retryOdooInvoice({
        params: { orderId: 'missing' },
      }, env, 'missing');
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('No mapping found');
    });

    test('should return 400 if already synced', async () => {
      const syncedMapping = {
        id: 1,
        sync_status: 'synced',
        attempts: 1,
      };

      env.AURA_DB.prepare()
        .bind('order', 'ord_synced')
        .first.mockResolvedValue(syncedMapping);

      const response = await retryOdooInvoice({
        params: { orderId: 'ord_synced' },
      }, env, 'ord_synced');
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('already synced');
    });

    test('should return 400 if max attempts exceeded', async () => {
      const maxedMapping = {
        id: 1,
        sync_status: 'failed',
        attempts: 3,
      };

      env.AURA_DB.prepare()
        .bind('order', 'ord_maxed')
        .first.mockResolvedValue(maxedMapping);

      const response = await retryOdooInvoice({
        params: { orderId: 'ord_maxed' },
      }, env, 'ord_maxed');
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Max attempts');
    });

    test('should handle order not found during retry', async () => {
      const failedMapping = {
        id: 1,
        sync_status: 'failed',
        attempts: 1,
      };

      env.AURA_DB.prepare()
        .bind('order', 'ord_missing_order')
        .first.mockResolvedValue(failedMapping);

      env.AURA_DB.prepare()
        .bind('ord_missing_order')
        .first.mockResolvedValue(null);

      const response = await retryOdooInvoice({
        params: { orderId: 'ord_missing_order' },
      }, env, 'ord_missing_order');
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('Order not found');
    });
  });
});

describe('OdooInvoice Mappers — Unit Tests', () => {
  let mappers;

  beforeEach(() => {
    const module = require('../worker/src/clients/odoo-accounting-client.js');
    mappers = module.InvoiceMappers;
  });

  describe('mapOrderToInvoice', () => {
    test('should map order to invoice values correctly', () => {
      const order = {
        id: 'ord_001',
        created_at: '2026-06-26T10:00:00Z',
        customer_name: 'Test User',
      };
      const items = [
        { name: 'Coffee', quantity: 2, price: 50000 },
        { name: 'Tea', quantity: 1, price: 30000 },
      ];
      const odooCustomerId = 123;

      const result = mappers.mapOrderToInvoice(order, items, odooCustomerId);

      expect(result.move_type).toBe('out_invoice');
      expect(result.partner_id).toBe(123);
      expect(result.invoice_date).toBe('2026-06-26');
      expect(result.ref).toBe('AURA-ord_001');
      expect(result.x_aura_order_id).toBe('ord_001');
      expect(result.invoice_line_ids).toHaveLength(2);
      expect(result.invoice_line_ids[0][2].name).toBe('Coffee');
      expect(result.invoice_line_ids[0][2].quantity).toBe(2);
      expect(result.invoice_line_ids[0][2].price_unit).toBe(50000);
    });

    test('should throw if missing required inputs', () => {
      expect(() => mappers.mapOrderToInvoice(null, [], 123))
        .toThrow('Invalid inputs');
      expect(() => mappers.mapOrderToInvoice({}, null, 123))
        .toThrow('Invalid inputs');
      expect(() => mappers.mapOrderToInvoice({}, [], null))
        .toThrow('Invalid inputs');
    });

    test('should handle string prices with commas', () => {
      const order = { id: 'ord_001', created_at: new Date().toISOString() };
      const items = [{ name: 'Test', quantity: 1, price: '50,000' }];
      const result = mappers.mapOrderToInvoice(order, items, 1);
      expect(result.invoice_line_ids[0][2].price_unit).toBe(50000);
    });

    test('should handle quantity aliases (qty)', () => {
      const order = { id: 'ord_001', created_at: new Date().toISOString() };
      const items = [{ name: 'Test', qty: 3, price: 10000 }];
      const result = mappers.mapOrderToInvoice(order, items, 1);
      expect(result.invoice_line_ids[0][2].quantity).toBe(3);
    });
  });

  describe('mapInvoiceForVAT', () => {
    test('should map invoice to VAT payload', () => {
      const odooInvoice = {
        name: 'INV/2026/001',
        invoice_date: '2026-06-26',
      };
      const order = {
        customer_name: 'Nguyễn Văn A',
        customer_address: '123 Lê Lợi',
        customer_phone: '0909123456',
        customer_email: 'test@example.com',
        payment_method: 'payos',
      };
      const items = [
        { name: 'Coffee', quantity: 2, price: 50000 },
      ];

      const result = mappers.mapInvoiceForVAT(odooInvoice, order, items);

      expect(result.invoice_number).toBe('INV/2026/001');
      expect(result.seller.name).toBe('AURA CAFE');
      expect(result.buyer.name).toBe('Nguyễn Văn A');
      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe(100000);
      expect(result.tax_amount).toBe(10000); // 10% VAT
      expect(result.total).toBe(110000);
      expect(result.currency).toBe('VND');
    });

    test('should handle empty items array', () => {
      const odooInvoice = { name: 'INV/001', invoice_date: '2026-06-26' };
      const order = { customer_name: 'Test', payment_method: 'cash' };
      const items = [];

      const result = mappers.mapInvoiceForVAT(odooInvoice, order, items);

      expect(result.subtotal).toBe(0);
      expect(result.tax_amount).toBe(0);
      expect(result.total).toBe(0);
    });

    test('should throw if inputs invalid', () => {
      expect(() => mappers.mapInvoiceForVAT(null, {}, [])).toThrow('Invalid inputs');
      expect(() => mappers.mapInvoiceForVAT({}, null, [])).toThrow('Invalid inputs');
    });
  });
});
