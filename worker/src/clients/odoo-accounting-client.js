/**
 * OdooAccountingClient — Invoice sync operations
 *
 * Extends OdooClient with domain-specific logic for:
 * - Order → Invoice mapping
 * - Invoice → VAT e-invoice mapping
 * - Error handling and retry coordination
 *
 * Phase 1: Accounting integration
 */

import { OdooClient } from './odoo-client.js';

/**
 * Mapping helpers for AURA → Odoo data transformation
 */
export const InvoiceMappers = {
  /**
   * Map AURA order to Odoo account.move values
   * @param {Object} order - Order from D1
   * @param {Array} items - Parsed order items
   * @param {number} odooCustomerId - Odoo partner ID
   * @returns {Object} invoiceValues for Odoo create
   */
  mapOrderToInvoice(order, items, odooCustomerId) {
    if (!order || !items || !odooCustomerId) {
      throw new Error('Invalid inputs for mapOrderToInvoice');
    }

    const invoiceDate = new Date(order.created_at || Date.now()).toISOString().split('T')[0];

    // Build invoice lines (Odoo command format: [0, 0, { ... }])
    const invoiceLines = items.map(item => {
      const quantity = item.quantity || item.qty || 1;
      const unitPrice = this._parsePrice(item.price || item.unit_price || 0);
      const name = item.name || item.product_name || 'Product';

      return [
        0,
        0,
        {
          name,
          quantity,
          price_unit: unitPrice,
          product_id: null, // Will be resolved by Odoo product search/creation
          account_id: null, // Will use default income account
          tax_ids: [],
        },
      ];
    });

    return {
      move_type: 'out_invoice',
      partner_id: odooCustomerId,
      invoice_date: invoiceDate,
      invoice_line_ids: invoiceLines,
      ref: `AURA-${order.id}`,
      x_aura_order_id: order.id,
      currency_id: 1,
    };
  },

  /**
   * Map Odoo invoice to VAT e-invoice submission format
   * @param {Object} odooInvoice - Odoo invoice record
   * @param {Object} order - Original order
   * @param {Array} items - Order items
   * @returns {Object} VAT submission payload
   */
  mapInvoiceForVAT(odooInvoice, order, items) {
    if (!odooInvoice || !order) {
      throw new Error('Invalid inputs for mapInvoiceForVAT');
    }

    const subtotal = items.reduce((sum, item) => {
      const qty = item.quantity || item.qty || 1;
      const price = this._parsePrice(item.price || item.unit_price || 0);
      return sum + (qty * price);
    }, 0);

    const taxRate = 0.10;
    const taxAmount = Math.round(subtotal * taxRate);
    const total = subtotal + taxAmount;

    return {
      invoice_number: odooInvoice.name || `AURA-${order.id}`,
      invoice_date: odooInvoice.invoice_date,
      seller: {
        name: 'AURA CAFE',
        tax_code: '0107645889',
        address: '123 Lê Lợi, Quận 1, TP.HCM',
        phone: '0909123456',
        email: 'billing@aura.cafe',
      },
      buyer: {
        name: order.customer_name,
        tax_code: null,
        address: order.customer_address || '',
        phone: order.customer_phone,
        email: order.customer_email || '',
      },
      items: items.map(item => ({
        description: item.name || item.product_name,
        quantity: item.quantity || item.qty || 1,
        unit_price: this._parsePrice(item.price || item.unit_price || 0),
        unit: 'cái',
        tax_rate: taxRate * 100,
      })),
      subtotal: Math.round(subtotal),
      tax_amount: taxAmount,
      total: Math.round(total),
      currency: 'VND',
      payment_method: order.payment_method,
    };
  },

  _parsePrice(value) {
    if (typeof value === 'number') {return value;}
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.]/g, '');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  },
};

/**
 * OdooAccountingClient — Invoice lifecycle management
 */
export class OdooAccountingClient {
  constructor(odooClient, auraDb) {
    this.odoo = odooClient;
    this.auraDb = auraDb;
    this.mappers = InvoiceMappers;
  }

  /**
   * Complete order → invoice flow (VAT and email handled by caller)
   * @param {Object} order - Order from D1
   * @param {Array} items - Parsed order items
   * @returns {Promise<Object>} Result with invoice and mapping info
   */
  async processOrderToInvoice(order, items) {
    // Idempotency: check if already processed
    const existingMapping = await this._findMapping(order.id);
    if (existingMapping) {
      return {
        success: true,
        fromCache: true,
        mappingId: existingMapping.id,
        odooInvoiceId: existingMapping.odoo_id,
        message: 'Order already invoiced',
      };
    }

    try {
      // Get or create Odoo customer partner
      const odooCustomerId = await this._getOrCreateOdooPartner(order);

      // Map order to invoice values
      const invoiceValues = this.mappers.mapOrderToInvoice(order, items, odooCustomerId);

      // Create invoice in Odoo (with mapping)
      const odooInvoiceId = await this.odoo.create('account.move', invoiceValues);

      // Create mapping record
      const mappingId = await this._createMapping(order.id, odooInvoiceId, 'synced');

      // Read back the created invoice
      const [odooInvoice] = await this.odoo.read('account.move', [odooInvoiceId], [
        'name', 'invoice_date', 'amount_total', 'state'
      ]);

      if (!odooInvoice) {
        throw new Error('Created invoice not found in Odoo');
      }

      return {
        success: true,
        odooInvoiceId,
        mappingId,
        invoiceNumber: odooInvoice.name,
        invoiceData: odooInvoice,
        message: 'Invoice created successfully',
      };
    } catch (error) {
      // Mark mapping as failed if we got an Odoo ID
      const match = error.message?.match(/ID (\d+)/);
      if (match) {
        await this._markMappingFailed(order.id, error.message);
      }
      throw error;
    }
  }

