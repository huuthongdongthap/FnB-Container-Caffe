/**
 * Odoo Integration Routes
 * Phase 1: Accounting & E-Invoicing
 *
 * Endpoints:
 * - POST /api/odoo/invoices - Create invoice in Odoo from order
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { createOdooClient } from '../clients/odoo-client.js';

/**
 * POST /api/odoo/invoices
 * Create Odoo invoice from completed order
 *
 * Body: { orderId: string }
 * Returns: { success: boolean, odooInvoiceId?: number, message?: string }
 */
export async function createOdooInvoice(request, env) {
  let orderId = null;
  try {
    const body = await request.json();
    orderId = body.orderId;

    if (!orderId) {
      return errorResponse('Missing orderId', 400);
    }

    // Fetch order with items
    const orderResult = await env.AURA_DB.prepare(`
      SELECT id, status, total, customer_name, customer_email, customer_phone, items, created_at
      FROM orders WHERE id = ?
    `).bind(orderId).first();

    if (!orderResult) {
      return errorResponse('Order not found', 404);
    }

    // Only allow invoice creation for completed orders
    if (orderResult.status !== 'completed') {
      return errorResponse(`Cannot create invoice for order with status: ${orderResult.status}. Order must be completed.`, 400);
    }

    // Parse items
    let items;
    try {
      items = typeof orderResult.items === 'string' ? JSON.parse(orderResult.items) : orderResult.items;
    } catch {
      return errorResponse('Invalid order items data', 400);
    }

    // Create Odoo client
    const odooClient = createOdooClient(env);
    if (!odooClient) {
      return errorResponse('Odoo integration not configured', 503);
    }

    // Create invoice (idempotent via mapping check)
    const result = await odooClient.createInvoice(orderResult, items);

    if (result.alreadySynced) {
      return jsonResponse({
        success: true,
        message: 'Order already has Odoo invoice',
        alreadySynced: true,
        mappingId: result.mappingId,
      });
    }

    return jsonResponse({
      success: true,
      odooInvoiceId: result.odooInvoiceId,
      mappingId: result.mappingId,
      message: 'Odoo invoice created successfully',
    });

  } catch (error) {
    // If Odoo API failed, create failed mapping entry for retry queue
    if (orderId) {
      try {
        const odooClient = createOdooClient(env);
        if (odooClient) {
          await odooClient.markMappingFailed('order', orderId, error.message);
        }
      } catch {
        // Ignore secondary errors
      }
    }

    return errorResponse(`Odoo invoice creation failed: ${error.message}`, 500);
  }
}

/**
 * GET /api/odoo/sync-status/:localType/:localId
 * Check sync status of a local entity
 */
export async function getOdooSyncStatus(request, env, localType, localId) {
  try {
    const mapping = await env.AURA_DB.prepare(`
      SELECT * FROM odoo_mappings
      WHERE local_type = ? AND local_id = ?
      LIMIT 1
    `).bind(localType, localId).first();

    if (!mapping) {
      return jsonResponse({
        success: true,
        synced: false,
        message: 'No sync record found',
      });
    }

    return jsonResponse({
      success: true,
      synced: mapping.sync_status === 'synced',
      status: mapping.sync_status,
      odooId: mapping.odoo_id,
      odooModel: mapping.odoo_model,
      attempts: mapping.attempts,
      lastSyncedAt: mapping.last_synced_at,
      errorMessage: mapping.error_message,
    });

  } catch (error) {
    return errorResponse(error.message || 'Failed to get sync status', 500);
  }
}

/**
 * GET /api/odoo/sync-failures
 * List all failed sync mappings (admin endpoint)
 */
export async function listOdooSyncFailures(request, env) {
  try {
    const { results } = await env.AURA_DB.prepare(`
      SELECT
        m.id, m.local_type, m.local_id, m.odoo_model,
        m.odoo_id, m.sync_status, m.error_message,
        m.attempts, m.last_synced_at, m.created_at,
        l.latency_ms, l.status as last_log_status, l.created_at as last_log_at
      FROM odoo_mappings m
      LEFT JOIN (
        SELECT mapping_id, status, latency_ms, created_at
        FROM odoo_sync_logs
        WHERE id IN (
          SELECT MAX(id) FROM odoo_sync_logs GROUP BY mapping_id
        )
      ) l ON l.mapping_id = m.id
      WHERE m.sync_status = 'failed'
      ORDER BY m.last_synced_at DESC
      LIMIT 100
    `).all();

    return jsonResponse({
      success: true,
      failures: results || [],
      total: results?.length || 0,
    });

  } catch (error) {
    return errorResponse(error.message || 'Failed to list sync failures', 500);
  }
}

/**
 * POST /api/odoo/retry/:mappingId
 * Manually retry a failed sync
 */
export async function retryOdooSync(request, env, mappingId) {
  try {
    const mapping = await env.AURA_DB.prepare(`
      SELECT * FROM odoo_mappings WHERE id = ?
    `).bind(mappingId).first();

    if (!mapping) {
      return errorResponse('Mapping not found', 404);
    }

    if (mapping.sync_status !== 'failed') {
      return jsonResponse({
        success: true,
        message: `Mapping is already ${mapping.sync_status}, skipping retry`,
      });
    }

    // Get the related order data
    if (mapping.local_type !== 'order') {
      return errorResponse('Only order mappings can be retried currently', 400);
    }

    const orderResult = await env.AURA_DB.prepare(`
      SELECT id, status, total, customer_name, customer_email, customer_phone, items, created_at
      FROM orders WHERE id = ?
    `).bind(mapping.local_id).first();

    if (!orderResult) {
      return errorResponse(`Local order ${mapping.local_id} not found`, 404);
    }

    let items;
    try {
      items = typeof orderResult.items === 'string' ? JSON.parse(orderResult.items) : orderResult.items;
    } catch {
      return errorResponse('Invalid order items data', 400);
    }

    // Re-initialize Odoo client and retry
    const odooClient = createOdooClient(env);
    if (!odooClient) {
      return errorResponse('Odoo integration not configured', 503);
    }

    // Clear failed status first
    await env.AURA_DB.prepare(`
      UPDATE odoo_mappings
      SET sync_status = 'synced', updated_at = datetime('now')
      WHERE id = ?
    `).bind(mappingId).run();

    // Retry invoice creation
    const result = await odooClient.createInvoice(orderResult, items);

    return jsonResponse({
      success: true,
      message: 'Retry successful',
      odooInvoiceId: result.odooInvoiceId,
      mappingId: mappingId,
    });

  } catch (error) {
    // Mark as failed again
    try {
      await env.AURA_DB.prepare(`
        UPDATE odoo_mappings
        SET sync_status = 'failed',
            error_message = ?,
            attempts = attempts + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(error.message, mappingId).run();
    } catch {
      // Ignore secondary errors
    }

    return errorResponse(`Retry failed: ${error.message}`, 500);
  }
}
