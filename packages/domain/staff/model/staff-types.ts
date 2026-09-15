/**
 * Staff domain models.
 */
export interface StaffTipRow {
  staff_id: string;
  staff_name: string;
  date: string;
  tip_total: number;
  order_count: number;
  session_count: number;
}
