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
  total: number;
}

export interface CheckoutNewFormData {
  fullName: string;
  phone: string;
  address: string;
  notes: string;
  paymentMethod: PaymentMethod;
}

export interface StitchCheckoutNewProps {
  summary: CheckoutNewSummary | null;
  isProcessing?: boolean;
  error?: string | null;
  onPlaceOrder: (data: CheckoutNewFormData) => Promise<void>;
  locale?: string;
}

export type PaymentMethod = 'payos' | 'cod' | 'apple_pay' | 'google_pay';

export interface PaymentOption {
  value: PaymentMethod;
  label: string;
  descriptionKey: string;
  icon: ElementType;
}
