/**
 * Orders — Update order handler with state machine, loyalty, referrals, ERPNext triggers
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { parseJSON } from './helpers';
import type { InvoiceEnv } from '../../routes/erpnext-invoices';

const log = createLogger({ route: 'orders' });

const ORDER_STATE_MACHINE: Record<string, string[]> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['preparing', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['served', 'delivered', 'cancelled'],
  served:     ['completed'],
  delivered:  ['completed'],
  completed:  [],
  cancelled:  [],
};

export async function updateOrder(request: Request, env: Record<string, unknown>, id: string) {
  try {
    const body = await parseJSON(request);
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

    const { results } = await db.prepare(
      'SELECT id, status FROM orders WHERE id = ?'
    ).bind(id).all<Record<string, unknown>>();

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
    }

    if (body.status !== undefined) {
      const currentStatus = results[0].status as string;
      const allowed = ORDER_STATE_MACHINE[currentStatus] || [];
      if (!allowed.includes(body.status as string) && body.status !== currentStatus) {
        return errorResponse(
          `Invalid transition: ${currentStatus} → ${body.status}. Allowed: ${allowed.join(', ') || 'none (terminal)'}`,
          400
        );
      }
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

    if (body.status === 'cancelled') {
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

    if (body.status === 'served') {
      // Auto-release table when order is served
      try {
        const orderRow = await db.prepare(
          'SELECT table_id FROM orders WHERE id = ?'
        ).bind(id).first<{ table_id: string | null }>();
        if (orderRow?.table_id) {
          await db.prepare(
            "UPDATE cafe_tables SET status = 'Available', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(orderRow.table_id).run();
        }
      } catch (tableErr) {
        log.error('Table auto-release error (non-blocking):', { message: (tableErr as Error).message });
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

    if (['delivered', 'completed'].includes(body.status as string)) {
      const existingEarn = await db.prepare(
        'SELECT id FROM cashback_transactions WHERE order_id = ? AND type = \'earn\' LIMIT 1'
      ).bind(id).first<{ id: string }>();

      if (!existingEarn) {
        const { processOrderLoyalty } = await import('../../routes/loyalty');
        await processOrderLoyalty(id, env);
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

      try {
        log.info('ERPNext invoice trigger for order', { order_id: id });
        const { handleErpnextInvoicesRequest } = await import('../../routes/erpnext-invoices');
        (async () => {
          try {
            const mockRequest = new Request('https://internal/api/erpnext-invoices/create', {
              method: 'POST',
              body: JSON.stringify({ id }),
            });
            await handleErpnextInvoicesRequest(mockRequest, env as unknown as InvoiceEnv);
          } catch (erpnextErr) {
            log.error('ERPNext invoice sync failed:', { message: (erpnextErr as Error).message });
          }
        })().catch(err => log.error('ERPNext task failed:', { message: (err as Error).message }));
      } catch (erpnextSyncErr) {
        log.error('ERPNext sync initiation error (non-blocking):', { message: (erpnextSyncErr as Error).message });
      }
    }

    // Fire push notification on status change
    if (body.status) {
      const pushMessages: Record<string, { title: string; body: string }> = {
        confirmed: { title: 'AURA CAFE', body: 'Đơn hàng của bạn đã được xác nhận!' },
        preparing: { title: 'AURA CAFE', body: 'Đơn hàng của bạn đang được chuẩn bị...' },
        ready: { title: '☕ Đơn hàng sẵn sàng!', body: 'Đơn hàng của bạn đã sẵn sàng. Mời bạn ra quầy nhận!' },
        served: { title: 'AURA CAFE', body: 'Cảm ơn bạn đã ghé AURA CAFE! Hẹn gặp lại.' },
      };

      const msg = pushMessages[body.status as string];
      if (msg) {
        try {
          const { sendPushToCustomer } = await import('../push/notifier.js');
          // Don't await — fire and forget
          sendPushToCustomer(env as never, null, {
            title: msg.title,
            body: msg.body,
            icon: '/images/favicon-192x192.png',
            badge: '/images/favicon-192x192.png',
            data: { orderId: id, status: body.status },
            actions: [
              { action: 'view', title: 'Xem đơn hàng' },
            ],
          }).catch(e => log.error('Push notification error:', { message: (e as Error).message }));
        } catch (pushErr) {
          log.error('Push module load error (non-blocking):', { message: (pushErr as Error).message });
        }
      }
    }

    return jsonResponse({
      success: true,
      message: 'Order updated successfully',
    });
  } catch (error) {
    log.error('UpdateOrder error:', { message: (error as Error).message });
    return errorResponse('Failed to update order: ' + (error as Error).message, 500);
  }
}
