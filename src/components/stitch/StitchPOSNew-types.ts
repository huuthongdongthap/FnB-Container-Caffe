import type { POSCustomer } from '@/hooks/use-pos-customer';

/* ─── Types ─────────────────────────────────────────────────────────── */
export interface POSNewMenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  image?: string;
}

export interface POSNewAddOn {
  id: string;
  name: string;
  price: number;
}

export interface POSNewCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface POSTableOption {
  id: string;
  name: string;
  code?: string;
  status: string;
  capacity?: number;
  zone?: string;
}

export type POSOrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface POSActiveShift {
  id: string;
  shiftName?: string;
  clockIn?: string | null;
  staffName?: string;
}

export interface StitchPOSNewProps {
  menuItems?: POSNewMenuItem[];
  addOns?: POSNewAddOn[];
  /** Map of category ID (e.g. cat_trad_coffee) to Vietnamese display label */
  categoryLabels?: Record<string, string>;
  /** Real tables loaded from /api/tables for table selector */
  tables?: POSTableOption[];
  /** Currently selected table ID (undefined = Takeaway / Mang về) */
  selectedTableId?: string;
  /** Called when cashier switches between Takeaway or a specific table */
  onSelectTable?: (tableId: string | undefined) => void;
  /** Selected order channel rendered inline in the POS menu toolbar */
  orderType?: POSOrderType;
  /** Called when cashier switches between dine_in, takeaway, and delivery */
  onOrderTypeChange?: (type: POSOrderType) => void;
  /** Delivery address when orderType is delivery */
  deliveryAddress?: string;
  /** Called when cashier edits delivery address */
  onDeliveryAddressChange?: (address: string) => void;
  /** Recipient name for walk-in delivery orders */
  deliveryRecipientName?: string;
  /** Called when cashier edits delivery recipient name */
  onDeliveryRecipientNameChange?: (name: string) => void;
  /** Recipient phone for walk-in delivery orders */
  deliveryRecipientPhone?: string;
  /** Called when cashier edits delivery recipient phone */
  onDeliveryRecipientPhoneChange?: (phone: string) => void;
  tableLabel?: string;
  guestLabel?: string;
  orderNumber?: string;
  loading?: boolean;
  error?: string | null;
  brandName?: string;
  /** Tax rate as a decimal (default 0 — Aura Cafe does not add hidden 5% VAT) */
  taxRate?: number;
  /** Discount amount to subtract before tax */
  discount?: number;
  /** Currently selected payment method */
  paymentMethod?: 'payos' | 'cod';
  /** Staff member name displayed in header */
  staffName?: string;
  /** Staff member role displayed in header */
  staffRole?: string;
  /** Currently open shift (null when no shift is open) */
  activeShift?: POSActiveShift | null;
  /** Triggered when clicking the shift badge (open or close shift) */
  onShiftAction?: () => void;
  /** Triggered for 1-tap POS header navigation */
  onNavigate?: (path: string) => void;
  /** Fired when "Complete Order" is clicked; return false to keep cart on error */
  onCompleteOrder?: (cart: POSNewCartItem[], total: number, tableId?: string) => void | boolean | Promise<void | boolean>;
  /** Fired when a payment method is selected */
  onPayment?: (method: 'payos' | 'cod') => void;
  /** Currently identified customer (null when none) */
  customer?: POSCustomer | null;
  /** Called when a customer is successfully identified */
  onCustomerFound?: (customer: POSCustomer) => void;
  /** Called when the cashier clears the customer */
  onClearCustomer?: () => void;
  /** Whether the cashier chose to apply customer cashback balance */
  useCashback?: boolean;
  /** Toggle customer cashback application */
  onToggleCashback?: (enabled: boolean) => void;
  /** Header/Footer action callbacks */
  onOpenSchedule?: () => void;
  onOpenDrawer?: () => void;
  onPrintReceipt?: () => void;
  onEndShift?: () => void;
  /** Incrementing key that clears the POS cart when changed */
  cartResetKey?: number;
}

