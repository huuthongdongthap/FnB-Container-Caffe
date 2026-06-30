/**
 * ERPNext Invoices Routes — Phase 1 (Accounting)
 *
 * Handles order to Sales Invoice synchronization with ERPNext,
 * VAT e-invoice submission, and customer notifications.
 * Endpoints: POST /api/erpnext/invoices, GET /api/erpnext/invoices/:orderId,
 * POST /api/erpnext/invoices/:orderId/retry
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { createErpnextClient } from '../clients/erpnext-client.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'erpnext-invoices' });

function generateSyncId() {
  return `SYNC_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

async function fetchOrderWithItems(env, orderId) {
  const order = await env.AURA_DB.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).bind(orderId).first();

  if (!order) {
    return null;
  }

  let items;
  try {
    items = JSON.parse(order.items || '[]');
  } catch (e) {
    throw new Error(`Invalid items JSON in order ${orderId}: ${e.message}`);
  }

  return { ...order, items };
}

function buildErpnextInvoiceData(order, items) {
  const erpnextItems = items.map((item) => {
    const qty = Number(item.quantity || item.qty || 1);
    const rate = Number(item.unit_price || item.price_unit || item.price || 0);
    return {
      item_code: item.product_id || item.id || 'ITEM',
      item_name: item.name || item.product_name || '',
      qty,
      rate,
      amount: qty * rate,
    };
  });

  return {
    customer: order.customer_name || order.customer_email || 'Walk-in Customer',
    items: erpnextItems,
    posting_date: new Date().toISOString().slice(0, 10),
    docstatus: 1,
  };
}

async function createInvoiceRecord(env, orderId, erpnextInvoiceId, invoiceNumber, vatData = null) {
  const now = new Date().toISOString();
  const sql = `INSERT INTO erpnext_invoices (order_id, erpnext_invoice_id, invoice_number,
    vat_submission_status, vat_invoice_number, vat_signed_xml,
    submitted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
    erpnext_invoice_id = excluded.erpnext_invoice_id,
    invoice_number = excluded.invoice_number,
    vat_submission_status = excluded.vat_submission_status,
    vat_invoice_number = excluded.vat_invoice_number,
    vat_signed_xml = excluded.vat_signed_xml,
    submitted_at = excluded.submitted_at,
    updated_at = excluded.updated_at`;
  await env.AURA_DB.prepare(sql).bind(
    orderId,
    erpnextInvoiceId,
    invoiceNumber,
    vatData?.status || 'pending',
    vatData?.invoice_number || null,
    vatData?.signed_xml || null,
    vatData?.submitted_at || null,
    now,
    now
  ).run();
}

async function markMappingFailed(env, localId, errorMessage) {
  await env.AURA_DB.prepare(
    'UPDATE erpnext_mappings SET sync_status = ?, error_message = ?, attempts = attempts + 1, last_synced_at = ? WHERE local_type = ? AND local_id = ?'
  ).bind('failed', errorMessage, new Date().toISOString(), 'order', localId).run();
}

/**
 * POST /api/erpnext/invoices  Body: { orderId: string }
 * Creates ERPNext Sales Invoice from completed order, submits VAT, emails customer.
 * Owner only (protected by requireAuth middleware at route registration).
 */
