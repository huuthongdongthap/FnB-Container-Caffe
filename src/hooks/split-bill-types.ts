import type { CartItem } from '@/hooks/stores/use-cart-store';

export const SPLIT_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981'] as const;
export const SPLIT_NAMES = ['Người 1', 'Người 2', 'Người 3', 'Người 4'] as const;

export interface SplitResult {
  index: number;
  name: string;
  color: string;
  items: CartItem[];
  subtotal: number;
  serviceFee: number;
  total: number;
}

export interface SplitConfirmPayload {
  customer_name: string;
  customer_phone: string;
  payment_method: string;
}
