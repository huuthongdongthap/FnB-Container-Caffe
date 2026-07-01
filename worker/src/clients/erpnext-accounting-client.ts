/**
 * ErpnextAccountingClient — Invoice sync operations.
 *
 * Handles the full Sales Invoice lifecycle:
 * - Order to Sales Invoice mapping and creation
 * - Invoice retrieval via order ID
 * - VAT e-invoice custom field updates
 * - PDF invoice generation
 */

import { createErpnextClient, ErpnextClient, ErpnextApiResponse } from './erpnext-client';
import { mapOrderToInvoice, mapCustomerForInvoice } from '../lib/erpnext-mapper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderInput {
  id: string;
  items?: string | Array<Record<string, unknown>>;
  customer_phone?: string;
  customer_email?: string;
  customer_name?: string;
  customer_address?: string;
  customer_id?: string | number;
}

export interface D1Database {
  prepare: (sql: string) => D1Statement;
}

interface D1Statement {
  bind: (...args: Array<string | number | null>) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<D1Result>;
}

interface D1Result {
  success: boolean;
}

export interface ErpnextMapping {
  id: number;
  erpnext_id: string;
  sync_status?: string;
}

export interface InvoiceResult {
  success: boolean;
  fromCache?: boolean;
  mappingId?: number | null;
  erpnextInvoiceId?: string;
  invoiceNumber?: string;
  message: string;
}

export interface VatData {
  success: boolean;
  invoice_number?: string;
}

export interface WorkerEnv {
  AURA_DB?: D1Database;
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
}

// ---------------------------------------------------------------------------
// ErpnextAccountingClient
// ---------------------------------------------------------------------------

export class ErpnextAccountingClient {
  client: ErpnextClient;
  auraDb: D1Database | null;

  constructor(client: ErpnextClient, auraDb?: D1Database) {
    this.client = client;
    this.auraDb = auraDb || null;
  }

