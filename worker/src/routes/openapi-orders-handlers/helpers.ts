import type { D1Database } from '@cloudflare/workers-types';

export function formatOrder(
  order: Record<string, any>,
  items: Array<Record<string, any>>,
  payments: Array<Record<string, any>>
) {
  return {
    ...order,
    table: order.table_id ? { id: order.table_id, name: order.table_name } : null,
    items: items.map(item => ({
      ...item,
      modifiers: item.modifiers ? (typeof item.modifiers === 'string' ? JSON.parse(item.modifiers) : item.modifiers) : [],
    })),
    payments,
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount,
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    servedAt: order.served_at,
    completedAt: order.completed_at,
    cancelledAt: order.cancelled_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function fetchOrderItemsAndPayments(db: D1Database, orderId: string) {
  const [items, payments] = await Promise.all([
    db.prepare(
      `SELECT oi.*, p.name as product_name, p.slug as product_slug
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`
    ).bind(orderId).all(),
    db.prepare(
      'SELECT * FROM order_payments WHERE order_id = ?'
    ).bind(orderId).all(),
  ]);

  return {
    items: items.results || [],
    payments: payments.results || [],
  };
}
