export const PREPAID_ONLINE_METHODS = new Set(['payos', 'bank_transfer', 'qr', 'vietqr']);

/**
 * Kitchen must never brew an order whose money has not arrived or that is an
 * empty table check-in placeholder: online prepaid methods are held for every
 * order type until payment is confirmed, and delivery orders are held until
 * paid unless settled in cash on arrival.
 */
export function isHeldOutOfKds(order: Record<string, unknown>): boolean {
  const rawNotes = typeof order.notes === 'string' ? order.notes.trim() : '';
  if (rawNotes === 'Khách QR - cho don mon' || rawNotes.startsWith('Khách QR - cho don mon |')) {
    const rawItems = order.items;
    if (Array.isArray(rawItems) && rawItems.length === 0) return true;
    if (typeof rawItems === 'string') {
      const trimmed = rawItems.trim();
      if (!trimmed || trimmed === '[]') return true;
    }
  }
  const method = String(order.payment_method ?? '').trim().toLowerCase();
  const status = String(order.status ?? '').trim().toLowerCase();
  const rawPaymentStatus =
    typeof order.payment_status === 'string' ? order.payment_status.trim().toLowerCase() : '';
  if (rawPaymentStatus === 'refunded') return true;
  if (rawPaymentStatus === 'paid') return false;
  // Orders already admitted into active prep remain visible so baristas can finish or clear tickets.
  if (status === 'preparing' || status === 'ready') return false;
  if (PREPAID_ONLINE_METHODS.has(method)) return true;
  if (order.order_type === 'delivery') {
    const isCod = method === 'cod' || Number(order.is_cod) === 1;
    return !isCod;
  }
  return false;
}
