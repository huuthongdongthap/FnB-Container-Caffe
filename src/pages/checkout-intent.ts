import { apiFetch } from '@/lib/api-client';
import type { CreateOrderPayload, OrderState } from '@/hooks/stores/order-store-types';

/** One checkout intent survives network errors and short page reloads. */
export const CHECKOUT_INTENT_KEY = 'aura_checkout_intent_v1';
export interface CheckoutIntent {
  key: string;
  fingerprint: string;
  order?: { id: string; total: number };
}
let memoryIntent: CheckoutIntent | null = null;

function readIntent(): CheckoutIntent | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_INTENT_KEY);
    if (!raw) return memoryIntent;
    const value = JSON.parse(raw) as CheckoutIntent;
    return typeof value.key === 'string' && typeof value.fingerprint === 'string'
      && (!value.order || (typeof value.order.id === 'string' && Number.isFinite(value.order.total))) ? value : null;
  } catch { return memoryIntent; }
}

function writeIntent(intent: CheckoutIntent): void {
  memoryIntent = intent;
  try { sessionStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(intent)); } catch { /* Restricted storage: retry within this page still works. */ }
}

export async function getCheckoutIntent(payload: unknown, identity: string): Promise<CheckoutIntent> {
  // Store only a hash, never customer details or auth credentials.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([identity, payload])));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const previous = readIntent();
  if (previous?.fingerprint === fingerprint) return previous;
  const intent = { key: crypto.randomUUID(), fingerprint };
  writeIntent(intent);
  return intent;
}

export function rememberCheckoutOrder(intent: CheckoutIntent, order: NonNullable<CheckoutIntent['order']>): void {
  if (readIntent()?.key === intent.key) writeIntent({ ...intent, order });
}

export function clearCheckoutIntent(key?: string): void {
  if (key && readIntent()?.key !== key) return;
  memoryIntent = null;
  try { sessionStorage.removeItem(CHECKOUT_INTENT_KEY); } catch { /* Restricted storage. */ }
}

export function acknowledgeCheckoutOrder(orderId: string): void {
  const intent = readIntent();
  if (intent?.order?.id === orderId) clearCheckoutIntent(intent.key);
}

export async function resolveCheckoutOrder(options: {
  payload: CreateOrderPayload;
  identity: () => string;
  createOrder: OrderState['createOrder'];
  creationError: () => string;
}) {
  const identity = options.identity();
  const requireSameIdentity = () => {
    if (options.identity() !== identity) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
  };
  const intent = await getCheckoutIntent(options.payload, identity);
  let alreadyPaid = false;
  requireSameIdentity();
  if (intent.order) {
    const tracked = await apiFetch<any>(`/api/orders/${encodeURIComponent(intent.order.id)}/track`, { silent: true }).catch(() => null);
    const previous = tracked?.data ?? tracked;
    requireSameIdentity();
    // A settled order after a lost return remains this same checkout. Show its
    // confirmation; only acknowledgement or an explicit new intent may rotate it.
    alreadyPaid = ['paid', 'completed', 'refunded', 'partially_refunded'].includes(previous?.paymentStatus ?? previous?.payment_status);
  }
  let resolved = intent.order;
  if (!resolved) {
    requireSameIdentity();
    const order = await options.createOrder(options.payload, intent.key);
    if (!order) throw new Error(options.creationError());
    const rawOrder = (order as any)?.order ?? (order as any)?.data ?? order;
    resolved = { id: rawOrder.id, total: Number(rawOrder.totalAmount ?? rawOrder.total ?? options.payload.total) };
    if (!resolved.id || !Number.isFinite(resolved.total)) throw new Error(options.creationError());
    rememberCheckoutOrder(intent, resolved);
  }
  requireSameIdentity();
  return { intent, order: resolved, identity, alreadyPaid };
}
