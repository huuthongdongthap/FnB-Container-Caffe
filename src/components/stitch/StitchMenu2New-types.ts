export interface MenuItem2Data {
  id: string;
  name: string;
  description: string;
  price: string;
  imageSrc: string;
  imageAlt: string;
  category: string;
  /** Optional badge text shown in top-left corner (e.g. "Featured") */
  badge?: string;
  /** Label for the gauge bar (e.g. "Intensity", "Sweetness") */
  gaugeLabel: string;
  /** Numeric value for the gauge bar (0-10) */
  gaugeValue: number;
}

export interface StitchMenu2NewProps {
  /** Menu items to display */
  items?: MenuItem2Data[];
  /** Brand name shown in the navigation and footer */
  brandName?: string;
  /** Callback when Add to Order is clicked */
  onAddToOrder?: (item: MenuItem2Data) => void;
  /** Callback when the cart FAB is clicked */
  onCartClick?: () => void;
  /** Number of items currently in the cart */
  cartItemCount?: number;
}

export interface CategoryData {
  key: string;
  label: string;
}

export interface GaugeBarProps {
  label: string;
  value: number;
  max?: number;
}

export interface MenuCardProps {
  item: MenuItem2Data;
  isAdded: boolean;
  onAddToOrder: (item: MenuItem2Data) => void;
}

export interface HeaderProps {
  brandName: string;
}

export interface HeroProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export interface MenuGridProps {
  items: MenuItem2Data[];
  addedItems: Set<string>;
  onAddToOrder: (item: MenuItem2Data) => void;
}

export interface CraftSectionProps {
  // No props needed, uses i18n
}

export interface FooterProps {
  brandName: string;
}

export interface CartFabProps {
  cartItemCount: number;
  onCartClick: () => void;
}
