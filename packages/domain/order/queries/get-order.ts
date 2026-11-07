/**
 * Orders — Get order handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';

const log = createLogger({ route: 'orders' });

export async function getOrder(
  request: Request,
  env: Record<string, unknown>,
  id: string,
  tenantId?: string,
) {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const rawTenant = tenantId ? tenantId.trim() : '';
    const cleanTenant = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
    const hasTenantScope = Boolean(cleanTenant && cleanTenant !== '*');
    const tenantClause = hasTenantScope
      ? cleanTenant === 'default'
        ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
        : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?2)'
      : '';
    const binds = hasTenantScope ? [id, cleanTenant] : [id];
    const selectCols = cleanTenant
      ? 'id, status, total, shipping_fee, discount, payment_status, customer_name, customer_phone, customer_address, items, tenant_id, created_at, updated_at, points_earned, cashback_earned'
      : 'id, status, total, shipping_fee, discount, payment_status, customer_name, customer_phone, customer_address, items, created_at, updated_at, points_earned, cashback_earned';
    let results: Record<string, unknown>[] = [];
    try {
      const res = await db.prepare(
        `SELECT ${selectCols} FROM orders WHERE id = ?${tenantClause}`
      ).bind(...binds).all<Record<string, unknown>>();
      results = res.results ?? [];
    } catch {
      try {
        const res = await db.prepare(
          `SELECT * FROM orders WHERE id = ?${tenantClause}`
        ).bind(...binds).all<Record<string, unknown>>();
        results = res.results ?? [];
      } catch {
        if (!hasTenantScope || cleanTenant === 'default') {
          try {
            const res = await db.prepare(
              'SELECT id, status, total, shipping_fee, discount, payment_status, customer_name, customer_phone, customer_address, items, created_at, updated_at, points_earned, cashback_earned FROM orders WHERE id = ?'
            ).bind(id).all<Record<string, unknown>>();
            results = res.results ?? [];
          } catch {
            const res = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).all<Record<string, unknown>>();
            results = res.results ?? [];
          }
        }
      }
    }

    if (hasTenantScope && results.length > 0 && 'tenant_id' in results[0] && results[0].tenant_id !== undefined) {
      const rowTenant = (results[0].tenant_id && String(results[0].tenant_id).trim()) || 'default';
      if (rowTenant !== cleanTenant) {
        results = [];
      }
    }

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
    }

    let parsedItems: unknown = [];
    if (Array.isArray(results[0].items)) {
      parsedItems = results[0].items;
    } else if (typeof results[0].items === 'string' && results[0].items) {
      try {
        parsedItems = JSON.parse(results[0].items);
      } catch {
        parsedItems = [];
      }
    }

    const order: Record<string, unknown> = {
      ...results[0],
      items: parsedItems,
      total: parseInt(String(results[0].total ?? results[0].total_amount ?? 0), 10) || 0,
      shipping_fee: parseInt(String(results[0].shipping_fee || 0), 10) || 0,
      discount: parseInt(String(results[0].discount || 0), 10) || 0,
      points_earned: Number(results[0].points_earned ?? 0),
      cashback_earned: Number(results[0].cashback_earned ?? 0)
    };

    const rawOrderTenant =
      typeof order.tenant_id === 'string' && order.tenant_id.trim() ? order.tenant_id.trim() : '';
    const effectivePaymentTenant =
      rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq'
        ? rawOrderTenant
        : hasTenantScope
          ? cleanTenant
          : cleanTenant === '*'
            ? 'default'
            : '';

    let paymentResults: Record<string, unknown>[] = [];
    if (effectivePaymentTenant) {
      const payTenantClause =
        effectivePaymentTenant === 'default'
          ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
          : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?2)';
      try {
        const res = await db
          .prepare(`SELECT * FROM payments WHERE order_id = ?${payTenantClause}`)
          .bind(id, effectivePaymentTenant)
          .all<Record<string, unknown>>();
        paymentResults = res.results ?? [];
      } catch {
        const res = await db
          .prepare('SELECT * FROM payments WHERE order_id = ?')
          .bind(id)
          .all<Record<string, unknown>>()
          .catch(() => ({ results: [] }));
        const rawList = res.results ?? [];
        paymentResults =
          effectivePaymentTenant === 'default'
            ? rawList.filter((p) => {
                if (!p || !('tenant_id' in p) || p.tenant_id === undefined) return true;
                const pt = typeof p.tenant_id === 'string' && p.tenant_id.trim() ? p.tenant_id.trim() : 'default';
                return pt === 'default';
              })
            : rawList.filter((p) => {
                if (!p || !('tenant_id' in p) || p.tenant_id === undefined) return false;
                const pt = typeof p.tenant_id === 'string' && p.tenant_id.trim() ? p.tenant_id.trim() : 'default';
                return pt === effectivePaymentTenant;
              });
      }
    } else {
      const res = await db
        .prepare('SELECT * FROM payments WHERE order_id = ?')
        .bind(id)
        .all<Record<string, unknown>>();
      paymentResults = res.results ?? [];
    }

    order.payment = paymentResults[0] || null;
    order.payments = paymentResults;

    return jsonResponse({ success: true, order });
  } catch (error) {
    log.error('GetOrder error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch order', 500);
  }
}
