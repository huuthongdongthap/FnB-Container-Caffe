export interface CashDenomination {
  denomination: number;
  count: number;
}

export interface CashCount {
  denominations: CashDenomination[];
}

export type VarianceStatus = 'balanced' | 'overage' | 'shortage';

export interface ShiftReconciliation {
  id: string;
  shift_id: string;
  staff_id: string;
  opening_float: number;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  variance_status: VarianceStatus;
  denominations: CashCount;
  cash_payment_total: number;
  cash_payout_total: number;
  notes: string | null;
  created_at: string;
}

export interface ReconciliationInput {
  shift_id: string;
  opening_float: number;
  denominations: CashCount;
  notes?: string;
}
