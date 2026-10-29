import type { ElementType } from 'react';

export interface CheckoutNewItem {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  price: number;
  imageUrl: string;
}

export interface CheckoutNewSummary {
  items: CheckoutNewItem[];
  subtotal: number;
  tax: number;
  taxLabel?: string;
  deliveryFee: number;
  deliveryLabel?: string;
  discount?: number;
  promoCode?: string;
  total: number;
}

export type OrderType = 'delivery' | 'takeaway' | 'dine_in';

export interface CheckoutNewFormData {
  fullName: string;
  phone: string;
  address: string;
  notes: string;
  paymentMethod: PaymentMethod;
  orderType?: OrderType;
  tableNumber?: string;
  promoCode?: string;
  discount?: number;
}

export interface StitchCheckoutNewProps {
  summary: CheckoutNewSummary | null;
  isLoading?: boolean;
  isProcessing?: boolean;
  error?: string | null;
  onPlaceOrder: (data: CheckoutNewFormData) => Promise<void>;
  locale?: string;
  onUpdateQuantity?: (id: string, quantity: number) => void;
  onRemoveItem?: (id: string) => void;
  onClearCart?: () => void;
}

export type PaymentMethod = 'payos' | 'cod';

export interface PaymentOption {
  value: PaymentMethod;
  label: string;
  descriptionKey: string;
  icon: ElementType;
}
