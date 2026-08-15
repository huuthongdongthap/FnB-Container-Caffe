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
}

export interface OrderState {
  currentOrder: Order | null;
  orderHistory: Order[];
  loading: boolean;
  error: string | null;
  pollingId: number | null;
  eventSource: EventSource | null;
  queuedOffline: boolean;

  createOrder: (payload: CreateOrderPayload) => Promise<Order | null>;
  fetchOrder: (id: string) => Promise<void>;
  startPolling: (id: string) => void;
  stopPolling: () => void;
  subscribeToOrder: (id: string) => void;
  unsubscribeFromOrder: () => void;
  flushQueuedOrders: () => Promise<Order | null>;
}