/* ─── Helpers & Constants ───────────────────────────────────────────── */
export function formatPosPrice(val: number): string {
  return `${Math.round(val).toLocaleString('vi-VN')}₫`;
}

export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  All: 'Tất cả',
  cat_trad_coffee: 'Cà Phê Truyền Thống',
  'traditional-coffee': 'Cà Phê Truyền Thống',
  cat_hot_coffee: 'Cà Phê Nóng',
  'hot-coffee': 'Cà Phê Nóng',
  cat_iced_coffee: 'Cà Phê Đá',
  'iced-coffee': 'Cà Phê Đá',
  cat_frappuccino: 'Đá Xay',
  frappuccino: 'Đá Xay',
  cat_tea: 'Trà',
  tea: 'Trà',
  cat_fruit_tea: 'Trà Trái Cây',
  'fruit-tea': 'Trà Trái Cây',
  cat_milk_tea: 'Trà Sữa',
  'milk-tea': 'Trà Sữa',
  cat_matcha: 'Matcha',
  matcha: 'Matcha',
  cat_juice: 'Nước Ép',
  juice: 'Nước Ép',
  cat_smoothie: 'Sinh Tố',
  smoothie: 'Sinh Tố',
  smoothies: 'Sinh Tố',
  cat_soda: 'Soda',
  soda: 'Soda',
  cat_bottled: 'Đồ Uống Đóng Chai',
  bottled: 'Đồ Uống Đóng Chai',
  cat_yogurt: 'Sữa Chua',
  yogurt: 'Sữa Chua',
  cat_pastry: 'Bánh Ngọt',
  cat_pastries: 'Bánh Ngọt',
  pastry: 'Bánh Ngọt',
  pastries: 'Bánh Ngọt',
  cat_snack: 'Ăn Nhẹ',
  snack: 'Ăn Nhẹ',
  cat_signature: 'Signature',
  signature: 'Signature',
  cat_topping: 'Topping',
  topping: 'Topping',
};

export function resolvePosCategoryLabel(
  categoryId: string,
  categoryLabels?: Record<string, string>,
): string {
  if (categoryId === 'All') {
    return categoryLabels?.All ?? DEFAULT_CATEGORY_LABELS.All ?? 'Tất cả';
  }
  const custom = categoryLabels?.[categoryId];
  if (custom) return custom;
  const fallback = DEFAULT_CATEGORY_LABELS[categoryId];
  if (fallback) return fallback;
  if (categoryId.startsWith('cat_')) {
    return categoryId
      .slice(4)
      .split('_')
      .map((w) => (w ? `${w.charAt(0).toUpperCase()}${w.slice(1)}` : ''))
      .join(' ');
  }
  return categoryId;
}

export const MENU_CATEGORIES = ['All'];

export const DEFAULT_MENU_ITEMS: POSNewMenuItem[] = [
  { id: 'm1', name: 'Midnight Espresso', price: 6.50, category: 'Coffee' },
  { id: 'm2', name: 'Chrome Velvet', price: 8.25, category: 'Coffee' },
  { id: 'm3', name: 'Silver Leaf Pastry', price: 5.50, category: 'Pastries' },
  { id: 'm4', name: 'Industrial Cold', price: 7.00, category: 'Coffee' },
  { id: 'm5', name: 'Matcha Zen', price: 6.75, category: 'Tea' },
  { id: 'm6', name: 'Smoked Truffle Croissant', price: 9.00, category: 'Pastries' },
  { id: 'm7', name: 'Hibiscus Spritz', price: 7.50, category: 'Signature' },
  { id: 'm8', name: 'Avocado Sourdough', price: 12.00, category: 'Brunch' },
  { id: 'm9', name: 'AURA Tumbler', price: 25.00, category: 'Merchandise' },
  { id: 'm10', name: 'Dark Chocolate Tart', price: 8.50, category: 'Pastries' },
  { id: 'm11', name: 'Lavender Scone', price: 5.00, category: 'Pastries' },
  { id: 'm12', name: 'Golden Matcha Latte', price: 7.25, category: 'Tea' },
];

export const DEFAULT_ADDONS: POSNewAddOn[] = [];
