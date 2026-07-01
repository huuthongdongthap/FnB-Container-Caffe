/**
 * ERPNext Invoices Routes Tests — handleErpnextInvoicesRequest
 *
 * Tests for invoice creation, VAT submission, PDF generation, retry via erpnext-accounting-client.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock erpnext-accounting-client ───────────────────────────────────────
const mockAccountingClient = {
  processOrderToInvoice: vi.fn(),
  getInvoiceByOrderId: vi.fn(),
  updateInvoiceVAT: vi.fn(),
  generateInvoicePDF: vi.fn(),
};

vi.mock('../worker/src/clients/erpnext-accounting-client', () => ({
  createErpnextAccountingClient: vi.fn(() => mockAccountingClient),
}));

let handleErpnextInvoicesRequest: any;

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountHandler() {
  const mod = await import('../worker/src/routes/erpnext-invoices');
  handleErpnextInvoicesRequest = mod.handleErpnextInvoicesRequest;
}

const configuredEnv = { ERPNEXT_URL: 'https://erp.test', ERPNEXT_API_KEY: 'key', ERPNEXT_API_SECRET: 'secret' };

describe('POST /create', () => {
  test('creates invoice from order successfully', async () => {
    mockAccountingClient.processOrderToInvoice.mockResolvedValue({ invoiceId: 'INV-001' });
    await mountHandler();

    const req = new Request('https://test/api/erpnext-invoices/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'ord-1', items: [{ name: 'Coffee', qty: 2, rate: 25000 }] }),
    });
    const res = await handleErpnextInvoicesRequest(req, configuredEnv);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.invoiceId).toBe('INV-001');
    expect(mockAccountingClient.processOrderToInvoice).toHaveBeenCalledTimes(1);
  });

  test('returns 400 when order id missing', async () => {
    await mountHandler();

    const req = new Request('https://test/api/erpnext-invoices/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });
    const res = await handleErpnextInvoicesRequest(req, configuredEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/order id required/i);
  });

  test('returns 503 when ERPNext accounting not configured', async () => {
    const acctMod = await import('../worker/src/clients/erpnext-accounting-client');
    (acctMod.createErpnextAccountingClient as any).mockReturnValueOnce(null);
    await mountHandler();

    const req = new Request('https://test/api/erpnext-invoices/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'ord-1' }),
    });
    const res = await handleErpnextInvoicesRequest(req, {});

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });
});

describe('GET /:orderId', () => {
  test('returns invoice by order ID', async () => {
    mockAccountingClient.getInvoiceByOrderId.mockResolvedValue({
      id: 'INV-001',
      order_id: 'ord-1',
      status: 'submitted',
      amount: 50000,
    });
    await mountHandler();

    const req = new Request('https://test/api/erpnext-invoices/ord-1', { method: 'GET' });
    const res = await handleErpnextInvoicesRequest(req, configuredEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('INV-001');
    expect(mockAccountingClient.getInvoiceByOrderId).toHaveBeenCalledWith('ord-1', configuredEnv);
  });

  test('returns 404 when no invoice found', async () => {
    mockAccountingClient.getInvoiceByOrderId.mockResolvedValue(null);
    await mountHandler();

    const req = new Request('https://test/api/erpnext-invoices/nonexistent', { method: 'GET' });
    const res = await handleErpnextInvoicesRequest(req, configuredEnv);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no invoice found/i);
  });
});

describe('POST /:id/vat', () => {
  test('updates VAT status', async () => {
    mockAccountingClient.updateInvoiceVAT.mockResolvedValue(true);
    await mountHandler();

    const req = new Request('https://test/api/erpnext-invoices/INV-001/vat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, invoice_number: 'VAT001' }),
    });
    const res = await handleErpnextInvoicesRequest(req, configuredEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockAccountingClient.updateInvoiceVAT).toHaveBeenCalledWith('INV-001', { success: true, invoice_number: 'VAT001' });
  });
});

describe('GET /:id/pdf', () => {
  test('generates PDF invoice', async () => {
    mockAccountingClient.generateInvoicePDF.mockResolvedValue({ url: 'https://erp.test/pdf/INV-001.pdf' });
    await mountHandler();

    const req = new Request('https://test/api/erpnext-invoices/INV-001/pdf', { method: 'GET' });
    const res = await handleErpnextInvoicesRequest(req, configuredEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.url).toContain('INV-001.pdf');
  });
});

describe('POST /retry', () => {
  test('retries failed syncs from database', async () => {
    mockAccountingClient.processOrderToInvoice.mockResolvedValue({ invoiceId: 'INV-RETRY' });

    const allStub = vi.fn(async () => ({
      results: [
        { local_id: 'failed-ord-1' },
        { local_id: 'failed-ord-2' },
      ],
    }));
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ all: allStub })),
        all: allStub,
      })),
    };

    const env = { ...configuredEnv, AURA_DB: db };
    await mountHandler();

    const req = new Request('https://test/api/erpnext-invoices/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Test' }),
    });
    const res = await handleErpnextInvoicesRequest(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.retried).toBe(2);
    expect(mockAccountingClient.processOrderToInvoice).toHaveBeenCalledTimes(2);
  });

  test('returns 503 when database not available for retry', async () => {
    await mountHandler();

    const req = new Request('https://test/api/erpnext-invoices/retry', { method: 'POST' });
    const res = await handleErpnextInvoicesRequest(req, configuredEnv);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/database not available/i);
  });
});

describe('404', () => {
  test('returns 404 for unknown route', async () => {
    await mountHandler();
    const req = new Request('https://test/api/erpnext-invoices/unknown', { method: 'GET' });
    const res = await handleErpnextInvoicesRequest(req, configuredEnv);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no invoice found/i);
  });
});
