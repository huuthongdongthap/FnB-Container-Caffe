/**
 * Orders Routes
 * Converted from routes/orders.js with TypeScript + Zod validation.
 * Business logic preserved exactly — state machine, loyalty, referrals, ERPNext triggers.
 */

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { createOrderSchema, paymentMethodSchema } from '../lib/validators';

const log = createLogger({ route: 'orders' });

function generateId(prefix = 'ID_') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function parseJSON(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export async function notifyTelegram(env: Record<string, unknown>, order: Record<string, unknown>) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }
  try {
    const items = (order.items as Array<Record<string, unknown>> || []).map(i =>
      `• ${i.name} x${i.qty || i.quantity || 1}`
    ).join('\n');
    const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + '₫';
    const esc = (s: string) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const text = '🟎 <b>DON MBI — AURA CAFE</b>\n' +
      '━'.repeat(22) + '\n' +
      `📋 ${esc(order.id as string)}\n` +
      `👤 ${esc(order.customer_name as string)}\n` +
      `📞 ${esc(order.customer_phone as string)}\n` +
      ((order.customer_address as string) ? `📍 ${esc(order.customer_address as string)}\n` : '') +
      '━'.repeat(22) + '\n' +
      `${esc(items)}\n` +
      '━'.repeat(22) + '\n' +
      `💵 <b>${fmt(Number(order.total))}</b>\n` +
      `💳 ${esc(String(order.payment_method).toUpperCase())}\n` +
      ((order.notes as string) ? `📝 ${esc(order.notes as string)}\n` : '');
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const err = await res.text();
      log.error('Telegram HTTP', { status: res.status, error: err });
    }
  } catch (e) {
    log.error('Telegram notify failed:', { message: (e as Error).message });
  }
}

export async function createOrder(request: Request, env: Record<string, unknown>, ctx?: { waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const body = await parseJSON(request);
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }
    const data = parsed.data;
    // Zod validates payment_method as cod|payos per enum
    const validatedMethod = paymentMethodSchema.parse(data.payment_method);

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

    const orderId = generateId('ORD_');
    const itemsJson = JSON.stringify(data.items);

    await db.prepare(`
      INSERT INTO orders (
        id, items, total, status, customer_name, customer_phone,
        customer_email, customer_address, payment_method, payment_status,
        shipping_fee, discount, notes, delivery_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      itemsJson,
      parseInt(String(data.total)),
      'pending',
      data.customer_name,
      data.customer_phone,
      data.customer_email || null,
      data.customer_address || null,
      validatedMethod,
      'unpaid',
      parseInt(String(data.shipping_fee || 0)),
      parseInt(String(data.discount || 0)),
      data.notes || null,
      data.delivery_time || 'now'
    ).run();

    const paymentId = generateId('PAY_');
    await db.prepare(`
      INSERT INTO payments (id, order_id, method, amount, status)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      paymentId,
      orderId,
      validatedMethod,
      parseInt(String(data.total)),
      'pending'
    ).run();

    if (data.customer_email) {
      await db.prepare(`
        INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier)
        VALUES (?, ?, ?, ?, 0, 0, 'bronze')
        ON CONFLICT(email) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        generateId('CUST_'),
        data.customer_email,
        data.customer_name,
        data.customer_phone
      ).run();
    }

    if (env.AUTH_KV) {
      const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      await kv.put('latest_order_ts', new Date().toISOString());
    }

    if (validatedMethod === 'cod') {
      const telegramPromise = notifyTelegram(env, {
        id: orderId,
        items: data.items,
        total: data.total,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address,
        payment_method: validatedMethod,
        notes: data.notes,
      }).catch(e => log.error('Telegram async error:', { message: (e as Error).message }));
      if (ctx?.waitUntil) {
        ctx.waitUntil(telegramPromise);
      } else {
        await telegramPromise;
      }
    }

    if (data.customer_email) {
      const { sendEmail } = await import('../lib/email.js');
      const { renderOrderConfirm } = await import('../templates/order-confirm.js');
      const paymentLabels: Record<string, string> = { cod: 'COD', payos: 'PayOS' };
      const emailPromise = sendEmail(env, {
        to: data.customer_email,
        subject: `Xác nhận đơn hàng #${orderId} — AURA CAFE`,
        html: renderOrderConfirm({
          id: orderId,
          items: data.items.map(i => ({ name: i.name, qty: i.qty || i.quantity || 1, price: i.price || 0 })),
          total: Number(data.total),
          payment_method: paymentLabels[validatedMethod] || validatedMethod,
        }),
      }).catch(e => log.error('Email order confirm error:', { message: (e as Error).message }));
      if (ctx?.waitUntil) {
        ctx.waitUntil(emailPromise);
      }
    }

    return jsonResponse({
      success: true,
      order: {
        id: orderId,
        status: 'pending',
        payment_status: 'unpaid',
        items: data.items,
        total: parseInt(String(data.total)),
        customer: {
          full_name: data.customer_name,
          phone: data.customer_phone,
          address: data.customer_address || null,
        },
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address || null,
        payment_method: validatedMethod,
        shipping_fee: parseInt(String(data.shipping_fee || 0)),
        discount: parseInt(String(data.discount || 0)),
        notes: data.notes || null,
        delivery_time: data.delivery_time || 'now',
        created_at: new Date().toISOString(),
      },
      message: 'Order created successfully',
    }, 201);
  } catch (error) {
    log.error('CreateOrder error:', { message: (error as Error).message });
    return errorResponse('Failed to create order: ' + (error as Error).message, 500);
  }
}

