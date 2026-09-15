/**
 * Shift domain models.
 */
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
