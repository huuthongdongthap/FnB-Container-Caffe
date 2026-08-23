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

export interface StitchPOSNewProps {
  menuItems?: POSNewMenuItem[];
  addOns?: POSNewAddOn[];
  tableLabel?: string;
  guestLabel?: string;
  orderNumber?: string;
  loading?: boolean;
  error?: string | null;
  brandName?: string;
  /** Tax rate as a decimal (e.g. 0.05 = 5 %) */
  taxRate?: number;
  /** Fired when "Complete Order" is clicked */
  onCompleteOrder?: (cart: POSNewCartItem[], total: number) => void;
  /** Fired when a payment method is selected */
  onPayment?: (method: 'payos' | 'cod') => void;
  /** Currently identified customer (null when none) */
  customer?: POSCustomer | null;
  /** Called when a customer is successfully identified */
  onCustomerFound?: (customer: POSCustomer) => void;
  /** Called when the cashier clears the customer */
  onClearCustomer?: () => void;
}

/* ─── Constants ─────────────────────────────────────────────────────── */
export const MENU_CATEGORIES = ['Coffee', 'Tea', 'Signature', 'Pastries', 'Brunch', 'Merchandise'];

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

export const DEFAULT_ADDONS: POSNewAddOn[] = [
  { id: 'a1', name: 'Oat Milk', price: 1.00 },
  { id: 'a2', name: 'Double Shot', price: 2.00 },
  { id: 'a3', name: 'Vanilla Bean', price: 0.75 },
];
