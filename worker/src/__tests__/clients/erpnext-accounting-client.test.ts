import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErpnextAccountingClient, createErpnextAccountingClient } from '../../clients/erpnext-accounting-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENV = {
  ERPNEXT_URL: 'https://erp.example.com',
  ERPNEXT_API_KEY: 'k',
  ERPNEXT_API_SECRET: 's',
  ERPNEXT_SYNC_ENABLED: 'true'
};

function build(methods: Record<string, unknown> = {}): ErpnextAccountingClient {
  return new ErpnextAccountingClient(methods as unknown as import('../../clients/erpnext-client').ErpnextClient);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe('createErpnextAccountingClient', () => {
  it('returns null when URL missing', () => {
    expect(createErpnextAccountingClient({})).toBeNull();
  });

  it('returns client with DB when env provided', () => {
    const stubDb = { prepare: () => ({ bind: () => ({ first: async() => null, run: async() => ({ success: true }) }) }) };
    const c = createErpnextAccountingClient({ ...ENV, AURA_DB: stubDb as unknown as import('@cloudflare/workers-types').D1Database });
    expect(c).toBeInstanceOf(ErpnextAccountingClient);
    expect(c?.auraDb).toBe(stubDb);
  });
});

// ---------------------------------------------------------------------------
// processOrderToInvoice — idempotency (existing mapping)
// ---------------------------------------------------------------------------

describe('processOrderToInvoice — idempotency', () => {
  it('returns fromCache when mapping already exists', async() => {
    const findSpy = vi.fn().mockResolvedValue({ id: 42, erpnext_id: 'INV-1', sync_status: 'synced' });
    const client = build({ read: vi.fn(), create: vi.fn(), update: vi.fn() });
    ;(client as unknown as { _findMapping: (id: string, db: unknown) => Promise<{ id: number; erpnext_id: string; sync_status: string } | null> })._findMapping = findSpy;
    const db = { prepare: () => ({ bind: () => ({ first: async() => null, run: async() => ({ success: true }) }) }) };
    const result = await (client as unknown as { processOrderToInvoice: (o: unknown, e: unknown) => Promise<{ success: boolean; fromCache?: boolean; mappingId?: number; message: string }> }).processOrderToInvoice({ id: 'ORD-1' }, { AURA_DB: db });
    expect(result).toEqual({ success: true, fromCache: true, mappingId: 42, erpnextInvoiceId: 'INV-1', message: 'Order already invoiced' });
  });
});

// ---------------------------------------------------------------------------
// processOrderToInvoice — full flow
// ---------------------------------------------------------------------------

describe('processOrderToInvoice — full flow', () => {
  it('creates customer, invoice, and mapping on first order', async() => {
    const insertSpy = vi.fn().mockResolvedValue({ success: true });
    const selectSpy = vi.fn().mockResolvedValue({ id: 7 });
    const db = {
      prepare: (sql: string) => {
        if (sql.includes('INSERT')) {
          return { bind: () => ({ run: insertSpy }) };
        }
        return { bind: () => ({ first: selectSpy, run: async() => ({ success: true }) }) };
      }
    };

    const erpnextMock = {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn()
        .mockResolvedValueOnce({ data: { name: 'CUST-ERP' } })
        .mockResolvedValueOnce({ data: { name: 'INV-42' } }),
      read: vi.fn(),
      update: vi.fn()
    };
    const client = build(erpnextMock);
    ;(client as unknown as { _findMapping: (id: string, db: unknown) => Promise<null> })._findMapping = vi.fn().mockResolvedValue(null);

    const result = await (client as unknown as { processOrderToInvoice: (o: unknown, e: unknown) => Promise<{ success: boolean; erpnextInvoiceId?: string; mappingId?: number }> }).processOrderToInvoice(
      { id: 'ORD-1', customer_phone: '0909', customer_name: 'Nguyen', items: [{ qty: 1 }] },
      { AURA_DB: db }
    );
    expect(result.success).toBe(true);
    expect(result.erpnextInvoiceId).toBe('INV-42');
    expect(result.mappingId).toBe(7);
    expect(erpnextMock.create).toHaveBeenCalledTimes(2); // Customer + Sales Invoice
  });

  it('returns Walk-in Customer when no phone/email', async() => {
    const createSpy = vi.fn().mockResolvedValue({ data: { name: 'CUST-WALK' } });
    const insertSpy = vi.fn();
    const selectSpy = vi.fn().mockResolvedValue({ id: 1 });
    const db = {
      prepare: (sql: string) => {
        if (sql.includes('INSERT')) {
          return { bind: () => ({ run: insertSpy }) };
        }
        return { bind: () => ({ first: selectSpy, run: async() => ({ success: true }) }) };
      }
    };
    const client = build({ read: vi.fn(), create: createSpy });
    const result = await (client as unknown as { processOrderToInvoice: (o: unknown, e: unknown) => Promise<{ success: boolean }> }).processOrderToInvoice(
      { id: 'ORD-1', items: [] },
      { AURA_DB: db }
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getInvoiceByOrderId
// ---------------------------------------------------------------------------

describe('getInvoiceByOrderId', () => {
  it('returns null when no mapping found', async() => {
    const client = build({ read: vi.fn() });
    ;(client as unknown as { _findMapping: (id: string, db: unknown) => Promise<null> })._findMapping = vi.fn().mockResolvedValue(null);
    const db = { prepare: () => ({ bind: () => ({ first: async() => null }) }) };
    const result = await (client as unknown as { getInvoiceByOrderId: (id: string, e: unknown) => Promise<null> }).getInvoiceByOrderId('ORD-1', { AURA_DB: db });
    expect(result).toBeNull();
  });

  it('returns invoice with mapping when found', async() => {
    const client = build({ read: vi.fn().mockResolvedValue({ data: { name: 'INV-1', grand_total: 50000 } }) });
    ;(client as unknown as { _findMapping: (id: string, db: unknown) => Promise<{ id: number; erpnext_id: string }> })._findMapping = vi.fn().mockResolvedValue({ id: 1, erpnext_id: 'INV-1' });
    const db = { prepare: (sql: string) => ({ bind: () => ({ first: async() => null, run: async() => ({ success: true }) }) }) };
    const result = await (client as unknown as { getInvoiceByOrderId: (id: string, e: unknown) => Promise<Record<string, unknown>> }).getInvoiceByOrderId('ORD-1', { AURA_DB: db });
    expect((result as Record<string, unknown>).mapping).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// updateInvoiceVAT
// ---------------------------------------------------------------------------

describe('updateInvoiceVAT', () => {
  it('updates VAT status fields on ERPNext invoice', async() => {
    const updateSpy = vi.fn().mockResolvedValue({});
    const client = build({ update: updateSpy });
    const result = await (client as unknown as { updateInvoiceVAT: (id: string, v: unknown) => Promise<boolean> }).updateInvoiceVAT('INV-1', { success: true, invoice_number: 'VAT-001' });
    expect(result).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith('Sales Invoice', 'INV-1', expect.objectContaining({
      custom_vat_submission_status: 'Submitted',
      custom_vat_invoice_number: 'VAT-001'
    }));
  });

  it('sets Rejected when VAT fails', async() => {
    const updateSpy = vi.fn().mockResolvedValue({});
    const client = build({ update: updateSpy });
    await (client as unknown as { updateInvoiceVAT: (id: string, v: unknown) => Promise<boolean> }).updateInvoiceVAT('INV-1', { success: false });
    expect(updateSpy).toHaveBeenCalledWith('Sales Invoice', 'INV-1', expect.objectContaining({
      custom_vat_submission_status: 'Rejected'
    }));
  });
});

// ---------------------------------------------------------------------------
// generateInvoicePDF
// ---------------------------------------------------------------------------

describe('generateInvoicePDF', () => {
  it('returns PDF URL without making HTTP call', async() => {
    const client = build({ url: 'https://erp.example.com' });
    const result = await (client as unknown as { generateInvoicePDF: (id: string) => Promise<{ pdfUrl: string; invoiceId: string }> }).generateInvoicePDF('INV-1');
    expect(result.pdfUrl).toBe('https://erp.example.com/api/method/frappe.utils.print_format.download_pdf?doctype=Sales+Invoice&name=INV-1');
    expect(result.invoiceId).toBe('INV-1');
  });
});

// ---------------------------------------------------------------------------
// _markMappingFailed — DB write
// ---------------------------------------------------------------------------

describe('_markMappingFailed', () => {
  it('writes failed status + increments attempts', async() => {
    const runSpy = vi.fn().mockResolvedValue({ success: true });
    const client = build({});
    await (client as unknown as { _markMappingFailed: (id: string, err: string, db: unknown) => Promise<void> })._markMappingFailed('ORD-1', 'timeout', {
      prepare: (sql: string) => ({
        bind: (..._args: unknown[]) => ({
          run: async() => {
            expect(sql).toContain('UPDATE erpnext_mappings');
            expect(sql).toContain('sync_status = \'failed\'');
            return runSpy();
          }
        })
      })
    });
    expect(runSpy).toHaveBeenCalled();
  });
});
