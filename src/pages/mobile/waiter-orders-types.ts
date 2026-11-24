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
  table_id: string;
  table_number: number;
  items: OrderItem[];
  status: string;
  created_at: string;
}
