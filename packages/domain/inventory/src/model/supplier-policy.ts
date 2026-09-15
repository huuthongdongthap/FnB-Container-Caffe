export type SupplierTier = 'primary' | 'secondary';

export interface Supplier {
  id: string;
  name: string;
  tier: SupplierTier;
  categories: string[];
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  payment_terms?: string;
  is_active: boolean;
}

export interface PurchaseOrderItem {
  ingredient_id: string;
  quantity: number;
  unit_cost?: number;
}

export interface PurchaseOrderInput {
  supplier_id: string;
  items: PurchaseOrderItem[];
  expected_date?: string;
  notes?: string;
}

export interface RecipeComponent {
  ingredient_id: string;
  quantity: number;
}

export interface Recipe {
  product_id: string;
  components: RecipeComponent[];
}

export const VIVA_STAR_PRIMARY_CATEGORIES = [
  'coffee_beans',
  'branded_packaging',
  'core_syrups',
] as const;
