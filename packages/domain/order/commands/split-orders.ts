/** Split bills share canonical server pricing and the signed store boundary. */
import { z } from 'zod';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { orderItemSchema, paymentMethodSchema } from 'worker/src/lib/validators';
import { generateId, parseJSON } from '../model/helpers';
import { calculateCheckoutSnapshot } from '../policies/checkout-snapshot';
import { OrderCreationError, resolveOrderCreationScope, resolveOrderCreationTable } from '../policies/order-creation-scope';
import { publishOrderEvent } from '../policies/customer-order-payload';

const log = createLogger({ route: 'orders' });
const splitOrderEntrySchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Phải có ít nhất 1 sản phẩm').max(100, 'Tối đa 100 sản phẩm mỗi đơn'),
  total: z.number().min(1000, 'Tổng tiền tối thiểu 1,000đ'),
  customer_name: z.string().min(1), customer_phone: z.string().min(8).max(15),
  customer_email: z.string().optional().or(z.literal('')), customer_address: z.string().optional(),
  payment_method: paymentMethodSchema.default('cod'), notes: z.string().optional(),
  delivery_time: z.string().optional(), shipping_fee: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(), tip: z.number().nonnegative().optional(),
});
const splitOrdersSchema = z.object({
  orders: z.array(splitOrderEntrySchema).min(2, 'Cần ít nhất 2 đơn để chia bill').max(4, 'Tối đa 4 đơn'),
  table_id: z.string().min(1, 'Thiếu thông tin bàn'),
});

export async function splitOrders(request: Request, env: Record<string, unknown>) {
  try {
    const parsed = splitOrdersSchema.safeParse(await parseJSON(request));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }
    const { tenantId } = await resolveOrderCreationScope(request, env);
    const db = env.AURA_DB as D1Database;
    const tableId = await resolveOrderCreationTable(db, parsed.data.table_id, tenantId);
    if (!tableId) return errorResponse('A valid table_id in this store is required', 400);
    // Validate the entire bill before any table, order or ledger write.
    const snapshots = await Promise.all(parsed.data.orders.map(order => calculateCheckoutSnapshot(db, {
      items: order.items, order_type: 'dine_in', tip_amount: order.tip,
    })));
    const rejected = snapshots.find(snapshot => snapshot.rejected)?.rejected;
    if (rejected) return errorResponse(rejected.message, 400);
    const statements: D1PreparedStatement[] = [];
    const now = new Date().toISOString();
    const createdOrders = parsed.data.orders.map((order, index) => {
      const id = generateId('ORD_');
      const snapshot = snapshots[index];
      statements.push(db.prepare(`INSERT INTO orders (
        id, items, total, status, customer_name, customer_phone,
        customer_email, customer_address, payment_method, payment_status,
        shipping_fee, discount, notes, delivery_time, table_id,
        order_type, tip_amount, tenant_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, snapshot.itemsJson, snapshot.total, 'pending', order.customer_name, order.customer_phone,
          order.customer_email || null, order.customer_address || null, order.payment_method, 'unpaid',
          snapshot.shipping_fee, snapshot.discount, order.notes || null, order.delivery_time || 'now',
          tableId, 'dine_in', snapshot.tip_amount, tenantId, now, now));
      for (const item of snapshot.items) {
        statements.push(db.prepare(`INSERT INTO order_items (
          id, order_id, product_id, quantity, subtotal, modifiers, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(generateId('ITEM_'), id, item.menuItemId, item.quantity, item.subtotalCents,
            JSON.stringify(item.modifiers || []), now));
      }
      // PayOS reserves its own identified attempt when creating the provider link.
      if (order.payment_method === 'cod') {
        statements.push(db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(generateId('PAY_'), id, 'cod', snapshot.total, 'pending', now, now));
      }
      return {
        id, status: 'pending', payment_status: 'unpaid', items: snapshot.items, total: snapshot.total,
        customer_name: order.customer_name, customer_phone: order.customer_phone,
        customer_address: order.customer_address || null, payment_method: order.payment_method,
        notes: order.notes || null, table_id: tableId, created_at: now,
      };
    });
    statements.push(db.prepare("UPDATE cafe_tables SET status = 'Occupied' WHERE id = ? AND tenant_id = ? AND status = 'Available'")
      .bind(tableId, tenantId));
    // D1 rolls back the whole group if any sub-order or ledger write fails.
    await db.batch(statements);
    if (env.AUTH_KV) {
      for (const order of createdOrders) {
        await publishOrderEvent(env.AUTH_KV as KVNamespace, order.id, 'pending').catch(error => {
          log.warn('Split order event failed after commit', { orderId: order.id, message: (error as Error).message });
        });
      }
    }
    return jsonResponse({ success: true, data: createdOrders, message: `Đã tạo ${createdOrders.length} đơn hàng` }, 201);
  } catch (error) {
    if (error instanceof OrderCreationError) return Response.json({ success: false, error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
    log.error('SplitOrders error:', { message: (error as Error).message });
    return errorResponse('Failed to create split orders', 500);
  }
}
