      /**
 * Orders — Update order handler with state machine, loyalty, referrals, ERPNext triggers
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { parseJSON } from './helpers';
import { canTransition } from './order-state-machine';
import type { ErpnextEnv } from '../../clients/erpnext-client';
import type { WorkerEnv } from '../../clients/erpnext-accounting-client';

const log = createLogger({ route: 'orders' });

export async function updateOrder(request: Request, env: Record<string, unknown>, id: string) {
  try {
    const body = await parseJSON(request);
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

    // Fetch full row — needed for DO broadcast payload below
    const { results } = await db.prepare(
      'SELECT id, status, items, total, payment_status, customer_name, customer_phone, table_id, created_at FROM orders WHERE id = ?'
    ).bind(id).all<Record<string, unknown>>();

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
    }

    if (body.status !== undefined) {
      const currentStatus = results[0].status as string;
      const check = canTransition(currentStatus, body.status as string);
      if (!check.ok) return errorResponse(check.error!, 400);
    }

    const updatableFields = ['status', 'payment_status', 'notes', 'delivery_time'];
    const updates: string[] = [];
    const params: unknown[] = [];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
      }
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 1) {
      return errorResponse('No valid fields to update', 400);
    }

    params.push(id);
    const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
    await db.prepare(query).bind(...params).run();

    // Broadcast order status change via KV for SSE subscribers
    if (body.status !== undefined && env.AUTH_KV) {
      const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      kv.put(`order_event:${id}`, JSON.stringify({
        orderId: id,
        status: body.status,
        timestamp: new Date().toISOString()
      }), { expirationTtl: 60 }).catch(() => {});
    }

    // ── DO Broadcast (KDS + realtime clients) ──────────────────────
    // Mirror create-order.ts: publish post-update state so KDS dashboards
    // and any DO WebSocket subscribers see status changes live.
    if (body.status !== undefined && (env as Record<string, unknown>).ORDER_BROADCASTER) {
      const ns = (env as Record<string, unknown>).ORDER_BROADCASTER as import('@cloudflare/workers-types').DurableObjectNamespace;
      const stub = ns.get(ns.idFromName(id));
      const row = results[0];
      const items = typeof row.items === 'string' ? JSON.parse(row.items as string) : (row.items ?? []);
      ;(async () => {
        try {
          await (stub as unknown as { broadcast(msg: unknown): Promise<void> }).broadcast({
            orderId: id,
            status: body.status as string,
            payment_status: String(row.payment_status ?? 'unpaid'),
            items,
            total: Number(row.total ?? 0),
            customer_name: String(row.customer_name ?? ''),
            customer_phone: String(row.customer_phone ?? ''),
            table_id: row.table_id ? String(row.table_id) : null,
            createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
            updatedAt: Date.now(),
          });
        } catch (e) {
          log.warn('DO broadcast error (non-blocking):', { message: (e as Error).message, orderId: id });
        }
      })();
    }

    if (body.status === 'cancelled') {
  // Restore inventory (idempotent — no-op if no reserves exist)
  try {
    const { restoreInventoryForOrder } = await import('../../routes/inventory/order-deduction');
    await restoreInventoryForOrder(env as import('../../types/env').Env, id);
  } catch (invErr) {
    log.error('Inventory restore error (non-blocking):', { message: (invErr as Error).message, orderId: id });
  }

      const refRow = await db.prepare(
        'SELECT id FROM referrals WHERE first_order_id = ? AND status = \'completed\''
      ).bind(id).first<{ id: string }>();
      if (refRow) {
        try {
          const { reverseReferralCashback } = await import('../../routes/referrals');
          await reverseReferralCashback(db, refRow.id);
        } catch (revErr) {
          log.error('Reverse cashback error (non-blocking):', { message: (revErr as Error).message });
        }
      }
    }

    if (body.payment_status) {
      await db.prepare(`
        UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).bind(
        body.payment_status === 'paid' ? 'completed' : body.payment_status,
        id
      ).run();

    }

    if (env.AUTH_KV) {
      const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      await kv.put('latest_order_ts', new Date().toISOString());
    }

    	// Loyalty credit — single call, idempotent (skips if earn already exists)
	try {
		const { creditLoyaltyIfEligible } = await import('./loyalty-trigger');
		await creditLoyaltyIfEligible(db, env, id);
	} catch (loyaltyErr) {
		log.error('Loyalty credit error (non-blocking):', { message: (loyaltyErr as Error).message, orderId: id });
	}

if (['served', 'completed'].includes(body.status as string)) {

      // Customer-domain visit capture (additive — never blocks completion):
      // one visit row + VisitRecorded event per completed order.
      try {
        const order = await db.prepare(
          'SELECT total, order_type, table_id, customer_email, customer_phone FROM orders WHERE id = ?'
        ).bind(id).first<{ total: number; order_type: string | null; table_id: string | null; customer_email: string | null; customer_phone: string | null }>();

        if (order) {
          const normalizedPhone = String(order.customer_phone || '').replace(/\D/g, '');
          const visitCustomer = await db.prepare(
            'SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1'
          ).bind(order.customer_email, normalizedPhone).first<{ id: string }>();

          if (visitCustomer) {
            const { recordVisit } = await import('../customer');
            // dine_in + table_id = QR-table order; dine_in without = walk-in.
            const visitChannel: 'in_store' | 'qr_table' | 'online_pickup' | 'online_delivery' =
              order.order_type === 'delivery' ? 'online_delivery'
              : order.order_type === 'takeaway' ? 'online_pickup'
              : order.table_id ? 'qr_table'
              : 'in_store';
            const visitResult = await recordVisit({
              db, customerId: visitCustomer.id, orderId: id,
              spent: order.total, channel: visitChannel
            });
            if (visitResult.created) {
              log.info('Visit recorded', { customer_id: visitCustomer.id, order_id: id, channel: visitChannel });
            }
          }
        }
      } catch (visitErr) {
        log.warn('Visit capture error (non-blocking):', { message: (visitErr as Error).message, orderId: id });
      }

      try {
        const order = await db.prepare(
          'SELECT total, customer_email, customer_phone FROM orders WHERE id = ?'
        ).bind(id).first<{ total: number; customer_email: string | null; customer_phone: string | null }>();

        if (order && order.total >= 20000) {
          const customer = await db.prepare(
            'SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1'
          ).bind(order.customer_email, order.customer_phone).first<{ id: string }>();

          if (customer) {
            const { processReferralCashbackOnFirstOrder } = await import('../../routes/referrals');
            const result = await processReferralCashbackOnFirstOrder(
              db, customer.id, id, order.total
            );
            if (result.success) {
              log.info('Refer v3: +10k cashback granted', { customer_id: customer.id });
            }
          }
        }
      } catch (referErr) {
        log.warn('Refer v3 error (non-blocking):', { message: (referErr as Error).message });
      }

      // ERPNext e-invoice trigger (fire-and-forget, non-blocking)
      if (env.AUTH_KV) {
        (async() => {
          try {
            const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
            const erpnextUrl = await kv.get('erpnext:api_url');
            if (!erpnextUrl) {
              log.info('ERPNext not configured via KV, skipping e-invoice');
              return;
            }

            const orderRow = await db.prepare(
              'SELECT id, items, customer_phone, customer_email, customer_name, customer_address, total_amount, subtotal, tax, created_at, notes FROM orders WHERE id = ?'
            ).bind(id).first<Record<string, unknown>>();

            if (!orderRow) {
              log.warn('Order not found for ERPNext invoice', { order_id: id });
              return;
            }

            const { createErpnextClientWithKv } = await import('../../clients/erpnext-client');
            const { ErpnextAccountingClient } = await import('../../clients/erpnext-accounting-client');

            const erpnextClient = await createErpnextClientWithKv(env as unknown as ErpnextEnv & { AUTH_KV?: import('@cloudflare/workers-types').KVNamespace });
            if (!erpnextClient) {
              log.error('Failed to create ERPNext client despite KV config', { order_id: id });
              return;
            }

            const accountingClient = new ErpnextAccountingClient(erpnextClient, db);

            await accountingClient.processOrderToInvoice({
              id: orderRow.id as string,
              items: orderRow.items as string | Array<Record<string, unknown>> | undefined,
              customer_phone: orderRow.customer_phone as string | undefined,
              customer_email: orderRow.customer_email as string | undefined,
              customer_name: orderRow.customer_name as string | undefined,
              customer_address: orderRow.customer_address as string | undefined
            }, env as unknown as WorkerEnv);

            log.info('ERPNext e-invoice created', { order_id: id });
          } catch (erpErr) {
            log.error('ERPNext e-invoice error (non-blocking):', { message: (erpErr as Error).message, order_id: id });
          }
        })();
      }
    }

    return jsonResponse({
      success: true,
      message: 'Order updated successfully'
    });
  } catch (error) {
    log.error('UpdateOrder error:', { message: (error as Error).message });
    return errorResponse(`Failed to update order: ${(error as Error).message}`, 500);
  }
}
