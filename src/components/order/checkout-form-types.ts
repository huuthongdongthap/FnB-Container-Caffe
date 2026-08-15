import type { CheckoutFormData } from '@/lib/validators';

export interface CheckoutFormProps {
  cartItems: Array<{ id: string; name: string; price: number; quantity: number }>;
  subtotal: number;
  serviceFee: number;
  total: number;
  qualifiesForFreeDelivery: boolean;
  remainingForFreeDelivery: number;
  isSubmitting: boolean;
  onSubmit: (data: CheckoutFormData) => void;
  onFormChange?: (data: { fullName: string; phone: string; paymentMethod: string }) => void;
}

export type FormErrors = Record<string, string | undefined>;
