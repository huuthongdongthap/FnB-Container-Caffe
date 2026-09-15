// Catalog model types — D1 query result shapes shared by commands and schemas.

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  category_id: string;
  image_url: string;
  is_available: number;
  sort_order: number;
  category_name?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  image_url: string | null;
}

export interface ModifierGroup {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ModifierChoice {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_default: number;
  sort_order: number;
}

export interface ProductModifierGroup {
  product_id: string;
  group_id: string;
  sort_order: number;
}

export interface HappyHourWindow {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  discount_rate: number;
  apply_to: string;
  apply_ids: string | null;
  priority: number;
  active: number;
  created_at: string;
  updated_at: string;
}
