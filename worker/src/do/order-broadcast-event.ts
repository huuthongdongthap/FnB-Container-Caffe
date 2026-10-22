/** Internal-only DTO validation shared by Durable Object fetch and RPC-style tests. */
import type { OrderEvent } from './OrderBroadcaster';

const statuses = new Set(['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'delivered', 'cancelled', 'refunded', 'failed', 'expired']);
const paymentStatuses = new Set(['pending', 'unpaid', 'paid', 'failed', 'refunded', 'partially_refunded']);
export function parseOrderBroadcast(raw: unknown, previous?: OrderEvent): OrderEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  const id = payload.orderId ?? payload.order_id;
  if (typeof id !== 'string' || !id.trim() || id.length > 200 || !statuses.has(String(payload.status))) return null;
  const updatedAt = payload.updatedAt ?? (typeof payload.updated_at === 'string' ? Date.parse(payload.updated_at) : previous?.updatedAt);
  const merged = { ...previous, ...payload, orderId: id, updatedAt };
  if (!Array.isArray(merged.items) || merged.items.length > 500
    || typeof merged.total !== 'number' || !Number.isSafeInteger(merged.total) || merged.total < 0
    || typeof merged.customer_name !== 'string' || typeof merged.customer_phone !== 'string'
    || !paymentStatuses.has(String(merged.payment_status))
    || typeof merged.createdAt !== 'number' || !Number.isFinite(merged.createdAt) || merged.createdAt < 0
    || typeof merged.updatedAt !== 'number' || !Number.isFinite(merged.updatedAt) || merged.updatedAt < 0) return null;
  return {
    orderId: id, status: String(merged.status), payment_status: String(merged.payment_status),
    items: merged.items, total: merged.total, customer_name: merged.customer_name, customer_phone: merged.customer_phone,
    table_id: typeof merged.table_id === 'string' ? merged.table_id : null,
    createdAt: merged.createdAt, updatedAt: merged.updatedAt,
  };
}
