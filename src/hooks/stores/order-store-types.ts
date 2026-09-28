/* ─── Canonical Customer-Safe DTO (mirrors worker/src/schemas/orders.ts) ───── */
export interface CustomerOrderItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  modifiers?: Array<{ name: string; priceAdjustment: number }>;
  notes?: string | null;
  status: OrderStatus;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  table?: { id: string; name: string } | null;
  items: CustomerOrderItem[];
  channel: OrderChannel;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ─── Legacy UI types (snake_case) — retained for write path compatibility ─── */
export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  status: string;
  total: number;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  items: OrderItem[];
  created_at: string;
  discount?: number;
  shipping_fee?: number;
  notes?: string;
  table_id?: string;
  order_type?: 'dine_in' | 'takeaway' | 'delivery';
  points_earned?: number;
  cashback_earned?: number;
}

export interface CreateOrderPayload {
  items: OrderItem[];
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address?: string;
  payment_method: string;
  notes?: string;
  delivery_time?: string;
  shipping_fee?: number;
  discount?: number;
  tip?: number;
  table_id?: string;
  order_type?: 'dine_in' | 'takeaway' | 'delivery';
}

/* ─── Enums from worker/src/schemas/common.ts ────────────────────────────── */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export type OrderChannel = 'dine_in' | 'takeaway' | 'delivery';

/* ─── Store State ────────────────────────────────────────────────────────── */
export interface OrderState {
  currentOrder: CustomerOrder | null;
  orderHistory: CustomerOrder[];
  loading: boolean;
  error: string | null;
  pollingId: number | null;
  eventSource: EventSource | null;
  queuedOffline: boolean;

  createOrder: (payload: CreateOrderPayload) => Promise<CustomerOrder | null>;
  fetchOrder: (id: string) => Promise<void>;
  startPolling: (id: string) => void;
  stopPolling: () => void;
  subscribeToOrder: (id: string) => void;
  unsubscribeFromOrder: () => void;
  flushQueuedOrders: () => Promise<CustomerOrder | null>;
}
