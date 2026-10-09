/**
 * Canonical Customer / CRM Event Contract
 * Single Authoritative Schema & Contract for Customer & CRM Events.
 * Flow: ORDER → CUSTOMER IDENTITY → DOMAIN EVENT → CUSTOMER EVENT → CRM
 */

export type CanonicalEventType =
  | 'order_created'
  | 'order_paid'
  | 'order_cancelled'
  | 'order_completed'
  | 'visit_recorded'
  | 'customer_identified'
  | 'customer_linked';

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  totalAmount: number;
  channel: string;
  itemsCount: number;
  customerPhone?: string | null;
}

export interface OrderPaidPayload {
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  totalAmount: number;
  paymentMethod: string;
  paidAt: string;
}

export interface OrderCancelledPayload {
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  totalAmount: number;
  reason: string;
  cancelledAt: string;
}

export interface OrderCompletedPayload {
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  totalAmount: number;
  channel: string;
  completedAt: string;
}

export interface VisitRecordedPayload {
  visitId: string;
  customerId: string;
  orderId?: string | null;
  channel: string;
  spent?: number | null;
}

export interface CustomerIdentifiedPayload {
  customerId: string;
  identifierType: 'phone' | 'email' | 'zalo' | 'other';
  identifierValue: string;
  source: string;
}

export interface CustomerLinkedPayload {
  orderId: string;
  customerId: string;
  previousCustomerId: string | null;
  totalAmount?: number | null;
}

export type AnyEventPayload =
  | OrderCreatedPayload
  | OrderPaidPayload
  | OrderCancelledPayload
  | OrderCompletedPayload
  | VisitRecordedPayload
  | CustomerIdentifiedPayload
  | CustomerLinkedPayload
  | Record<string, unknown>;

export interface CanonicalCustomerEvent<T = AnyEventPayload> {
  id: string;
  eventType: CanonicalEventType;
  customerId: string | null;
  orderId?: string | null;
  payload: T;
  version: number;
  recordedAt: string;
  idempotencyKey: string;
}

const PROHIBITED_PATTERNS = [
  'supplier', 'cost', 'margin', 'api_key', 'secret', 'password', 'token',
  'jwt', 'staff_pin', 'staff_notes', 'internal_memo'
];

function isProhibitedKey(key: string): boolean {
  const k = key.toLowerCase();
  return PROHIBITED_PATTERNS.some(p => k.includes(p));
}

/**
 * Sanitizes event payload to guarantee customer safety.
 * Strips confidential financial/internal fields and attaches schema version.
 */
export function sanitizeCustomerEventPayload<T extends Record<string, unknown>>(
  eventType: CanonicalEventType,
  raw: T
): T & { v: number; event_type: CanonicalEventType } {
  const sanitized: Record<string, unknown> = {
    v: 1,
    event_type: eventType,
  };

  for (const [key, value] of Object.entries(raw)) {
    if (!isProhibitedKey(key) && value !== undefined) {
      sanitized[key] = value;
    }
  }

  return sanitized as T & { v: number; event_type: CanonicalEventType };
}

/**
 * Factory helper: creates a validated, timestamped, versioned CanonicalCustomerEvent.
 */
export function createCanonicalCustomerEvent<T extends Record<string, unknown>>(params: {
  eventType: CanonicalEventType;
  customerId: string | null;
  orderId?: string | null;
  payload: T;
  idempotencyKey?: string;
}): CanonicalCustomerEvent<T & { v: number; event_type: CanonicalEventType }> {
  const now = new Date().toISOString();
  const rand = Math.random().toString(36).slice(2, 7);
  const id = `cev_${Date.now().toString(36)}_${rand}`;
  const orderKey = params.orderId || (params.payload as any).orderId || (params.payload as any).order_id || 'no_order';
  const idempotencyKey = params.idempotencyKey || `${params.eventType}:${orderKey}:${params.customerId || 'guest'}`;

  return {
    id,
    eventType: params.eventType,
    customerId: params.customerId,
    orderId: params.orderId || (params.payload as any).orderId || (params.payload as any).order_id || null,
    payload: sanitizeCustomerEventPayload(params.eventType, params.payload),
    version: 1,
    recordedAt: now,
    idempotencyKey,
  };
}
