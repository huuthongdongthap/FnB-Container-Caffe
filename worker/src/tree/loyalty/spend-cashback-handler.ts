/**
 * Spend Cashback Handler - POST /api/loyalty/spend-cashback
 * Deduct cashback wallet balance toward an order with validation.
 */
import type { Context } from 'hono';
import { spendCashbackSchema } from '../../lib/validators';
import { resolvePilotStore } from '../../lib/pilot-store';
import type { Env } from '../../types/env';
import type { Customer, CashbackWallet } from '../../types/models';

const MIN_ORDER_TO_SPEND = 20000;

function makeCashbackTxId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `cb_${Date.now()}_${rand}`;
}

export async function handleSpendCashback(c: Context<{ Bindings: Env }>) {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = spendCashbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const { order_id, amount } = parsed.data;

  const custAny = cust as unknown as { tenant_id?: string | null; tenantId?: string | null };
  const custTenantRaw = custAny.tenant_id ?? custAny.tenantId;
  const custTenant = (custTenantRaw && String(custTenantRaw).trim()) || '';
  let storeTenant = custTenant || 'default';
  if (c.env?.PILOT_TENANT_ID) {
    try {
      storeTenant = resolvePilotStore(c.env as unknown as Record<string, unknown>);
    } catch {
      // keep fallback
    }
  }
  const queryTenant = (
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    ''
  ).trim();
  const headerTenant = (
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (queryTenant && headerTenant && queryTenant !== headerTenant) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const requestedTenant = queryTenant || headerTenant;
  if (
    custTenant === '*' ||
    custTenant.toLowerCase() === 'hq' ||
    (requestedTenant && (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq' || requestedTenant !== storeTenant)) ||
    (custTenant && custTenant !== storeTenant)
  ) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  let existingSpend: { id: string } | null = null;
  try {
    existingSpend = await db.prepare(
      "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'spend' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
    ).bind(order_id, storeTenant).first<{ id: string }>();
  } catch (spendCheckErr) {
    if (storeTenant !== 'default') {
      throw spendCheckErr;
    }
    existingSpend = await db.prepare(
      "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'spend' LIMIT 1"
    ).bind(order_id).first<{ id: string }>();
  }
  if (existingSpend) {
    return c.json({ success: false, error: 'Ví đã được dùng cho đơn này' }, 409);
  }

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(order_id).first<{
    total_amount?: number;
    total?: number;
    cashback_used?: number | null;
    cashback_used_vnd?: number | null;
    customer_id?: string | null;
    customer_phone?: string | null;
    tenant_id?: string | null;
    status?: string | null;
    payment_status?: string | null;
  }>();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }
  const orderStatus = order.status ? String(order.status).trim().toLowerCase() : '';
  const paymentStatus = order.payment_status ? String(order.payment_status).trim().toLowerCase() : '';
  if (
    orderStatus === 'cancelled' ||
    orderStatus === 'canceled' ||
    orderStatus === 'rejected' ||
    orderStatus === 'failed' ||
    orderStatus === 'expired' ||
    orderStatus === 'refunded' ||
    orderStatus === 'completed' ||
    paymentStatus === 'refunded' ||
    paymentStatus === 'failed' ||
    paymentStatus === 'cancelled' ||
    paymentStatus === 'canceled' ||
    paymentStatus === 'paid'
  ) {
    return c.json({ success: false, error: 'Order is not eligible for cashback spend' }, 400);
  }
  if ('customer_id' in order && order.customer_id !== undefined) {
    const orderCustId = order.customer_id ? String(order.customer_id).trim() : '';
    const phoneMatch = Boolean(
      !orderCustId &&
      order.customer_phone &&
      cust.phone &&
      String(order.customer_phone).trim() === String(cust.phone).trim()
    );
    if (orderCustId !== cust.id && !phoneMatch) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
  }
  if (Number(order.cashback_used ?? order.cashback_used_vnd ?? 0) > 0) {
    return c.json({ success: false, error: 'Ví đã được dùng cho đơn này' }, 409);
  }
  if ('tenant_id' in order && order.tenant_id !== undefined) {
    const orderTenant = (order.tenant_id && String(order.tenant_id).trim()) || 'default';
    if (custTenantRaw !== undefined) {
      const normalizedCustTenant = custTenant || 'default';
      if (orderTenant !== normalizedCustTenant) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
    }
    if ((c.env.PILOT_TENANT_ID || custTenantRaw === undefined) && (c.env.PILOT_TENANT_ID || (order.tenant_id && String(order.tenant_id).trim())) && orderTenant !== storeTenant) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
  }

  const orderTotal = Number(order.total_amount ?? order.total ?? 0);

  if (orderTotal < MIN_ORDER_TO_SPEND) {
    return c.json({
      success: false,
      error: `Don toi thieu ${MIN_ORDER_TO_SPEND.toLocaleString('vi-VN')}d de dung vi cashback`,
      min_order: MIN_ORDER_TO_SPEND
    }, 400);
  }

  const maxAllowed = Math.round(orderTotal * 0.5);
  if (amount > maxAllowed) {
    return c.json({ success: false, error: 'Toi da 50% gia tr? don hang', max_allowed: maxAllowed }, 400);
  }

  let wallet: (CashbackWallet & { tenant_id?: string | null }) | null = null;
  try {
    wallet = await db.prepare("SELECT * FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(cust.id, storeTenant).first<CashbackWallet & { tenant_id?: string | null }>();
  } catch (walletErr) {
    if (storeTenant !== 'default') {
      throw walletErr;
    }
    wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(cust.id).first<CashbackWallet & { tenant_id?: string | null }>();
  }
  if (wallet && 'tenant_id' in wallet && wallet.tenant_id !== undefined) {
    const walletTenant = (wallet.tenant_id && String(wallet.tenant_id).trim()) || 'default';
    if (walletTenant !== storeTenant) {
      wallet = null;
    }
  }
  if (!wallet) {
    return c.json({ success: false, error: 'Vi khong ton tai', balance: 0 }, 400);
  }

  const newBalance = wallet.balance - amount;
  if (newBalance < 0) {
    return c.json({ success: false, error: 'So du khong du', balance: wallet.balance }, 400);
  }

  const now = new Date().toISOString();
  let updateResult;
  try {
    updateResult = await db.prepare(
      "UPDATE cashback_wallets SET balance = balance - ?, total_spent = total_spent + ?, updated_at = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND balance >= ?"
    ).bind(amount, amount, now, cust.id, storeTenant, amount).run();
  } catch (walletUpdateErr) {
    if (storeTenant !== 'default') {
      throw walletUpdateErr;
    }
    updateResult = await db.prepare(
      'UPDATE cashback_wallets SET balance = balance - ?, total_spent = total_spent + ?, updated_at = ? WHERE customer_id = ? AND balance >= ?'
    ).bind(amount, amount, now, cust.id, amount).run();
  }

  if ((updateResult.meta?.changes ?? (updateResult as unknown as { changes?: number }).changes) === 0) {
    return c.json({ success: false, error: 'So du khong du (race condition)', balance: wallet.balance }, 400);
  }

  const refundWalletOnOrderConflict = async () => {
    await db.prepare(
      "UPDATE cashback_wallets SET balance = balance + ?, total_spent = MAX(0, total_spent - ?), updated_at = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(amount, amount, now, cust.id, storeTenant).run().catch(async () => {
      if (storeTenant === 'default') {
        await db.prepare(
          'UPDATE cashback_wallets SET balance = balance + ?, total_spent = MAX(0, total_spent - ?), updated_at = ? WHERE customer_id = ?'
        ).bind(amount, amount, now, cust.id).run().catch(() => {});
      }
    });
  };

  try {
    let orderUpdateRes: { meta?: { changes?: number }; changes?: number } | undefined;
    try {
      orderUpdateRes = await db.prepare(
        "UPDATE orders SET cashback_used = ?, discount = COALESCE(discount, 0) + ?, total = MAX(0, COALESCE(total, total_amount, 0) - ?) WHERE id = ? AND COALESCE(cashback_used, 0) = 0 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND COALESCE(status, 'pending') NOT IN ('cancelled', 'completed') AND COALESCE(payment_status, 'unpaid') NOT IN ('paid', 'refunded')"
      ).bind(amount, amount, amount, order_id, storeTenant).run();
    } catch {
      try {
        orderUpdateRes = await db.prepare(
          "UPDATE orders SET cashback_used = ?, discount = COALESCE(discount, 0) + ?, total = MAX(0, total - ?) WHERE id = ? AND COALESCE(cashback_used, 0) = 0 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND COALESCE(status, 'pending') NOT IN ('cancelled', 'completed') AND COALESCE(payment_status, 'unpaid') NOT IN ('paid', 'refunded')"
        ).bind(amount, amount, amount, order_id, storeTenant).run();
      } catch (scopedOrdErr) {
        if (storeTenant !== 'default') {
          throw scopedOrdErr;
        }
        try {
          orderUpdateRes = await db.prepare(
            "UPDATE orders SET cashback_used = ?, discount = COALESCE(discount, 0) + ?, total = MAX(0, total - ?) WHERE id = ? AND COALESCE(cashback_used, 0) = 0 AND COALESCE(status, 'pending') NOT IN ('cancelled', 'completed') AND COALESCE(payment_status, 'unpaid') NOT IN ('paid', 'refunded')"
          ).bind(amount, amount, amount, order_id).run();
        } catch {
          try {
            orderUpdateRes = await db.prepare(
              "UPDATE orders SET cashback_used = ?, total = MAX(0, total - ?) WHERE id = ? AND COALESCE(cashback_used, 0) = 0 AND COALESCE(status, 'pending') NOT IN ('cancelled', 'completed') AND COALESCE(payment_status, 'unpaid') NOT IN ('paid', 'refunded')"
            ).bind(amount, amount, order_id).run();
          } catch {
            orderUpdateRes = await db.prepare(
              'UPDATE orders SET cashback_used = ? WHERE id = ? AND COALESCE(cashback_used, 0) = 0'
            ).bind(amount, order_id).run();
          }
        }
      }
    }
    const orderChanges = orderUpdateRes?.meta?.changes ?? (orderUpdateRes as unknown as { changes?: number })?.changes ?? 1;
    if (orderChanges === 0) {
      await refundWalletOnOrderConflict();
      return c.json({ success: false, error: 'Ví đã được dùng cho đơn này' }, 409);
    }
    await db.prepare(
      "UPDATE orders SET total_amount = total WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(order_id, storeTenant).run().catch(() => {});
  } catch {
    if (storeTenant !== 'default') {
      await refundWalletOnOrderConflict();
      return c.json({ success: false, error: 'Ví đã được dùng cho đơn này' }, 409);
    }
    let fallbackOrderRes: { meta?: { changes?: number }; changes?: number } | undefined;
    try {
      fallbackOrderRes = await db.prepare(
        "UPDATE orders SET discount = COALESCE(discount, 0) + ?, total = MAX(0, total - ?) WHERE id = ? AND COALESCE(status, 'pending') NOT IN ('cancelled', 'completed') AND COALESCE(payment_status, 'unpaid') NOT IN ('paid', 'refunded')"
      ).bind(amount, amount, order_id).run();
    } catch {
      fallbackOrderRes = await db.prepare('UPDATE orders SET discount = COALESCE(discount, 0) + ? WHERE id = ?').bind(amount, order_id).run().catch(() => undefined);
    }
    const fallbackChanges = fallbackOrderRes ? (fallbackOrderRes.meta?.changes ?? (fallbackOrderRes as unknown as { changes?: number }).changes ?? 1) : 0;
    if (fallbackChanges === 0) {
      await refundWalletOnOrderConflict();
      return c.json({ success: false, error: 'Ví đã được dùng cho đơn này' }, 409);
    }
  }
  const txId = makeCashbackTxId();
  try {
    await db.prepare(
      "INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, tenant_id, created_at) VALUES (?, ?, ?, ?, 'spend', ?, ?, ?, ?)"
    ).bind(txId, wallet.id ?? `wal_${cust.id}`, cust.id, order_id, amount, newBalance, storeTenant, now).run();
  } catch (txInsertErr) {
    if (storeTenant !== 'default') {
      throw txInsertErr;
    }
    try {
      await db.prepare(
        'INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, created_at) VALUES (?, ?, ?, ?, \'spend\', ?, ?, ?)'
      ).bind(txId, wallet.id ?? `wal_${cust.id}`, cust.id, order_id, amount, newBalance, now).run();
    } catch {
      await db.prepare(
        'INSERT INTO cashback_transactions (id, customer_id, order_id, type, amount, balance_after, created_at) VALUES (?, ?, ?, \'spend\', ?, ?, ?)'
      ).bind(txId, cust.id, order_id, amount, newBalance, now).run().catch(() => {});
    }
  }
  try {
    await db.prepare(
      'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(cust.id, 'cashback_spend', amount, order_id, JSON.stringify({ order_total: orderTotal }), storeTenant, now).run();
  } catch {
    if (storeTenant === 'default') {
      try {
        await db.prepare(
          'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(cust.id, 'cashback_spend', amount, order_id, JSON.stringify({ order_total: orderTotal }), now).run();
      } catch {
        // loyalty_audit_log table is optional in canonical D1 schema
      }
    }
  }

  let updatedWallet: { balance: number } | null = null;
  try {
    updatedWallet = await db.prepare("SELECT balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(cust.id, storeTenant).first<{ balance: number }>();
  } catch {
    if (storeTenant === 'default') {
      updatedWallet = await db.prepare('SELECT balance FROM cashback_wallets WHERE customer_id = ?').bind(cust.id).first<{ balance: number }>();
    }
  }
  const updatedOrderTotal = Math.max(0, orderTotal - amount);
  return c.json({
    success: true,
    data: {
      amount_spent: amount,
      new_balance: updatedWallet?.balance || 0,
      order_total: updatedOrderTotal,
    },
  });
}
