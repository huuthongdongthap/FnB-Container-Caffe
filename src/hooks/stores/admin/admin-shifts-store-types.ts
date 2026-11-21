export interface ShiftRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number | null;
  date: string;
  notes: string | null;
  opening_cash?: number;
  attendance_state?: 'scheduled' | 'active' | 'completed' | 'cancelled' | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string;
}

export interface ClockInOptions {
  openingCash?: number;
  scheduledShiftId?: string;
  notes?: string;
}

export interface CashDenominationEntry {
  denomination: number;
  count: number;
}

export interface ShiftReconciliationRecord {
  id: string;
  shift_id: string;
  staff_id: string;
  reconciled_by?: string;
  opening_float: number;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  variance_status: 'balanced' | 'overage' | 'shortage';
  cash_payment_total: number;
  cash_payout_total: number;
  notes: string | null;
  created_at: string;
}

export interface TodayResponse {
  success: boolean;
  data: ShiftRecord[];
}

export interface SingleShiftResponse {
  success: boolean;
  data: ShiftRecord;
}

export interface LoadingMap {
  today: boolean;
  history: boolean;
  clockIn: boolean;
  clockOut: boolean;
}

export interface AdminShiftsState {
  todayShifts: ShiftRecord[];
  historyShifts: ShiftRecord[];
  loading: LoadingMap;
  error: string | null;
  fetchToday: () => Promise<void>;
  fetchHistory: (staffId?: string) => Promise<void>;
  clockIn: (staffId: string, staffName: string, options?: ClockInOptions) => Promise<ShiftRecord | null>;
  clockOut: (staffId: string, notes?: string) => Promise<ShiftRecord | null>;
  reset: () => void;
}
