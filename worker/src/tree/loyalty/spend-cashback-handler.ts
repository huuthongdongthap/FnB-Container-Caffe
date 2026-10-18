/**
 * Spend Cashback Handler - POST /api/loyalty/spend-cashback
 * Deduct cashback wallet balance toward an order with validation.
 */
import type { Context } from 'hono';
import { spendCashbackSchema } from '../../lib/validators';
import type { Env } from '../../types/env';
import type { Customer, CashbackWallet } from '../../types/models';

const MIN_ORDER_TO_SPEND = 20000;

export async function handleSpendCashback(c: Context<{ Bindings: Env }>) {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = spendCashbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const { order_id, amount } = parsed.data;

  const existingSpend = await db.prepare(
    'SELECT id FROM cashback_transactions WHERE order_id = ? AND type = \'spend\' LIMIT 1'
  ).bind(order_id).first<{ id: string }>();
  if (existingSpend) {
    return c.json({ success: false, error: 'Ví đã được dùng cho đơn này' }, 409);
  }

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(order_id).first<{ total_amount?: number; total?: number }>();
  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
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

  const wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(cust.id).first<CashbackWallet>();
  if (!wallet) {
    return c.json({ success: false, error: 'Vi khong ton tai', balance: 0 }, 400);
  }

  const newBalance = wallet.balance - amount;
  if (newBalance < 0) {
    return c.json({ success: false, error: 'So du khong du', balance: wallet.balance }, 400);
  }

  const now = new Date().toISOString();
  const updateResult = await db.prepare(
    'UPDATE cashback_wallets SET balance = balance - ?, total_spent = total_spent + ?, updated_at = ? WHERE customer_id = ? AND balance >= ?'
  ).bind(amount, amount, now, cust.id, amount).run();

  if ((updateResult as unknown as { changes: number }).changes === 0) {
    return c.json({ success: false, error: 'So du khong du (race condition)', balance: wallet.balance }, 400);
  }

  try {
    await db.prepare('UPDATE orders SET cashback_used = ? WHERE id = ?').bind(amount, order_id).run();
  } catch {
    await db.prepare('UPDATE orders SET discount = COALESCE(discount, 0) + ? WHERE id = ?').bind(amount, order_id).run().catch(() => {});
  }
  try {
    await db.prepare(
      'INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, created_at) VALUES (?, ?, ?, ?, \'spend\', ?, ?, ?)'
    ).bind(`cb_${Date.now()}`, wallet.id ?? `wal_${cust.id}`, cust.id, order_id, amount, newBalance, now).run();
  } catch {
    await db.prepare(
      'INSERT INTO cashback_transactions (id, customer_id, order_id, type, amount, balance_after, created_at) VALUES (?, ?, ?, \'spend\', ?, ?, ?)'
    ).bind(`cb_${Date.now()}`, cust.id, order_id, amount, newBalance, now).run().catch(() => {});
  }
  try {
    await db.prepare(
      'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(cust.id, 'cashback_spend', amount, order_id, JSON.stringify({ order_total: orderTotal }), now).run();
  } catch {
    // loyalty_audit_log table is optional in canonical D1 schema
  }

  const updatedWallet = await db.prepare('SELECT balance FROM cashback_wallets WHERE customer_id = ?').bind(cust.id).first<{ balance: number }>();
  return c.json({ success: true, data: { amount_spent: amount, new_balance: updatedWallet?.balance || 0 } });
}