export async function getOrder(request: Request, env: Record<string, unknown>, id: string) {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const { results } = await db.prepare(
      'SELECT id, status, total, payment_status, customer_name, customer_phone, customer_address, items, created_at, updated_at FROM orders WHERE id = ?'
    ).bind(id).all<Record<string, unknown>>();

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
    }

    const order: Record<string, unknown> = {
      ...results[0],
      items: JSON.parse(results[0].items as string),
      total: parseInt(results[0].total as string),
      shipping_fee: parseInt(String(results[0].shipping_fee || 0)),
      discount: parseInt(String(results[0].discount || 0)),
    };

    const { results: paymentResults } = await db.prepare(
      'SELECT * FROM payments WHERE order_id = ?'
    ).bind(id).all<Record<string, unknown>>();

    order.payment = paymentResults[0] || null;

    return jsonResponse({ success: true, order });
  } catch (error) {
    log.error('GetOrder error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch order: ' + (error as Error).message, 500);
  }
}

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
          const { reverseReferralCashback } = await import('./referrals');
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

    if (['delivered', 'completed'].includes(body.status as string)) {
      const existingEarn = await db.prepare(
        'SELECT id FROM cashback_transactions WHERE order_id = ? AND type = \'earn\' LIMIT 1'
      ).bind(id).first<{ id: string }>();

      if (!existingEarn) {
        const { processOrderLoyalty } = await import('./loyalty');
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
            const { processReferralCashbackOnFirstOrder } = await import('./referrals');
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
        const { createErpnextInvoice } = await import('./erpnext-invoices.js');
        (async () => {
          try {
            const mockRequest = { json: async () => ({ orderId: id }) } as Request;
            await createErpnextInvoice(mockRequest, env);
          } catch (erpnextErr) {
            log.error('ERPNext invoice sync failed:', { message: (erpnextErr as Error).message });
          }
        })().catch(err => log.error('ERPNext task failed:', { message: (err as Error).message }));
      } catch (erpnextSyncErr) {
        log.error('ERPNext sync initiation error (non-blocking):', { message: (erpnextSyncErr as Error).message });
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

export async function getLatestOrderTimestamp(request: Request, env: Record<string, unknown>) {
  try {
    const ts = env.AUTH_KV
      ? await (env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace).get('latest_order_ts')
      : null;
    return jsonResponse({ success: true, ts });
  } catch (error) {
    return errorResponse('Failed to get latest timestamp: ' + (error as Error).message, 500);
  }
}

export async function getAdminOrders(request: Request, env: Record<string, unknown>) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const paymentStatus = url.searchParams.get('payment_status');
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';
    const sort = url.searchParams.get('sort') || 'created_at';

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

    let query = 'SELECT id, status, total, payment_status, customer_name, customer_phone, created_at FROM orders WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (paymentStatus) {
      query += ' AND payment_status = ?';
      params.push(paymentStatus);
    }

    const validSorts = ['created_at', 'total', 'status'];
    const orderDirection = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
    const sortBy = validSorts.includes(sort) ? sort : 'created_at';

    query += ` ORDER BY ${sortBy} ${orderDirection} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await db.prepare(query).bind(...params).all<Record<string, unknown>>();

    const orders = results.map(order => ({
      ...order,
      items: JSON.parse(order.items as string),
      total: parseInt(order.total as string),
      shipping_fee: parseInt(String(order.shipping_fee || 0)),
      discount: parseInt(String(order.discount || 0)),
    }));

    const countQuery = 'SELECT COUNT(*) as total FROM orders WHERE 1=1' +
      (status ? ' AND status = ?' : '') +
      (paymentStatus ? ' AND payment_status = ?' : '');
    const countParams: unknown[] = [];
    if (status) { countParams.push(status); }
    if (paymentStatus) { countParams.push(paymentStatus); }

    const { results: countResult } = await db.prepare(countQuery).bind(...countParams).all<{ total: number }>();
    const total = countResult[0]?.total || 0;

    return jsonResponse({
      success: true,
      orders,
      pagination: {
        total: parseInt(total as unknown as string),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    log.error('GetAdminOrders error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch orders: ' + (error as Error).message, 500);
  }
}

export async function getStats(request: Request, env: Record<string, unknown>) {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { results: ordersTodayResult } = await db.prepare(`
      SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= ?
    `).bind(todayStart.toISOString()).all<{ total: number; revenue: number }>();

    const { results: statusResult } = await db.prepare(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `).all<{ status: string; count: number }>();

    const { results: topProducts } = await db.prepare(`
      SELECT items, COUNT(*) as order_count
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY items
      ORDER BY order_count DESC
      LIMIT 10
    `).all<{ items: string; order_count: number }>();

    const productStats: Record<string, number> = {};
    topProducts.forEach(row => {
      try {
        const items = JSON.parse(row.items) as Array<{ name: string; quantity?: number }>;
        items.forEach((item: { name: string; quantity?: number }) => {
          const name = item.name || 'Unknown';
          productStats[name] = (productStats[name] || 0) + (item.quantity || 1);
        });
      } catch { /* skip invalid JSON */ }
    });

    const topProductsList = Object.entries(productStats)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { results: revenueResult } = await db.prepare(`
      SELECT DATE(created_at) as date, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= ? AND status != 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).bind(sevenDaysAgo.toISOString()).all<{ date: string; revenue: number }>();

    return jsonResponse({
      success: true,
      stats: {
        orders_today: ordersTodayResult[0]?.total || 0,
        revenue_today: ordersTodayResult[0]?.revenue || 0,
        orders_by_status: statusResult.reduce((acc: Record<string, number>, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {}),
        top_products: topProductsList,
        revenue_7days: revenueResult.map(row => ({
          date: row.date,
          revenue: row.revenue,
        })),
      },
    });
  } catch (error) {
    log.error('GetStats error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch stats: ' + (error as Error).message, 500);
  }
}
