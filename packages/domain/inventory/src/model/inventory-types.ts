export type InventoryCategory =
  | 'raw_materials'
  | 'consumables'
  | 'packaging'
  | 'equipment'
  | 'other';

export type InventoryTransactionType =
  | 'in'
  | 'out'
  | 'adjust'
  | 'waste'
  | 'reserve'
  | 'release';

export type ReferenceType =
  | 'order'
  | 'purchase'
  | 'adjustment'
  | 'waste_report'
  | 'sync';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  name_en?: string;
  category: InventoryCategory;
  unit: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  cost_per_unit: number;
  supplier?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  type: InventoryTransactionType;
  quantity: number;
  reference_id?: string;
  reference_type?: ReferenceType;
  notes?: string;
  created_at?: string;
}

export interface InventorySnapshot {
  id: string;
  item_id: string;
  date: string;
  opening_stock: number;
  closing_stock: number;
  created_at?: string;
}
