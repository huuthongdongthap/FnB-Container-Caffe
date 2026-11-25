export const PREPAID_ONLINE_METHODS = new Set(['payos', 'bank_transfer', 'qr', 'vietqr']);
export const PAID_PAYMENT_STATUSES = new Set(['paid', 'completed', 'partially_refunded']);

export function isPaidPaymentStatus(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  return PAID_PAYMENT_STATUSES.has(raw.trim().toLowerCase());
}

export function isCodOrCashDelivery(order: Record<string, unknown>): boolean {
  const method = String(order.payment_method ?? order.paymentMethod ?? '').trim().toLowerCase();
  return method === 'cod' || method === 'cash' || Number(order.is_cod ?? order.isCod ?? 0) === 1;
}

export function sanitizeKdsOrderNotes(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .split('|')
    .map((part) => part.replace(/\[OVERDUE\]/gi, '').trim())
    .filter(Boolean)
    .join(' | ');
  return cleaned || null;
}

/**
 * Kitchen must never brew an order whose money has not arrived or that is an
 * empty table check-in placeholder: online prepaid methods are held for every
 * order type until payment is confirmed, and delivery orders are held until
 * paid unless settled in cash/COD on arrival.
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
  const method = String(order.payment_method ?? order.paymentMethod ?? '').trim().toLowerCase();
  const status = String(order.status ?? '').trim().toLowerCase();
  const rawPaymentStatus =
    typeof order.payment_status === 'string'
      ? order.payment_status.trim().toLowerCase()
      : typeof order.paymentStatus === 'string'
        ? order.paymentStatus.trim().toLowerCase()
        : '';
  if (rawPaymentStatus === 'refunded') return true;
  if (PAID_PAYMENT_STATUSES.has(rawPaymentStatus)) return false;
  // Orders already admitted into active prep remain visible so baristas can finish or clear tickets.
  if (status === 'preparing' || status === 'ready') return false;
  if (PREPAID_ONLINE_METHODS.has(method)) return true;
  const orderType = String(order.order_type ?? order.orderType ?? '').trim().toLowerCase();
  if (orderType === 'delivery') {
    return !isCodOrCashDelivery(order);
  }
  return false;
}
