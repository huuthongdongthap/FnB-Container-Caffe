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
