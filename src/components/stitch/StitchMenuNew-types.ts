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
  /** Extra sections placed before the footer (e.g. Recommendations) */
  children?: React.ReactNode;
}

export const CATEGORIES = [
  { key: 'all', label: 'Tất cả' },
  { key: 'traditional-coffee', label: '☕ Cà phê truyền thống' },
  { key: 'hot-coffee', label: '🔥 Cà phê nóng' },
  { key: 'frappuccino', label: '🧊 Đá xay' },
  { key: 'soda', label: '🫧 Soda Ý' },
  { key: 'tea', label: '🍵 Trà' },
  { key: 'smoothies', label: '🥤 Sinh tố' },
  { key: 'yogurt', label: '🥛 Yaourt' },
  { key: 'juice', label: '🍊 Nước ép' },
  { key: 'other-drinks', label: '🥤 Giải khát' },
  { key: 'bottled', label: '🧴 Đóng chai' },
] as const;
