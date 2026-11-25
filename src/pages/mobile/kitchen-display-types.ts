export interface KitchenItem {
  id?: string;
  name: string;
  quantity: number;
  modifiers?: Array<string | { name?: string }>;
  note?: string;
  notes?: string;
  category_id?: string | null;
  categoryId?: string | null;
  ready?: boolean;
  status?: string;
  ready_at?: string | null;
  station?: KitchenStation;
}

export type KitchenStation = 'espresso' | 'food' | 'pastry' | 'cold' | 'all' | (string & {});

export interface KitchenOrder {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  table_name: string | null;
  order_type?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  is_cod?: number | boolean | null;
  delivery_time?: string | null;
  notes?: string | null;
  items: KitchenItem[];
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
  created_at: string;
  updated_at?: string | null;
  started_at?: string | null;
  ready_at?: string | null;
  station?: KitchenStation;
  cancel_alert?: boolean;
}
