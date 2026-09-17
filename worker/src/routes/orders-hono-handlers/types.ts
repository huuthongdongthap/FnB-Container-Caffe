/**
 * Orders (Hono) Types & Helpers
 */

/** CSPRNG-suffixed order ID — replaces Math.random() (predictable / collidable) */
export function makeOrderId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return (`ORD-${Date.now().toString(36)}${rand}`).toUpperCase();
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
}

export interface OrderRecord {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  table_id: string | null;
  items: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
}

export interface KdsOrder {
  id: string;
  customer_name: string;
  table_id: string | null;
  items: OrderItem[];
  status: string;
  elapsed_minutes: number;
  created_at: string;
}

// Allowed statuses for the KDS status query parameter — used for input validation only.
// The SQL filter always includes 'preparing' regardless, so staff see in-flight + next-up orders.
export const ALLOWED_KDS_STATUSES = ['pending', 'preparing', 'served', 'completed', 'cancelled'] as const;
