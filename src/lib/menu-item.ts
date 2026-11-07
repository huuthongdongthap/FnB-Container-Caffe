import { resolveMenuDrinkImage } from './menu-drink-images';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  available: boolean;
  tags: string[];
  prep_time?: number; // estimated prep time in minutes
}

export interface RawMenuItem {
  id: string;
  name: string;
  description?: string;
  priceCents?: number;
  price?: number | string;
  category: string;
  imageUrl?: string;
  image_url?: string;
  available?: boolean;
  tags?: string[];
}

/** Shared legacy DTO mapping; flat query responses keep their original fields. */
export function normalizeMenuItem(item: RawMenuItem): MenuItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: item.priceCents ?? (typeof item.price === 'string' ? parseInt(item.price, 10) : item.price) ?? 0,
    category: item.category,
    image_url: resolveMenuDrinkImage(item.id, item.imageUrl ?? item.image_url),
    available: Boolean(item.available),
    tags: Array.isArray(item.tags) ? item.tags : [],
  };
}
