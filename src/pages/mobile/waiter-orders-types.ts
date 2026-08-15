/* ── Types ────────────────────────────────────────────────────────── */

export interface TableInfo {
  id: string;
  table_number: number;
  status: 'free' | 'occupied' | 'reserved';
}

export interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  note: string;
}

export interface MobileOrder {
  id: string;
  table_id: string;
  table_number: number;
  items: OrderItem[];
  status: string;
  created_at: string;
}