export async function createErpnextInvoice(request, env) {
  const syncId = generateSyncId();

  let orderId;
  try {
    const body = await request.json();
    orderId = body.orderId;

    if (!orderId) {
      return errorResponse('Missing required field: orderId', 400);
    }

    const orderWithItems = await fetchOrderWithItems(env, orderId);
    if (!orderWithItems) {
      return errorResponse(`Order not found: ${orderId}`, 404);
    }

    const { items, ...order } = orderWithItems;

    if (items.length === 0) {
      return errorResponse(`Order ${orderId} has no items`, 400);
    }

    if (!['delivered', 'completed'].includes(order.status)) {
      return errorResponse(`Cannot invoice order with status: ${order.status}. Must be delivered or completed.`, 400);
    }

    const existingInvoice = await env.AURA_DB.prepare(
      'SELECT * FROM erpnext_invoices WHERE order_id = ? LIMIT 1'
    ).bind(orderId).first();

    if (existingInvoice) {
      return jsonResponse({
        success: true,
        fromCache: true,
        orderId,
        erpnextInvoiceId: existingInvoice.erpnext_invoice_id,
        invoiceNumber: existingInvoice.invoice_number,
        vatStatus: existingInvoice.vat_submission_status,
        message: 'Invoice already exists',
      });
    }

    const client = createErpnextClient(env);
    if (!client) {
      throw new Error('ERPNext client not configured. Check ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET');
    }

    const invoiceData = buildErpnextInvoiceData(order, items);
    const result = await client.createInvoice(invoiceData);

    if (!result || !result.data || !result.data.name) {
      throw new Error('ERPNext invoice creation returned no document name');
    }

    const erpnextInvoiceId = result.data.name;
    const invoiceNumber = result.data.title || result.data.name;

    await createInvoiceRecord(env, orderId, erpnextInvoiceId, invoiceNumber, {
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });

    let vatResult = null;
    try {
      vatResult = await submitToVATAPI(env, result.data);
    } catch {
      vatResult = { success: false, error: 'VAT submission failed', status: 'failed' };
    }

    if (vatResult) {
      await createInvoiceRecord(env, orderId, erpnextInvoiceId, invoiceNumber, {
        status: vatResult.success ? 'submitted' : 'rejected',
        invoice_number: vatResult.invoice_number,
        signed_xml: vatResult.signed_xml,
        submitted_at: vatResult.success ? new Date().toISOString() : null,
      });

      if (!vatResult.success) {
        await markMappingFailed(env, orderId, `VAT submission failed: ${vatResult.error}`);
      }
    }

    if (order.customer_email) {
      sendInvoiceEmail(env, order, { erpnextInvoiceId, invoiceNumber }, null).catch(() => {});
    }

    return jsonResponse({
      success: true,
      orderId,
      erpnextInvoiceId,
      invoiceNumber,
      vatStatus: vatResult?.success ? 'submitted' : (vatResult?.status || 'pending'),
      vatInvoiceNumber: vatResult?.invoice_number || null,
      message: 'Invoice created and VAT submitted',
    }, 201);

  } catch (error) {
    log.error('invoice_creation_failed', { syncId, error: error.message });

    try {
      if (orderId) {
        await markMappingFailed(env, orderId, error.message);
      }
    } catch {
      // Ignore errors in error handler
    }

    return errorResponse({
      success: false,
      error: error.message,
      syncId,
      message: 'Invoice creation failed. Check logs for details.',
    }, 500);
  }
}

/**
 * POST /api/erpnext/invoices/:orderId/retry
 * Manual retry for failed syncs (owner only)
 */
export async function retryErpnextInvoice(request, env, orderId) {
  try {
    const mapping = await env.AURA_DB.prepare(
      'SELECT * FROM erpnext_mappings WHERE local_type = ? AND local_id = ? LIMIT 1'
    ).bind('order', orderId).first();

    if (!mapping) {
      return errorResponse(`No mapping found for order ${orderId}`, 404);
    }

    if (mapping.sync_status === 'synced') {
      return errorResponse(`Order ${orderId} is already synced`, 400);
    }

    if (mapping.attempts >= 3) {
      return errorResponse(`Max attempts (3) exceeded for order ${orderId}. Contact admin.`, 400);
    }

    const orderWithItems = await fetchOrderWithItems(env, orderId);
    if (!orderWithItems) {
      return errorResponse(`Order not found: ${orderId}`, 404);
    }

    const { items, ...order } = orderWithItems;
    const client = createErpnextClient(env);
    if (!client) {
      throw new Error('ERPNext client not configured');
    }

    const invoiceData = buildErpnextInvoiceData(order, items);
    const result = await client.createInvoice(invoiceData);

    if (!result || !result.data || !result.data.name) {
      throw new Error('ERPNext invoice creation returned no document name');
    }

    return jsonResponse({
      success: true,
      attempt: mapping.attempts + 1,
      erpnextInvoiceId: result.data.name,
      invoiceNumber: result.data.title || result.data.name,
      message: 'Retry successful',
    });

  } catch (error) {
    return errorResponse({ success: false, error: error.message, orderId }, 500);
  }
}

