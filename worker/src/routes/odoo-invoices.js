/**
 * Odoo Integration Routes — Phase 1 (Accounting)
 *
 * Handles order → invoice synchronization with Odoo ERP,
 * VAT e-invoice submission, and customer notifications.
 *
 * Endpoints:
 * - POST /api/odoo/invoices - Create invoice from order (owner only)
 * - GET /api/odoo/invoices/:orderId - Get invoice status
 * - POST /api/odoo/invoices/:orderId/retry - Manual retry (owner only)
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { createOdooAccountingClient } from '../clients/odoo-accounting-client.js';

/**
 * Helper: Generate unique sync ID for error tracking
 */
function generateSyncId() {
  return `SYNC_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Helper: Fetch order with items from D1
 * @private
 */
async function fetchOrderWithItems(env, orderId) {
  const order = await env.AURA_DB.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).bind(orderId).first();

  if (!order) {
    return null;
  }

  // Parse items JSON
  let items;
  try {
    items = JSON.parse(order.items || '[]');
  } catch (e) {
    throw new Error(`Invalid items JSON in order ${orderId}: ${e.message}`);
  }

  return { ...order, items };
}

/**
 * Helper: Create odoo_invoices record
 * @private
 */
async function createInvoiceRecord(env, orderId, odooInvoiceId, invoiceNumber, vatData = null) {
  const now = new Date().toISOString();
  await env.AURA_DB.prepare(`
    INSERT INTO odoo_invoices (
      order_id, odoo_invoice_id, invoice_number,
      vat_submission_status, vat_invoice_number, vat_signed_xml,
      submitted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
      odoo_invoice_id = excluded.odoo_invoice_id,
      invoice_number = excluded.invoice_number,
      vat_submission_status = excluded.vat_submission_status,
      vat_invoice_number = excluded.vat_invoice_number,
      vat_signed_xml = excluded.vat_signed_xml,
      submitted_at = excluded.submitted_at,
      updated_at = excluded.updated_at
  `).bind(
    orderId,
    odooInvoiceId,
    invoiceNumber,
    vatData?.status || 'pending',
    vatData?.invoice_number || null,
    vatData?.signed_xml || null,
    vatData?.submitted_at || null,
    now,
    now
  ).run();
}

/**
 * POST /api/odoo/invoices
 * Body: { orderId: string }
 *
 * Creates Odoo invoice from completed order, submits VAT, emails customer.
 * Owner only (protected by requireAuth middleware at route registration).
 */
export async function createOdooInvoice(request, env) {
  const syncId = generateSyncId();

  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return errorResponse('Missing required field: orderId', 400);
    }

    // 1. Fetch order with items
    const orderWithItems = await fetchOrderWithItems(env, orderId);
    if (!orderWithItems) {
      return errorResponse(`Order not found: ${orderId}`, 404);
    }

    const { items, ...order } = orderWithItems;

    if (items.length === 0) {
      return errorResponse(`Order ${orderId} has no items`, 400);
    }

    // Validate order is completed/completed before invoicing
    if (!['delivered', 'completed'].includes(order.status)) {
      return errorResponse(`Cannot invoice order with status: ${order.status}. Must be delivered or completed.`, 400);
    }

    // 2. Check existing invoice (idempotency via odoo_invoices table)
    const existingInvoice = await env.AURA_DB.prepare(
      'SELECT * FROM odoo_invoices WHERE order_id = ? LIMIT 1'
    ).bind(orderId).first();

    if (existingInvoice) {
      return jsonResponse({
        success: true,
        fromCache: true,
        orderId,
        odooInvoiceId: existingInvoice.odoo_invoice_id,
        invoiceNumber: existingInvoice.invoice_number,
        vatStatus: existingInvoice.vat_submission_status,
        message: 'Invoice already exists',
      });
    }

    // 3. Initialize Odoo client
    const accountingClient = createOdooAccountingClient(env);
    if (!accountingClient) {
      throw new Error('Odoo client not configured. Check ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY');
    }

    // 4. Create invoice in Odoo (with retry logic inside client)
    const result = await accountingClient.processOrderToInvoice(order, items);

    if (!result.success) {
      throw new Error(`Invoice creation failed: ${result.error || 'unknown error'}`);
    }

    // 5. Create local invoice record
    await createInvoiceRecord(env, orderId, result.odooInvoiceId, result.invoiceNumber, {
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });

    // 6. Generate PDF (placeholder for Phase 1)
    const pdfResult = await accountingClient.generateInvoicePDF(result.odooInvoiceId);

    // 7. Submit to VAT API (non-blocking - continue even if fails)
    let vatResult = null;
    try {
      vatResult = await submitToVATAPI(env, result.invoiceData);
    } catch {
      vatResult = {
        success: false,
        error: 'VAT submission failed',
        status: 'failed',
      };
    }

    // 8. Update invoice with VAT result
    if (vatResult) {
      await createInvoiceRecord(env, orderId, result.odooInvoiceId, result.invoiceNumber, {
        status: vatResult.success ? 'submitted' : 'rejected',
        invoice_number: vatResult.invoice_number,
        signed_xml: vatResult.signed_xml,
        submitted_at: vatResult.success ? new Date().toISOString() : null,
      });

      // If VAT failed, update mapping status
      if (!vatResult.success) {
        await accountingClient.odoo.markMappingFailed('order', orderId, `VAT submission failed: ${vatResult.error}`);
      }
    }

    // 9. Send email with PDF (non-blocking)
    if (order.customer_email) {
      sendInvoiceEmail(env, order, result, pdfResult).catch(() => {});
    }

    // 10. Return success response
    return jsonResponse({
      success: true,
      orderId,
      odooInvoiceId: result.odooInvoiceId,
      invoiceNumber: result.invoiceNumber,
      mappingId: result.mappingId,
      pdfUrl: pdfResult.pdfUrl,
      vatStatus: vatResult?.success ? 'submitted' : (vatResult?.status || 'pending'),
      vatInvoiceNumber: vatResult?.invoice_number || null,
      message: 'Invoice created and VAT submitted',
    }, 201);

  } catch (error) {
    // Try to create failure record in odoo_mappings if orderId available
    try {
      const body = await request.json();
      if (body.orderId) {
        const client = createOdooAccountingClient(env);
        if (client) {
          await client._markMappingFailed(body.orderId, error.message);
        }
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
 * POST /api/odoo/invoices/:orderId/retry
 * Manual retry for failed syncs (owner only)
 */
export async function retryOdooInvoice(request, env, orderId) {
  try {
    // Get the failed mapping
    const mapping = await env.AURA_DB.prepare(
      'SELECT * FROM odoo_mappings WHERE local_type = ? AND local_id = ? LIMIT 1'
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

    // Fetch order
    const orderWithItems = await fetchOrderWithItems(env, orderId);
    if (!orderWithItems) {
      return errorResponse(`Order not found: ${orderId}`, 404);
    }

    const { items, ...order } = orderWithItems;

    // Retry invoice creation
    const client = createOdooAccountingClient(env);
    if (!client) {
      throw new Error('Odoo client not configured');
    }

    // Note: In a full implementation, we'd have a retry method that handles
    // updating the existing mapping. For Phase 1, we'll attempt to create a new invoice
    // and update the mapping on success.
    const result = await client.processOrderToInvoice(order, items);

    return jsonResponse({
      success: result.success,
      attempt: mapping.attempts + 1,
      ...result,
      message: result.success ? 'Retry successful' : 'Retry failed',
    });

  } catch (error) {
    return errorResponse({
      success: false,
      error: error.message,
      orderId,
    }, 500);
  }
}

/**
 * GET /api/odoo/invoices/:orderId
 * Get invoice sync status
 */
export async function getOdooInvoice(request, env, orderId) {
  try {
    const mapping = await env.AURA_DB.prepare(
      `SELECT m.*, i.invoice_number, i.vat_submission_status, i.vat_invoice_number
       FROM odoo_mappings m
       LEFT JOIN odoo_invoices i ON m.local_id = i.order_id
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
        odooId: mapping.odoo_id,
        odooModel: mapping.odoo_model,
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
 * In production: Call VNInvoice/VNPT e-invoice API
 */
async function submitToVATAPI(env, odooInvoice) {
  const client = createOdooAccountingClient(env);
  if (!client) {
    throw new Error('Odoo client not configured');
  }

  // Check if VAT API configured
  if (!env.VNINVOICE_API_KEY) {
    return {
      success: false,
      error: 'VAT API not configured',
      status: 'pending',
    };
  }

  // Phase 1 placeholder: simulate success
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API latency
  return {
    success: true,
    invoice_number: `VAT-${odooInvoice.name || 'INV'}`,
    signed_xml: '<xml>placeholder VAT signature</xml>',
    submitted_at: new Date().toISOString(),
  };
}

/**
 * Send invoice email — non-blocking, uses SendGrid (Phase 1)
 * Falls back silently if email not configured or customer has no email
 */
async function sendInvoiceEmail(env, order, result, pdfResult) {
  if (!order.customer_email) {
    return;
  }

  const pdfUrl = pdfResult?.pdfUrl || result?.invoiceUrl || '';

  try {
    const { sendEmail } = await import('../lib/email.js');
    await sendEmail(env, {
      to: order.customer_email,
      subject: `Hóa đơn điện tử #${order.id} — AURA CAFE`,
      html: `<p>Kính gửi quý khách,</p>
<p>Hóa đơn điện tử cho đơn hàng <strong>#${order.id}</strong> đã sẵn sàng.</p>
<p>Tổng tiền: ${new Intl.NumberFormat('vi-VN').format(Math.round(order.total || 0))}₫</p>
${pdfUrl ? `<p><a href="${pdfUrl}">📄 Tải hóa đơn PDF</a></p>` : '<p>Hóa đơn đang được xử lý, chúng tôi sẽ gửi lại sau.</p>'}
<p>Vui lòng truy cập <a href="https://fnb-caffe-container.pages.dev/track-order.html?id=${order.id}">track-order</a> để xem chi tiết.</p>`,
    });
  } catch (_) {
    // Non-blocking — invoice email failure doesn't block Odoo sync
  }
}

