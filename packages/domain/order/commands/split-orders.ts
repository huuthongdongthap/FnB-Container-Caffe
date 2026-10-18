/**
 * Orders — Split orders handler
 * Creates multiple sub-orders for dine-in split bill / group ordering.
 * Each sub-order is an independent order sharing the same table.
 */

import { z } from 'zod';
import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { generateId, parseJSON } from '../model/helpers';

const log = createLogger({ route: 'orders' });

const splitOrderItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive()
});

const splitOrderEntrySchema = z.object({
  items: z.array(splitOrderItemSchema).min(1, 'Phải có ít nhất 1 sản phẩm'),
  total: z.number().min(1000, 'Tổng tiền tối thiểu 1,000đ'),
  customer_name: z.string().min(1),
  customer_phone: z.string().min(8).max(15),
  customer_email: z.string().optional().or(z.literal('')),
  customer_address: z.string().optional(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
  delivery_time: z.string().optional(),
  shipping_fee: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  tip: z.number().nonnegative().optional(),
  table_id: z.string().optional()
});

const splitOrdersSchema = z.object({
  orders: z.array(splitOrderEntrySchema).min(2, 'Cần ít nhất 2 đơn để chia bill').max(4, 'Tối đa 4 đơn'),
  table_id: z.string().min(1, 'Thiếu thông tin bàn')
});

export async function splitOrders(request: Request, env: Record<string, unknown>) {
  try {
    const body = await parseJSON(request);
    const parsed = splitOrdersSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }

    const { orders, table_id } = parsed.data;
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

    // Resolve table_number or table id to table UUID and auto-occupy
    let resolvedTableId: string | null = null;
    const tableRow = await db.prepare(
      'SELECT id FROM cafe_tables WHERE table_number = ? OR id = ?'
    ).bind(table_id, table_id).first<{ id: string }>();

    if (tableRow) {
      resolvedTableId = tableRow.id;
      await db.prepare(
        'UPDATE cafe_tables SET status = \'Occupied\' WHERE id = ? AND status = \'Available\''
      ).bind(tableRow.id).run();
    }

    const createdOrders: Array<Record<string, unknown>> = [];
    const now = new Date().toISOString();

    for (const order of orders) {
      const orderId = generateId('ORD_');
      const itemsSubtotal = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const shippingFee = parseInt(String(order.shipping_fee || 0), 10) || 0;
      const discount = parseInt(String(order.discount || 0), 10) || 0;
      const tipAmount = parseInt(String(order.tip || 0), 10) || 0;
      const computedTotal = itemsSubtotal > 0
        ? Math.max(0, itemsSubtotal + shippingFee - discount + tipAmount)
        : parseInt(String(order.total), 10);
      const itemsJson = JSON.stringify(
        order.items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          subtotal: i.price * i.quantity
        }))
      );

      await db.prepare(`
        INSERT INTO orders (
          id, items, total, status, customer_name, customer_phone,
          customer_email, customer_address, payment_method, payment_status,
          shipping_fee, discount, notes, delivery_time, table_id,
          order_type, tip_amount, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        itemsJson,
        computedTotal,
        'pending',
        order.customer_name,
        order.customer_phone,
        order.customer_email || null,
        order.customer_address || null,
        order.payment_method || 'cash',
        'unpaid',
        shippingFee,
        discount,
        order.notes || null,
        order.delivery_time || 'now',
        resolvedTableId,
        'dine_in',
        tipAmount,
        now,
        now
      ).run();

      // Create payment record for each sub-order
      const paymentId = generateId('PAY_');
      await db.prepare(`
        INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        paymentId,
        orderId,
        order.payment_method || 'cash',
        computedTotal,
        'pending',
        now,
        now
      ).run();

      createdOrders.push({
        id: orderId,
        status: 'pending',
        payment_status: 'unpaid',
        items: order.items,
        total: computedTotal,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address || null,
        payment_method: order.payment_method || 'cash',
        notes: order.notes || null,
        table_id: resolvedTableId,
        created_at: now
      });
    }

    if (env.AUTH_KV) {
      const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
      await kv.put('latest_order_ts', now).catch(() => {});
      await kv.put('orders:latest_updated_at', now).catch(() => {});
    }

    log.info('Split orders created', {
      count: createdOrders.length,
      table_id,
      order_ids: createdOrders.map((o) => o.id).join(',')
    });

    return jsonResponse({
      success: true,
      data: createdOrders,
      message: `Đã tạo ${createdOrders.length} đơn hàng`
    }, 201);
  } catch (error) {
    log.error('SplitOrders error:', { message: (error as Error).message });
    return errorResponse('Failed to create split orders', 500);
  }
}
