export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  category_id: number;
  image_url: string;
  is_available: number;
  sort_order: number;
}

export interface Category {
  id: number;
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
  sort_order: string;
}

export interface CategoryFormData {
  name: string;
  slug: string;
  sort_order: string;
}

export type Tab = 'products' | 'categories';

export const EMPTY_PRODUCT: ProductFormData = {
  name: '',
  slug: '',
  description: '',
  price: '',
  category_id: '',
  image_url: '',
  is_available: true,
  sort_order: '0',
};

export const EMPTY_CATEGORY: CategoryFormData = {
  name: '',
  slug: '',
  sort_order: '0',
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
