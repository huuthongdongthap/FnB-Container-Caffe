export interface ShiftRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  date: string;
  notes: string | null;
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
  clockIn: (staffId: string, staffName: string) => Promise<void>;
  clockOut: (staffId: string) => Promise<void>;
  reset: () => void;
}
