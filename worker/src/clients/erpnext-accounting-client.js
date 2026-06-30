/**
 * ErpnextAccountingClient — Invoice sync operations.
 *
 * Handles the full Sales Invoice lifecycle:
 * - Order to Sales Invoice mapping and creation
 * - Invoice retrieval via order ID
 * - VAT e-invoice custom field updates
 * - PDF invoice generation
 *
 * Uses ErpnextClient for REST operations and erpnext-mapper.js
 * for data transformation.
 *
 * @example
 * const client = createErpnextAccountingClient(env);
 * const result = await client.processOrderToInvoice(order, env);
 * const invoice = await client.getInvoiceByOrderId(orderId, env);
 */

import { createErpnextClient } from './erpnext-client.js';
import { mapOrderToInvoice, mapCustomerForInvoice } from '../lib/erpnext-mapper.js';

/**
 * ErpnextAccountingClient — Invoice lifecycle management
 */
export class ErpnextAccountingClient {
  /**
   * @param {import('./erpnext-client').ErpnextClient} client - Authenticated ERPNext REST client
   * @param {Object} [auraDb] - D1 database binding (used for mapping persistence)
   */
  constructor(client, auraDb) {
    /** @type {import('./erpnext-client').ErpnextClient} */
    this.client = client;
    /** @type {Object|null} */
    this.auraDb = auraDb || null;
  }

