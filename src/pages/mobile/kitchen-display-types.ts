export interface KitchenItem {
  name: string;
  quantity: number;
  modifiers?: string[];
  notes?: string;
  station?: KitchenStation;
}

export type KitchenStation = 'espresso' | 'food' | 'pastry' | 'cold' | 'all';

export interface KitchenOrder {
  id: string;
  table_name: string;
  items: KitchenItem[];
  status: 'pending' | 'preparing' | 'ready' | 'served';
  created_at: string;
  station?: KitchenStation;
}
