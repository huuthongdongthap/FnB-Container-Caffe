/**
 * StitchOrderSuccessNew — Type definitions and constants
 *
 * Shared interfaces, status steps, and progress config
 * for the AURA CAFE order success confirmation screen.
 */

/* ─── Order Item ─────────────────────────────────────────────────────────── */

export interface OrderSuccessNewItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

/* ─── Order Data ─────────────────────────────────────────────────────────── */

export interface OrderSuccessNewData {
  orderId: string;
  items: OrderSuccessNewItem[];
  total: number;
  estimatedMinutes: number;
  locationName: string;
  locationImageUrl?: string;
  customerName?: string;
  table?: string;
}

/* ─── Component Props ────────────────────────────────────────────────────── */

export interface StitchOrderSuccessNewProps {
  order: OrderSuccessNewData | null;
  isLoading?: boolean;
  error?: string | null;
  locale?: string;
  currency?: 'VND' | 'USD';
  onTrackOrder?: () => void;
  onBack?: () => void;
  onAccount?: () => void;
  onRefresh?: () => void;
}

/* ─── Status Steps ───────────────────────────────────────────────────────── */

export const STATUS_STEPS = ['received', 'preparing', 'ready'] as const;

/** Matches HTML design: Received + Preparing active */
export const PROGRESS_PERCENT = 50;