  /**
   * Complete order to invoice flow.
   *
   * Flow:
   * 1. Check idempotency via erpnext_mappings table
   * 2. Look up or create ERPNext Customer from order data
   * 3. Map order items to Sales Invoice using erpnext-mapper
   * 4. POST /api/resource/Sales Invoice
   * 5. Record mapping in erpnext_mappings for idempotency
   *
   * @param {Object} order - Order from D1
   * @param {Object} env - Cloudflare environment (AURA_DB)
   * @returns {Promise<Object>} Result with invoice and mapping info
   * @throws {Error} If invoice creation fails
   */
  async processOrderToInvoice(order, env) {
    const db = env.AURA_DB || this.auraDb;

    // Idempotency: check if already processed
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
      // Get or create ERPNext Customer
      const customer = await this._getOrCreateErpnextCustomer(order, env);

      // Parse items
      let items = [];
      if (order.items) {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      }
      if (!Array.isArray(items)) {
        items = [];
      }

      // Map order to invoice values using erpnext-mapper
      const invoiceValues = mapOrderToInvoice(order, items, customer);

      // Create invoice in ERPNext
      const response = await this.client.create('Sales Invoice', invoiceValues);
      const invoiceName = response.data?.name;

      if (!invoiceName) {
        throw new Error('Failed to create Sales Invoice: no name returned from ERPNext');
      }

      // Create mapping record
      const mappingId = await this._createMapping(order.id, invoiceName, 'synced', db);

      return {
        success: true,
        erpnextInvoiceId: invoiceName,
        mappingId,
        invoiceNumber: invoiceName,
        message: 'Invoice created successfully',
      };
    } catch (error) {
      // Mark mapping as failed
      await this._markMappingFailed(order.id, error.message, db).catch(() => {});
      throw error;
    }
  }

  /**
   * Get invoice by local order ID.
   *
   * Looks up the mapping in erpnext_mappings and fetches the
   * Sales Invoice from ERPNext.
   *
   * @param {string} orderId - Local order ID
   * @param {Object} env - Cloudflare environment (AURA_DB)
   * @returns {Promise<Object|null>} Invoice data with mapping info, or null
   */
  async getInvoiceByOrderId(orderId, env) {
    const db = env.AURA_DB || this.auraDb;

    const mapping = await this._findMapping(orderId, db);
    if (!mapping) {
      return null;
    }

    const response = await this.client.read('Sales Invoice', mapping.erpnext_id);
    const invoice = response.data;

    return invoice ? { ...invoice, mapping } : null;
  }

  /**
   * Update invoice with VAT submission result.
   *
   * Sets custom VAT fields on the Sales Invoice:
   * - custom_vat_submission_status
   * - custom_vat_invoice_number
   * - custom_vat_submitted_at
   *
   * @param {string} invoiceId - ERPNext Sales Invoice name/ID
   * @param {Object} vatData - VAT submission result
   * @param {boolean} vatData.success - Whether VAT submission succeeded
   * @param {string} [vatData.invoice_number] - VAT invoice number
   * @returns {Promise<boolean>} True on success
   */
  async updateInvoiceVAT(invoiceId, vatData) {
    const updateValues = {
      custom_vat_submission_status: vatData.success ? 'Submitted' : 'Rejected',
      custom_vat_invoice_number: vatData.invoice_number || null,
      custom_vat_submitted_at: new Date().toISOString().split('T')[0],
    };

    await this.client.update('Sales Invoice', invoiceId, updateValues);
    return true;
  }

  /**
   * Generate PDF for an invoice via ERPNext print format endpoint.
   *
   * Returns the PDF URL. The caller is responsible for fetching
   * and serving the PDF bytes.
   *
   * @param {string} invoiceId - ERPNext Sales Invoice name/ID
   * @returns {Promise<{pdfUrl: string, invoiceId: string, generatedAt: string}>} PDF info
   */
  async generateInvoicePDF(invoiceId) {
    const path = '/api/method/frappe.utils.print_format.download_pdf?doctype=Sales+Invoice&name=' + encodeURIComponent(invoiceId);

    return {
      pdfUrl: `${this.client.url}${path}`,
      invoiceId,
      generatedAt: new Date().toISOString(),
    };
  }

  // =====================================================================
  // Mapping persistence helpers
  // =====================================================================

  /**
   * Find existing mapping for an order ID.
   * @param {string} orderId - Local order ID
   * @param {Object|null} db - D1 database
   * @returns {Promise<Object|null>} Mapping record or null
   */
  async _findMapping(orderId, db) {
    if (!db) {return null;}
    try {
      return await db.prepare(
        'SELECT id, erpnext_id, sync_status FROM erpnext_mappings WHERE local_type = ? AND local_id = ? LIMIT 1'
      ).bind('order', orderId).first();
    } catch {
      return null;
    }
  }

  /**
   * Create a new mapping record.
   * @param {string} orderId - Local order ID
   * @param {string} erpnextId - ERPNext document name/ID
   * @param {string} status - Sync status (synced, failed, pending)
   * @param {Object|null} db - D1 database
   * @returns {Promise<number|null>} Inserted mapping ID
   */
  async _createMapping(orderId, erpnextId, status, db) {
    if (!db) {return null;}
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO erpnext_mappings (local_type, local_id, erpnext_id, erpnext_model, sync_status, attempts, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).bind('order', orderId, erpnextId, 'Sales Invoice', status, now, now).run();

    const result = await db.prepare(
      'SELECT id FROM erpnext_mappings WHERE local_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(orderId).first();

    return result?.id || null;
  }

  /**
   * Mark a mapping as failed.
   * @param {string} orderId - Local order ID
   * @param {string} error - Error message
   * @param {Object|null} db - D1 database
   */
  async _markMappingFailed(orderId, error, db) {
    if (!db) {return;}
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

  /**
   * Get or create ERPNext Customer from order data.
   *
   * Searches by phone first, falls back to email, then creates
   * a new Customer record if none found.
   *
   * @param {Object} order - Order from D1
   * @param {Object} env - Cloudflare environment (AURA_DB)
   * @returns {Promise<Object>} ERPNext Customer data
   */
  async _getOrCreateErpnextCustomer(order, env) {
    // If no contact info, return a walk-in customer
    if (!order.customer_phone && !order.customer_email) {
      return { customer_name: 'Walk-in Customer' };
    }

    // Look up existing customer by phone
    if (order.customer_phone) {
      try {
        const response = await this.client.list('Customer', {
          filters: [['phone', '=', order.customer_phone]],
          fields: ['name', 'customer_name', 'phone', 'email'],
          limit: 1,
        });
        const customers = response.data || [];
        if (customers.length > 0) {
          return customers[0];
        }
      } catch {
        // Fall through to creation
      }
    }

    // Look up existing customer by email
    if (order.customer_email) {
      try {
        const response = await this.client.list('Customer', {
          filters: [['email_id', '=', order.customer_email]],
          fields: ['name', 'customer_name', 'phone', 'email'],
          limit: 1,
        });
        const customers = response.data || [];
        if (customers.length > 0) {
          return customers[0];
        }
      } catch {
        // Fall through to creation
      }
    }

    // Create new customer using the mapper
    const customerValues = mapCustomerForInvoice({
      name: order.customer_name,
      full_name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      address: order.customer_address,
      id: order.customer_id,
    });

    const response = await this.client.create('Customer', customerValues);
    const customerName = response.data?.name;

    if (!customerName) {
      throw new Error('Failed to create ERPNext Customer');
    }

    return { customer_name: customerName, ...customerValues };
  }
}

/**
 * Factory function.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @returns {ErpnextAccountingClient|null}
 */
export function createErpnextAccountingClient(env) {
  const client = createErpnextClient(env);
  if (!client) {return null;}
  return new ErpnextAccountingClient(client, env.AURA_DB);
}

export default ErpnextAccountingClient;
