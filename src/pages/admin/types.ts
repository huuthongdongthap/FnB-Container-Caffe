export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  category_id: string;
  image_url: string;
  is_available: number;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  price: string;
  category_id: string;
  image_url: string;
  is_available: boolean;
  is_variable_price: boolean;
  sort_order: string;
}

export interface CategoryFormData {
  name: string;
  slug: string;
  sort_order: string;
}

export type Tab = 'products' | 'categories' | 'modifiers';

/** An option group (e.g. "Kích cỡ") the customer picks from. */
export interface ModifierGroup {
  id: string;
  name: string;
  /** `single` allows one pick, `multiple` several — enforced server-side. */
  type: 'single' | 'multiple';
  required: number;
  sort_order: number;
  is_active: number;
}

/** One selectable option inside a group, priced as a delta over the base price. */
export interface ModifierChoice {
  id: string;
  group_id: string;
  name: string;
  /** Integer VND, signed; validation rejects non-integers. */
  price_delta: number;
  sort_order: number;
  is_available: number;
}

export interface ModifierGroupFormData {
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  sort_order: string;
}

export interface ModifierChoiceFormData {
  name: string;
  price_delta: string;
}

export const EMPTY_PRODUCT: ProductFormData = {
  name: '',
  slug: '',
  description: '',
  price: '',
  category_id: '',
  image_url: '',
  is_available: true,
  is_variable_price: false,
  sort_order: '0',
};

export const EMPTY_CATEGORY: CategoryFormData = {
  name: '',
  slug: '',
  sort_order: '0',
};

export const EMPTY_MODIFIER_GROUP: ModifierGroupFormData = {
  name: '',
  type: 'single',
  required: false,
  sort_order: '0',
};

export const EMPTY_MODIFIER_CHOICE: ModifierChoiceFormData = {
  name: '',
  price_delta: '0',
};

// ── Promotions ───────────────────────────────────────────────────────

export interface Promotion {
  code: string;
  percent: number;
  max_discount: number;
  min_order: number;
  usage_limit: number;
  usage_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: number;
  created_at: string;
}

export interface PromotionFormData {
  code: string;
  percent: string;
  max_discount: string;
  min_order: string;
  usage_limit: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
}

export const EMPTY_PROMOTION: PromotionFormData = {
  code: '',
  percent: '',
  max_discount: '',
  min_order: '',
  usage_limit: '',
  starts_at: '',
  expires_at: '',
  is_active: true,
};
