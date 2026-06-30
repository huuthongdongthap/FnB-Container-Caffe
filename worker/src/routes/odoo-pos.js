/**
 * Odoo POS Integration Routes — Phase 2
 *
 * Endpoints:
 * - POST /api/odoo/sales-orders — Create Odoo SO from local order
 * - GET /api/odoo/products/:productId/availability — Check stock (KV cached)
 * - POST /api/odoo/products/sync — Trigger product sync (admin only)
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { createOdooClient } from '../clients/odoo-client.js';
import { createOdooProductClient } from '../clients/odoo-product-client.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'odoo-pos' });

// ── Helpers ──

/** Generate unique sync ID for error tracking */
function generateSyncId() {
  return `SYNC_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

/** Fetch order with items from D1 */
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

/**
 * Map local order → Odoo sale.order values.
 * Inline simple mapping; full mapper comes in a later phase.
 *
 * @param {Object} order - Order DB row
 * @param {Array} items - Parsed order items
 * @returns {Object} sale.order field values
 */
function mapOrderToSaleOrderValues(order, items) {
  const partnerId = order.customer_id
    ? parseInt(order.customer_id, 10)
    : null;

  const orderLines = items.map((item) => {
    const productId = item.product_id ? parseInt(item.product_id, 10) : null;
    const quantity = item.quantity || item.qty || 1;
    const unitPrice = Math.round((item.price || item.unit_price || 0) * 100) / 100;

    return [
      0, // command: create new line
      0, // dummy id
      {
        product_id: productId,
        product_uom_qty: quantity,
        price_unit: unitPrice,
        name: item.name || item.product_name || 'Product',
      },
    ];
  });

  return {
    partner_id: partnerId,
    date_order: new Date().toISOString().split('T')[0],
    state: 'draft',
    x_aura_order_id: order.id,
    x_aura_order_status: order.status,
    order_line: orderLines,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. POST /api/odoo/sales-orders — Create Odoo SO from our order
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/odoo/sales-orders
 *
 * Body: { orderId: string }
 *
 * Creates an Odoo sale.order from a local order.
 * Idempotent: checks odoo_mappings first.
 *
 * @returns {success: boolean, saleOrderId?: number, mappingId?: number}
 */
export async function createOdooSalesOrder(request, env) {
  const syncId = generateSyncId();
  let orderId = null;
  let odooClient = null;

  try {
    const body = await request.json();
    orderId = body.orderId;

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

    // 2. Check existing mapping (idempotency)
    odooClient = createOdooClient(env);
    if (!odooClient) {
      return errorResponse('Odoo integration not configured', 503);
    }

    const existing = await odooClient.findMapping('order', orderId);
    if (existing && existing.sync_status === 'synced') {
      return jsonResponse({
        success: true,
        fromCache: true,
        orderId,
        saleOrderId: existing.odoo_id,
        mappingId: existing.id,
        message: 'Sales order already synced',
      });
    }

    // 3. Map order → SO values
    const soValues = mapOrderToSaleOrderValues(order, items);

    // 4. Create sale.order in Odoo
    const saleOrderId = await odooClient.create('sale.order', soValues);

    // 5. Save mapping
    await odooClient._createMapping(
      'order',
      orderId,
      saleOrderId,
      'sale.order',
      'synced'
    );

    return jsonResponse({
      success: true,
      orderId,
      saleOrderId,
      mappingId: existing?.id || null,
      message: 'Sales order created in Odoo',
    });
  } catch (error) {
    // Mark mapping as failed for retry
    if (orderId && odooClient) {
      try {
        await odooClient.markMappingFailed('order', orderId, error.message);
      } catch {
        // Ignore secondary errors
      }
    }

    return errorResponse({
      success: false,
      error: error.message,
      syncId,
      message: 'Sales order creation failed. Check logs for details.',
    }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. GET /api/odoo/products/:productId/availability — Check stock (KV cached)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/odoo/products/:productId/availability
 *
 * Returns product stock availability from Odoo, cached in KV for 30s.
 *
 * @returns {available: boolean, stock: number, estimatedRestock: string|null, cachedAt: string}
 */
export async function getProductAvailability(request, env, productId) {
  try {
    if (!productId) {
      return errorResponse('Missing productId', 400);
    }

    const productClient = createOdooProductClient(env);
    if (!productClient) {
      return errorResponse('Odoo integration not configured', 503);
    }

    const result = await productClient.getProductAvailability(productId);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error.message || 'Failed to check product availability', 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. POST /api/odoo/products/sync — Trigger product sync (admin only)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/odoo/products/sync
 *
 * Queries Odoo for products changed since last sync,
 * upserts into local products table.
 *
 * @returns {updated: number, errors: Array}
 */
export async function syncProducts(request, env) {
  try {
    const productClient = createOdooProductClient(env);
    if (!productClient) {
      return errorResponse('Odoo integration not configured', 503);
    }

    // Get last sync timestamp from odoo_product_sync
    const lastSyncRow = await env.AURA_DB.prepare(
      'SELECT MAX(odoo_write_date) as lastSync FROM odoo_product_sync WHERE odoo_write_date IS NOT NULL'
    ).first();

    const since = lastSyncRow?.lastSync || '1970-01-01T00:00:00';

    // Fetch changed products from Odoo
    const changedProducts = await productClient.searchChangedProducts(since);
    if (changedProducts.length === 0) {
      return jsonResponse({
        success: true,
        updated: 0,
        message: 'No products changed since last sync',
      });
    }

    // Sync to local DB
    const result = await productClient.syncProductsToLocal(changedProducts);

    return jsonResponse({
      success: true,
      updated: result.updated,
      errors: result.errors,
      message: `Synced ${result.updated} products`,
    });
  } catch (error) {
    return errorResponse(error.message || 'Product sync failed', 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. POST /api/webhooks/odoo — Odoo product change webhook (admin auth)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/webhooks/odoo
 *
 * Receives webhook from Odoo automation when a product is created/updated.
 * Body: { event: string, product_id: number, write_date: string }
 * Fire-and-forget: validates payload, queues sync via ctx.waitUntil, returns 200 fast.
 *
 * Requires admin auth (see index.js route registration).
 */
export async function handleOdooProductWebhook(request, env, ctx) {
  try {
    const body = await request.json();
    const { product_id, write_date } = body || {};

    if (!product_id || !write_date) {
      return errorResponse('Missing required fields: product_id and write_date', 400);
    }

    const productClient = createOdooProductClient(env);
    if (!productClient) {
      return errorResponse('Odoo integration not configured', 503);
    }

    // Fire-and-forget: fetch product from Odoo and sync to local DB
    const syncPromise = (async () => {
      const [product] = await productClient.odoo.searchRead(
        'product.product',
        [['id', '=', product_id]],
        ['id', 'default_code', 'list_price', 'qty_available', 'write_date']
      );

      if (!product) {
        log.warn('[Webhook] Odoo product not found:', product_id);
        return;
      }

      const result = await productClient.syncProductsToLocal([product]);
      log.info('[Webhook] Odoo product synced:', { product_id, updated: result.updated });
    })().catch(err => {
      log.error('[Webhook] Odoo product sync failed:', err.message);
    });

    if (ctx?.waitUntil) {
      ctx.waitUntil(syncPromise);
    }

    return jsonResponse({
      received: true,
      productId: product_id,
      message: `Processing product ${product_id}`,
    });
  } catch (error) {
    log.error('[Webhook] Odoo webhook handler error:', error.message);
    return errorResponse(error.message || 'Webhook handler failed', 500);
  }
}
