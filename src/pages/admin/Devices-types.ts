export interface DeviceRow {
  id: string;
  staff_id: string;
  device_name: string | null;
  role: string;
  last_login_at: string | null;
  created_at: string;
}

export interface StaffOption {
  id: string;
  name: string;
  role: string;
}