  async processOrderToInvoice(order: OrderInput, env: WorkerEnv): Promise<InvoiceResult> {
    const db = env.AURA_DB || this.auraDb;

    const existingMapping = await this._findMapping(order.id, db);
    if (existingMapping) {
      return {
        success: true,
        fromCache: true,
        mappingId: existingMapping.id,
        erpnextInvoiceId: existingMapping.erpnext_id,
        message: 'Order already invoiced',
      };
    }

    try {
      const customer = await this._getOrCreateErpnextCustomer(order, env);

      let items: Array<Record<string, unknown>> = [];
      if (order.items) {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      }
      if (!Array.isArray(items)) items = [];

      const invoiceValues = mapOrderToInvoice(order, items, customer);

      const response = await this.client.create('Sales Invoice', invoiceValues as unknown as Record<string, unknown>);
      const invoiceName = (response.data as Record<string, unknown>)?.name as string | undefined;

      if (!invoiceName) {
        throw new Error('Failed to create Sales Invoice: no name returned from ERPNext');
      }

      const mappingId = await this._createMapping(order.id, invoiceName, 'synced', db);

      return {
        success: true,
        erpnextInvoiceId: invoiceName,
        mappingId,
        invoiceNumber: invoiceName,
        message: 'Invoice created successfully',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      await this._markMappingFailed(order.id, msg, db).catch(() => {});
      throw error;
    }
  }

  async getInvoiceByOrderId(orderId: string, env: WorkerEnv): Promise<Record<string, unknown> | null> {
    const db = env.AURA_DB || this.auraDb;

    const mapping = await this._findMapping(orderId, db);
    if (!mapping) return null;

    const response = await this.client.read('Sales Invoice', mapping.erpnext_id);
    const invoice = response.data as Record<string, unknown> | undefined;

    return invoice ? { ...invoice, mapping } : null;
  }

  async updateInvoiceVAT(invoiceId: string, vatData: VatData): Promise<boolean> {
    const updateValues = {
      custom_vat_submission_status: vatData.success ? 'Submitted' : 'Rejected',
      custom_vat_invoice_number: vatData.invoice_number || null,
      custom_vat_submitted_at: new Date().toISOString().split('T')[0],
    };

    await this.client.update('Sales Invoice', invoiceId, updateValues as unknown as Record<string, unknown>);
    return true;
  }

  async generateInvoicePDF(invoiceId: string): Promise<{ pdfUrl: string; invoiceId: string; generatedAt: string }> {
    const path = '/api/method/frappe.utils.print_format.download_pdf?doctype=Sales+Invoice&name=' + encodeURIComponent(invoiceId);

    return {
      pdfUrl: `${this.client.url}${path}`,
      invoiceId,
      generatedAt: new Date().toISOString(),
    };
  }

  // =====================================================================
  // Mapping persistence
  // =====================================================================

  private async _findMapping(orderId: string, db: D1Database | null): Promise<ErpnextMapping | null> {
    if (!db) return null;
    try {
      return await db.prepare(
        'SELECT id, erpnext_id, sync_status FROM erpnext_mappings WHERE local_type = ? AND local_id = ? LIMIT 1'
      ).bind('order', orderId).first<ErpnextMapping>();
    } catch {
      return null;
    }
  }

  private async _createMapping(orderId: string, erpnextId: string, status: string, db: D1Database | null): Promise<number | null> {
    if (!db) return null;
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO erpnext_mappings (local_type, local_id, erpnext_id, erpnext_model, sync_status, attempts, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).bind('order', orderId, erpnextId, 'Sales Invoice', status, now, now).run();

    const result = await db.prepare(
      'SELECT id FROM erpnext_mappings WHERE local_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(orderId).first<{ id: number }>();

    return result?.id || null;
  }

  private async _markMappingFailed(orderId: string, error: string, db: D1Database | null): Promise<void> {
    if (!db) return;
    await db.prepare(`
      UPDATE erpnext_mappings
      SET sync_status = 'failed',
          error_message = ?,
          attempts = attempts + 1,
          updated_at = datetime('now')
      WHERE local_type = ? AND local_id = ?
    `).bind(error, 'order', orderId).run();
  }

  // =====================================================================
  // Customer resolution
  // =====================================================================

  private async _getOrCreateErpnextCustomer(order: OrderInput, env: WorkerEnv): Promise<Record<string, unknown>> {
    if (!order.customer_phone && !order.customer_email) {
      return { customer_name: 'Walk-in Customer' };
    }

    if (order.customer_phone) {
      try {
        const response = await this.client.list('Customer', {
          filters: [['phone', '=', order.customer_phone]],
          fields: ['name', 'customer_name', 'phone', 'email'],
          limit: 1,
        });
        const customers = (response.data as Array<Record<string, unknown>>) || [];
        if (customers.length > 0) return customers[0];
      } catch {
        // Fall through to creation
      }
    }

    if (order.customer_email) {
      try {
        const response = await this.client.list('Customer', {
          filters: [['email_id', '=', order.customer_email]],
          fields: ['name', 'customer_name', 'phone', 'email'],
          limit: 1,
        });
        const customers = (response.data as Array<Record<string, unknown>>) || [];
        if (customers.length > 0) return customers[0];
      } catch {
        // Fall through to creation
      }
    }

    const customerValues = mapCustomerForInvoice({
      name: order.customer_name,
      full_name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      address: order.customer_address,
      id: order.customer_id,
    });

    const response = await this.client.create('Customer', customerValues as unknown as Record<string, unknown>);
    const customerName = (response.data as Record<string, unknown>)?.name as string | undefined;

    if (!customerName) {
      throw new Error('Failed to create ERPNext Customer');
    }

    return { ...customerValues, customer_name: customerName };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createErpnextAccountingClient(env: WorkerEnv): ErpnextAccountingClient | null {
  const client = createErpnextClient(env);
  if (!client) return null;
  return new ErpnextAccountingClient(client, env.AURA_DB);
}

export default ErpnextAccountingClient;
