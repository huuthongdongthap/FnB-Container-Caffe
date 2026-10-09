/**
 * Canonical Shift, Staff & POS Domain Types
 */
import type { StaffRole } from '@aura/domain-staff';

export type ShiftStatus = 'open' | 'closed' | 'audited';

export interface ShiftRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  role: StaffRole;
  operating_unit_id: string;
  clock_in: string;
  clock_out: string | null;
  status: ShiftStatus;
  opening_cash: number;
  expected_cash: number | null;
  actual_cash: number | null;
  cash_variance: number | null;
  total_sales: number;
  cash_sales: number;
  online_sales: number;
  order_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenShiftInput {
  staffId: string;
  staffName: string;
  role: StaffRole;
  operatingUnitId?: string;
  openingCash: number;
  notes?: string;
}

export interface PosSaleInput {
  shiftId: string;
  orderId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'payos' | 'sepay' | 'transfer' | string;
  staffId?: string;
  operatingUnitId?: string;
}

export interface CloseShiftInput {
  shiftId: string;
  closedByStaffId: string;
  closedByRole: StaffRole;
  actualCash: number;
  notes?: string;
}

export interface ShiftSummary {
  shift: ShiftRecord;
  cashPayments: number;
  nonCashPayments: number;
  totalOrders: number;
  expectedCash: number;
  variance: number | null;
}
