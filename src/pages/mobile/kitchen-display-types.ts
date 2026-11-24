export interface KitchenItem {
  name: string;
  quantity: number;
  modifiers?: string[];
  note?: string;
  notes?: string;
  station?: KitchenStation;
}

export type KitchenStation = 'espresso' | 'food' | 'pastry' | 'cold' | 'all';

export interface KitchenOrder {
  id: string;
  order_number?: string | null;
  table_name: string | null;
  order_type?: string | null;
  items: KitchenItem[];
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
  created_at: string;
  station?: KitchenStation;
  cancel_alert?: boolean;
}