  /**
   * Find existing mapping for order
   * @private
   */
  async _findMapping(orderId) {
    const stmt = this.auraDb.prepare(
      'SELECT id, odoo_id, sync_status FROM odoo_mappings WHERE local_type = ? AND local_id = ? LIMIT 1'
    ).bind('order', orderId);
    return await stmt.first();
  }

  /**
   * Create mapping record
   * @private
   */
  async _createMapping(orderId, odooInvoiceId, status, error = null) {
    const now = new Date().toISOString();
    const stmt = this.auraDb.prepare(`
      INSERT INTO odoo_mappings (local_type, local_id, odoo_id, odoo_model, sync_status, error_message, attempts, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    await stmt.bind('order', orderId, odooInvoiceId, 'account.move', status, error, now, now).run();

    // Get the inserted row ID
    const result = await this.auraDb.prepare(
      'SELECT id FROM odoo_mappings WHERE local_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(orderId).first();
    return result?.id;
  }

  /**
   * Mark mapping as failed
   * @private
   */
  async _markMappingFailed(orderId, error) {
    const stmt = this.auraDb.prepare(`
      UPDATE odoo_mappings
      SET sync_status = 'failed',
          error_message = ?,
          attempts = attempts + 1,
          updated_at = datetime('now')
      WHERE local_type = ? AND local_id = ?
    `);
    await stmt.bind(error, 'order', orderId).run();
  }

  /**
   * Get or create Odoo partner from order data
   * @private
   */
  async _getOrCreateOdooPartner(order) {
    const domain = [];

    if (order.customer_email) {
      domain.push(['email', '=', order.customer_email]);
    }
    if (order.customer_phone) {
      if (domain.length) {domain.push('|');}
      domain.push(['phone', '=', order.customer_phone]);
    }

    if (domain.length) {
      const existing = await this.odoo.search('res.partner', domain, { limit: 1 });
      if (existing && existing.length > 0) {
        return existing[0].id;
      }
    }

    // Create new partner
    const partnerValues = {
      name: order.customer_name || 'Unknown Customer',
      email: order.customer_email || '',
      phone: order.customer_phone || '',
      company_type: 'person',
      customer_rank: 1,
    };

    return await this.odoo.create('res.partner', partnerValues);
  }

  /**
   * Get invoice by local order ID
   * @returns {Promise<Object|null>}
   */
  async getInvoiceByOrderId(orderId) {
    const mapping = await this._findMapping(orderId);
    if (!mapping) {
      return null;
    }

    const [invoice] = await this.odoo.read('account.move', [mapping.odoo_id], [
      'name', 'invoice_date', 'amount_total', 'state', 'partner_id'
    ]);

    return invoice ? { ...invoice, mapping } : null;
  }

  /**
   * Update invoice with VAT submission result
   * @param {number} odooInvoiceId - Odoo invoice ID
   * @param {Object} vatResult - VAT submission response
   */
  async updateInvoiceVAT(odooInvoiceId, vatResult) {
    const updateValues = {
      x_vat_submission_status: vatResult.success ? 'submitted' : 'rejected',
      x_vat_invoice_number: vatResult.invoice_number || null,
      x_vat_signed_xml: vatResult.signed_xml || null,
      x_vat_submitted_at: new Date().toISOString().split('T')[0],
    };

    return await this.odoo.update('account.move', odooInvoiceId, updateValues);
  }

  /**
   * Generate PDF invoice (placeholder)
   * @param {number} odooInvoiceId - Odoo invoice ID
   * @returns {Promise<Object>} PDF info
   */
  async generateInvoicePDF(odooInvoiceId) {
    return {
      pdfUrl: `/api/odoo/invoices/${odooInvoiceId}/pdf`,
      generatedAt: new Date().toISOString(),
      note: 'Phase 1 placeholder - actual PDF generation in Phase 2',
    };
  }
}

/**
 * Factory function
 */
export function createOdooAccountingClient(env) {
  try {
    const odooClient = new OdooClient({
      url: env.ODOO_URL,
      db: env.ODOO_DB,
      username: env.ODOO_USERNAME,
      apiKey: env.ODOO_API_KEY,
    });
    return new OdooAccountingClient(odooClient, env.AURA_DB);
  } catch {
    return null;
  }
}

export default OdooAccountingClient;
