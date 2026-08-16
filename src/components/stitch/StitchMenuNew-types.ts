export interface MenuItemData {
  id: string;
  name: string;
  description: string;
  price: string;
  imageSrc: string;
  imageAlt: string;
  category: string;
  badge?: string;
  prepTime?: number; // estimated prep time in minutes
}

export interface StitchMenuNewProps {
  /** Menu items to display */
  items?: MenuItemData[];
  /** Brand name shown in the navigation */
  brandName?: string;
  /** Callback when Add to Cart is clicked */
  onAddToCart?: (item: MenuItemData) => void;
  /** Callback when the cart FAB is clicked */
  onCartClick?: () => void;
  /** Number of items currently in the cart */
  cartItemCount?: number;
}

export const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'tea', label: 'Tea' },
  { key: 'cold-brew', label: 'Cold Brew' },
  { key: 'signature', label: 'Signature' },
] as const;
