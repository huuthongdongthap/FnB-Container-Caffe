/* ── Types ────────────────────────────────────────────────────────── */

export interface TableInfo {
  id: string;
  table_number: number;
  status: 'free' | 'occupied' | 'reserved';
}

export interface OrderItem {
  id?: string;
  product_id?: string;
  name: string;
  quantity: number;
  price: number;
  note: string;
}

export interface WaiterMenuItem {
  id: string;
  name: string;
  price: number;
}

export interface MobileOrder {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  order_type?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  is_cod?: number | boolean | null;
  notes?: string | null;
  total?: number | null;
  table_id: string;
  table_number: number;
  items: OrderItem[];
  status: string;
  created_at: string;
}