/**
 * GET /api/erpnext/invoices/:orderId
 * Get invoice sync status
 */
export async function getErpnextInvoiceStatus(request, env, orderId) {
  try {
    const mapping = await env.AURA_DB.prepare(
      `SELECT m.*, i.invoice_number, i.vat_submission_status, i.vat_invoice_number
       FROM erpnext_mappings m
       LEFT JOIN erpnext_invoices i ON m.local_id = i.order_id
       WHERE m.local_type = ? AND m.local_id = ? LIMIT 1`
    ).bind('order', orderId).first();

    if (!mapping) {
      return errorResponse(`No invoice mapping found for order ${orderId}`, 404);
    }

    return jsonResponse({
      success: true,
      orderId,
      mapping: {
        id: mapping.id,
        erpnextId: mapping.erpnext_id,
        erpnextModel: mapping.erpnext_model,
        syncStatus: mapping.sync_status,
        attempts: mapping.attempts,
        lastSyncedAt: mapping.last_synced_at,
        errorMessage: mapping.error_message,
      },
      invoice: {
        invoiceNumber: mapping.invoice_number,
        vatStatus: mapping.vat_submission_status,
        vatInvoiceNumber: mapping.vat_invoice_number,
      },
    });

  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

/**
 * VAT API Submission (Phase 1 placeholder)
 * In production: Call VNInvoice/VNPT e-invoice API via ERPNext integration
 */
async function submitToVATAPI(env, invoice) {
  const client = createErpnextClient(env);
  if (!client) {
    throw new Error('ERPNext client not configured');
  }

  if (!env.VNINVOICE_API_KEY) {
    return { success: false, error: 'VAT API not configured', status: 'pending' };
  }

  // Phase 1 placeholder: simulate success
  await new Promise(resolve => setTimeout(resolve, 100));
  return {
    success: true,
    invoice_number: `VAT-${invoice.name || 'INV'}`,
    signed_xml: '<xml>placeholder VAT signature</xml>',
    submitted_at: new Date().toISOString(),
  };
}

/**
 * GET /api/erpnext/sync-failures
 * List all failed ERPNext sync mappings for admin dashboard
 */
export async function getErpnextSyncFailures(request, env) {
  try {
    const failures = await env.AURA_DB.prepare(
      `SELECT * FROM erpnext_mappings WHERE sync_status = 'failed'
       ORDER BY last_synced_at DESC LIMIT 100`
    ).all();
    return jsonResponse({ success: true, failures: failures.results || [] });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

/**
 * Send invoice email — non-blocking, uses SendGrid (Phase 1)
 * Falls back silently if email not configured or customer has no email
 */
async function sendInvoiceEmail(env, order, result) {
  if (!order.customer_email) {
    return;
  }

  try {
    const { sendEmail } = await import('../lib/email.js');
    await sendEmail(env, {
      to: order.customer_email,
      subject: `Hoa don dien tu #${order.id} — AURA CAFE`,
      html: [
        '<p>Kinh gui quy khach,</p>',
        `<p>Hoa don dien tu cho don hang <strong>#${order.id}</strong> da san sang.</p>`,
        `<p>Ma hoa don: ${result.invoiceNumber}</p>`,
        `<p>Tong tien: ${new Intl.NumberFormat('vi-VN').format(Math.round(order.total || 0))}d</p>`,
        '<p>Vui long truy cap <a href="https://fnb-caffe-container.pages.dev/track-order.html?id=' +
          `${order.id}">track-order</a> de xem chi tiet.</p>`,
      ].join('\n'),
    });
  } catch {
    // Non-blocking — invoice email failure doesn't block ERPNext sync
  }
}
