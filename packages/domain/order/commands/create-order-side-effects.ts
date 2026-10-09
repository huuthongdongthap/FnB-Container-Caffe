/**
 * Orders — Post-order side effects
 * Loyalty, notifications, inventory, analytics, ERPNext sync.
 */

import { createLogger } from 'worker/src/middleware/logger';
import { createMetricsCollector } from 'worker/src/lib/metrics-collector';
import { generateId } from '../model/helpers';
import { notifyTelegram } from '../notifications/telegram';
import { deductInventoryForOrder } from '@aura/domain-inventory';
import { syncOrderToERPNext } from 'worker/src/tree/erpnext/sync.js';
import type { OrderSnapshotResult } from '../policies/order-snapshot';

const log = createLogger({ route: 'orders:side-effects' });

export interface PostOrderParams {
  db: import('@cloudflare/workers-types').D1Database;
  env: Record<string, unknown>;
  ctx?: { waitUntil?: (p: Promise<unknown>) => void };
  orderId: string;
  data: {
    customer_name: string;
    customer_phone: string;
    customer_email?: string | null;
    customer_address?: string | null;
    customer_id?: string | null;
    table_id?: string | null;
    order_type?: string | null;
    notes?: string | null;
  };
  snapshot: OrderSnapshotResult;
  validatedMethod: string;
  resolvedTableId: string | null;
}

export async function runPostOrderSideEffects(params: PostOrderParams): Promise<void> {
  const { db, env, ctx, orderId, data, snapshot, validatedMethod, resolvedTableId } = params;

  let customerIdForCapture: string | null = data.customer_id || null;
  if (data.customer_email) {
    await db.prepare(`
      INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier)
      VALUES (?, ?, ?, ?, 0, 0, 'bronze')
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name, phone = excluded.phone, updated_at = CURRENT_TIMESTAMP
    `).bind(generateId('CUST_'), data.customer_email, data.customer_name, data.customer_phone).run();
    const linkedCust = await db.prepare('SELECT id FROM customers WHERE email = ?').bind(data.customer_email).first<{ id: string }>();
    if (linkedCust) customerIdForCapture = linkedCust.id;
  } else if (data.customer_phone) {
    const digits = String(data.customer_phone).replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 12) {
      const existing = await db.prepare('SELECT id FROM customers WHERE phone = ?').bind(digits).first<{ id: string }>();
      if (!existing) {
        const custId = generateId('CUST_');
        const now = new Date().toISOString();
        await db.batch([
          db.prepare(`
            INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 0, 'bronze', 'checkout', ?, ?)
          `).bind(custId, `${digits}@loyalty.aura`, data.customer_name, digits, now, now),
          db.prepare(`
            INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at)
            VALUES (?, ?, 0, 0, 0, ?, ?)
          `).bind(generateId('wal_'), custId, now, now),
        ]);
        customerIdForCapture = custId;
      } else {
        customerIdForCapture = existing.id;
      }
    }
  }

  if (customerIdForCapture && ctx?.waitUntil) {
    const captureCustId = customerIdForCapture;
    ctx.waitUntil((async () => {
      try {
        const { identifyCustomer, linkOrder } = await import('@aura/domain-customer');
        const identity = await identifyCustomer({
          db, customerId: captureCustId,
          phone: data.customer_phone, email: data.customer_email || undefined,
          source: 'checkout'
        });
        if (identity) {
          await linkOrder({
            db, customerId: captureCustId, orderId,
            total: snapshot.total, orderType: data.order_type || undefined
          });
        }
      } catch (custErr) {
        log.warn('Customer capture error (non-blocking):', { message: (custErr as Error).message, orderId });
      }
    })());
  }

  if (ctx?.waitUntil) {
    ctx.waitUntil(Promise.resolve(syncOrderToERPNext(
      {
        ERPNEXT_URL: (env as Record<string, string>).ERPNEXT_URL!,
        ERPNEXT_API_KEY: (env as Record<string, string>).ERPNEXT_API_KEY!,
        ERPNEXT_API_SECRET: (env as Record<string, string>).ERPNEXT_API_SECRET!
      },
      orderId,
      {
        customer_name: data.customer_name, customer_phone: data.customer_phone,
        customer_id: undefined, table_id: resolvedTableId,
        items: snapshot.items as unknown as Record<string, unknown>[],
        total: snapshot.total, payment_method: validatedMethod, notes: data.notes
      }
    )));
  }

  if (env.AUTH_KV) {
    const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    await kv.put('latest_order_ts', new Date().toISOString());
  }

  if (validatedMethod === 'cod') {
    const telegramPromise = notifyTelegram(env, {
      id: orderId, items: snapshot.items, total: snapshot.total,
      customer_name: data.customer_name, customer_phone: data.customer_phone,
      customer_address: data.customer_address, payment_method: validatedMethod,
      notes: data.notes
    }).catch(e => log.error('Telegram async error:', { message: (e as Error).message }));
    if (ctx?.waitUntil) ctx.waitUntil(telegramPromise);
    else await telegramPromise;
  }

  const { sendPushToStaff } = await import('worker/src/tree/push/notifier.js');
  // @ts-ignore -- PushEnv needs AURA_DB binding
  const pushPromise = sendPushToStaff(env, {
    title: 'Đơn hàng mới 🍳',
    body: `Bàn ${data.table_id || 'Mang đi'} — ${snapshot.items.length} món`,
    data: { url: '/kds', orderId }
  }, 'staff-kitchen').catch(e => log.warn('Push notify failed:', { message: (e as Error).message }));
  if (ctx?.waitUntil) ctx.waitUntil(pushPromise);

  if (ctx?.waitUntil) {
    const mc = createMetricsCollector(db);
    ctx.waitUntil(mc.recordMetric('order_created', snapshot.total, {
      payment_method: validatedMethod, is_anonymous: !data.customer_email
    }));
  }

  try {
    await deductInventoryForOrder(
      env as unknown as import('worker/src/types/env').Env,
      orderId,
      snapshot.items.map(i => ({ product_id: i.menuItemId, quantity: i.quantity, name: i.name }))
    );
  } catch (e) {
    log.warn('Inventory deduction failed for order', { orderId, message: (e as Error).message });
  }

  if (data.customer_email) {
    const { sendEmail } = await import('worker/src/lib/email.js');
    const { renderOrderConfirm } = await import('worker/src/templates/order-confirm.js');
    const paymentLabels: Record<string, string> = { cod: 'COD', payos: 'PayOS' };
    const emailPromise = sendEmail(env, {
      to: data.customer_email,
      subject: `Xác nhận đơn hàng #${orderId} — AURA CAFE`,
      html: renderOrderConfirm({
        id: orderId,
        items: snapshot.items.map(i => ({ name: i.name, qty: i.quantity, price: i.unitPriceCents })),
        total: snapshot.total,
        payment_method: paymentLabels[validatedMethod] || validatedMethod
      })
    }).catch(e => log.error('Email order confirm error:', { message: (e as Error).message }));
    if (ctx?.waitUntil) ctx.waitUntil(emailPromise);
  }
}
