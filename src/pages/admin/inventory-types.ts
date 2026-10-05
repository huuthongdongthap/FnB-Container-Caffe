export interface IngredientItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  cost_per_unit: number;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  is_active: number | boolean;
  updated_at?: string;
}

export interface StockMovementItem {
  id: string;
  ingredient_id: string;
  ingredient_name?: string;
  type: 'in' | 'out' | 'adjust' | 'waste';
  quantity: number;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface SupplierItem {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  is_active?: number | boolean;
}

export interface PurchaseOrderItem {
  id: string;
  po_number: string;
  supplier_id?: string;
  supplier_name?: string;
  order_date: string;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  total: number;
}

export interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}

export interface ForecastItem {
  id: string;
  sku: string;
  name: string;
  current_stock: number;
  daily_run_rate?: number;
  days_of_supply?: number;
  risk_level?: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  recommended_reorder_qty?: number;
  unit?: string;
}

export type InventoryTab = 'overview' | 'movements' | 'suppliers' | 'forecasting';
