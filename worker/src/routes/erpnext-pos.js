/**
 * ERPNext POS Integration Routes — Phase 2
 * Endpoints: POST /api/erpnext/sales-orders, GET /api/erpnext/products/:productId/availability,
 * POST /api/erpnext/products/sync, POST /api/webhooks/erpnext
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { createErpnextClient } from '../clients/erpnext-client.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'erpnext-pos' });

// ── Helpers ──

function generateSyncId() {
  return `SYNC_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

async function fetchOrderWithItems(env, orderId) {
  const order = await env.AURA_DB.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).bind(orderId).first();
  if (!order) {return null;}
  let items;
  try { items = JSON.parse(order.items || '[]'); } catch (e) {
    throw new Error(`Invalid items JSON in order ${orderId}: ${e.message}`);
  }
  return { ...order, items };
}

function mapOrderToSalesOrderValues(order, items) {
  const soItems = items.map((item) => ({
    item_code: item.product_id || item.sku || item.product_code || item.name || 'Unknown',
    qty: item.quantity || item.qty || 1,
    rate: Math.round((item.price || item.unit_price || 0) * 100) / 100,
  }));
  return {
    customer: order.customer_name || order.customer_id || '',
    transaction_date: new Date().toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0],
    order_type: 'Sales',
    items: soItems,
  };
}

// ── D1 Mapping helpers (ErpnextClient has no mapping methods) ──

async function findMapping(env, localType, localId) {
  return env.AURA_DB.prepare(
    'SELECT * FROM erpnext_mappings WHERE local_type = ? AND local_id = ? LIMIT 1'
  ).bind(localType, localId).first();
}

async function upsertMapping(env, localType, localId, erpnextId, erpnextModel, status, error = null) {
  await env.AURA_DB.prepare(
    `INSERT INTO erpnext_mappings (local_type, local_id, erpnext_id, erpnext_model, sync_status, error_message, attempts, last_synced_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
     ON CONFLICT(local_type, local_id) DO UPDATE SET
       erpnext_id = excluded.erpnext_id, erpnext_model = excluded.erpnext_model,
       sync_status = excluded.sync_status, error_message = excluded.error_message,
       attempts = erpnext_mappings.attempts + 1, last_synced_at = datetime('now')`
  ).bind(localType, localId, erpnextId, erpnextModel, status, error).run();
}

async function markMappingFailed(env, localType, localId, error) {
  await env.AURA_DB.prepare(
    `UPDATE erpnext_mappings SET sync_status = 'failed', error_message = ?,
     attempts = attempts + 1, last_synced_at = datetime('now')
     WHERE local_type = ? AND local_id = ?`
  ).bind(error, localType, localId).run();
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. createErpnextSalesOrder — POST /api/erpnext/sales-orders
// ═══════════════════════════════════════════════════════════════════════════

export async function createErpnextSalesOrder(request, env) {
  const syncId = generateSyncId();
  let orderId = null;
  let erpnextClient = null;
  try {
    const body = await request.json();
    orderId = body.orderId;
    if (!orderId) {return errorResponse('Missing required field: orderId', 400);}

    const orderWithItems = await fetchOrderWithItems(env, orderId);
    if (!orderWithItems) {return errorResponse(`Order not found: ${orderId}`, 404);}
    const { items, ...order } = orderWithItems;
    if (items.length === 0) {return errorResponse(`Order ${orderId} has no items`, 400);}

    if (!['delivered', 'completed'].includes(order.status)) {
      return errorResponse(`Cannot create sales order for order with status: ${order.status}. Must be delivered or completed.`, 400);
    }

    erpnextClient = createErpnextClient(env);
    if (!erpnextClient) {return errorResponse('ERPNext integration not configured', 503);}

    const existing = await findMapping(env, 'order', orderId);
    if (existing && existing.sync_status === 'synced') {
      return jsonResponse({ success: true, fromCache: true, orderId, salesOrderName: existing.erpnext_id, mappingId: existing.id, message: 'Sales order already synced' });
    }

    const soValues = mapOrderToSalesOrderValues(order, items);
    const created = await erpnextClient.create('Sales Order', soValues);
    const salesOrderName = created?.data?.name || null;
    await upsertMapping(env, 'order', orderId, salesOrderName, 'Sales Order', 'synced');

    return jsonResponse({ success: true, orderId, salesOrderName, mappingId: existing?.id || null, message: 'Sales order created in ERPNext' });
  } catch (error) {
    if (orderId) { try { await markMappingFailed(env, 'order', orderId, error.message); } catch {} }
    return errorResponse({ success: false, error: error.message, syncId, message: 'Sales order creation failed. Check logs for details.' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. getErpnextProductAvailability — GET /api/erpnext/products/:id/availability
// ═══════════════════════════════════════════════════════════════════════════

export async function getErpnextProductAvailability(request, env, productId) {
  try {
    if (!productId) {return errorResponse('Missing productId', 400);}
    const cacheKey = `erpnext:product:availability:${productId}`;

    if (env.ERPNEXT_KV) {
      const cached = await env.ERPNEXT_KV.get(cacheKey, 'json');
      if (cached && cached.cachedAt && Date.now() - cached.cachedAt < 30000) {
        return jsonResponse({ ...cached, fromCache: true });
      }
    }

    const client = createErpnextClient(env);
    if (!client) {return errorResponse('ERPNext integration not configured', 503);}

    const result = await client.getProductAvailability(productId);
    const response = { item: result.item, stock: result.stock, cachedAt: Date.now() };

    if (env.ERPNEXT_KV) {
      await env.ERPNEXT_KV.put(cacheKey, JSON.stringify(response), { expirationTtl: 60 });
    }
    return jsonResponse(response);
  } catch (error) {
    return errorResponse(error.message || 'Failed to check product availability', 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. syncErpnextProducts — POST /api/erpnext/products/sync
// ═══════════════════════════════════════════════════════════════════════════

export async function syncErpnextProducts(request, env) {
  try {
    const client = createErpnextClient(env);
    if (!client) {return errorResponse('ERPNext integration not configured', 503);}

    let since = '1970-01-01 00:00:00';
    if (env.ERPNEXT_KV) {
      const stored = await env.ERPNEXT_KV.get('erpnext_product_last_sync');
      if (stored) {since = stored;}
    }

    const result = await client.searchModified('Item', since, [
      'name', 'item_code', 'item_name', 'description', 'stock_uom', 'item_group', 'modified',
    ]);
    const changedItems = result.data || [];
    if (changedItems.length === 0) {
      return jsonResponse({ success: true, updated: 0, message: 'No products changed since last sync' });
    }

    const errors = [];
    let updated = 0;
    for (const item of changedItems) {
      try {
        await env.AURA_DB.prepare(
          `INSERT INTO products (id, name, description, uom, item_group, erpnext_modified, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, description = excluded.description,
             uom = excluded.uom, item_group = excluded.item_group,
             erpnext_modified = excluded.erpnext_modified, updated_at = datetime('now')`
        ).bind(
          item.item_code || item.name, item.item_name || item.name,
          item.description || null, item.stock_uom || null,
          item.item_group || null, item.modified || null
        ).run();
        updated++;
      } catch (err) {
        errors.push({ item: item.name, error: err.message });
        log.error('[ERPNext POS] Sync item failed:', err.message);
      }
    }

    const now = new Date().toISOString().replace('T', ' ').split('.')[0];
    if (env.ERPNEXT_KV) {
      await env.ERPNEXT_KV.put('erpnext_product_last_sync', now);
      await env.AURA_DB.prepare(
        'INSERT INTO erpnext_product_sync (erpnext_write_date, synced_at, items_count) VALUES (?, datetime(\'now\'), ?)'
      ).bind(now, changedItems.length).run();
    }

    return jsonResponse({ success: true, updated, errors: errors.length > 0 ? errors : undefined, message: `Synced ${updated} products with ${errors.length} errors` });
  } catch (error) {
    return errorResponse(error.message || 'Product sync failed', 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. handleErpnextProductWebhook — POST /api/webhooks/erpnext
// ═══════════════════════════════════════════════════════════════════════════

export async function handleErpnextProductWebhook(request, env, ctx) {
  try {
    const body = await request.json();
    const { doc, event, doctype } = body || {};
    if (!doc || !event || doctype !== 'Item') {
      return errorResponse('Invalid ERPNext webhook: expected { doc, event: "on_update", doctype: "Item" }', 400);
    }

    const client = createErpnextClient(env);
    if (!client) {return errorResponse('ERPNext integration not configured', 503);}

    const syncPromise = (async () => {
      try {
        const itemResponse = await client.read('Item', doc.name);
        const item = itemResponse.data;
        if (!item) { log.warn('[ERPNext POS] Item not found:', doc.name); return; }

        await env.AURA_DB.prepare(
          `INSERT INTO products (id, name, description, uom, item_group, erpnext_modified, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, description = excluded.description,
             uom = excluded.uom, item_group = excluded.item_group,
             erpnext_modified = excluded.erpnext_modified, updated_at = datetime('now')`
        ).bind(
          item.item_code || item.name, item.item_name || item.name,
          item.description || null, item.stock_uom || null,
          item.item_group || null, item.modified || null
        ).run();

        log.info('[ERPNext POS] Product synced from webhook:', { item_code: doc.name });
      } catch (err) {
        log.error('[ERPNext POS] Webhook sync failed:', err.message);
      }
    })();

    if (ctx?.waitUntil) {ctx.waitUntil(syncPromise);}

    return jsonResponse({ received: true, itemCode: doc.name, message: `Processing item ${doc.name}` });
  } catch (error) {
    log.error('[ERPNext POS] Webhook handler error:', error.message);
    return errorResponse(error.message || 'Webhook handler failed', 500);
  }
}
