import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   usePosCustomerLookup — POS customer identification by phone.
   GET /api/pos/customer?phone= (staff-auth protected).
   Fired on demand when the cashier submits a phone number.
   ═══════════════════════════════════════════════════════════════════ */

export interface POSCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  loyalty_tier: string;
  loyalty_tier_label: string;
  loyalty_points: number;
  lifetime_points: number;
  cashback_balance: number;
  total_earned: number;
  total_spent: number;
  visit_count: number;
  created_at: string;
}

interface POSCustomerLookupResponse {
  success: boolean;
  found: boolean;
  customer?: POSCustomer;
  message?: string;
}

export function usePosCustomerLookup() {
  return useMutation<POSCustomerLookupResponse, Error, string>({
    mutationFn: (phone) =>
      apiFetch<POSCustomerLookupResponse>(
        `/api/pos/customer?phone=${encodeURIComponent(phone)}`,
      ),
  });
}
