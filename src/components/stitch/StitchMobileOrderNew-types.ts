/**
 * Types for StitchMobileOrderNew ordering components.
 */

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Price display string (e.g. "$6.50") */
  priceLabel: string;
  category: string;
  /** Optional badge shown in top-left of the image (e.g. "Signature") */
  badge?: string;
  /** High-res image URL for the product */
  imageSrc: string;
  /** Descriptive alt text for accessibility */
  imageAlt: string;
  /** Whether this item is featured / recommended */
  featured?: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface StitchMobileOrderNewProps {
  /** Menu items to display. Falls back to default AURA CAFE items. */
  items?: MenuItem[];
  /** Table identifier shown in the header */
  tableId?: string;
  /** Whether data is still loading */
  loading?: boolean;
  /** Error message if fetching fails */
  error?: string | null;
  /** Placeholder image URL when a product card lacks an image */
  fallbackImage?: string;
  /** Called when the back button is pressed */
  onBack?: () => void;
  /** Called when the search button / bar is activated */
  onSearch?: (query: string) => void;
  /** Called when "View Cart" is pressed */
  onViewCart?: (cart: CartItem[]) => void;
}
