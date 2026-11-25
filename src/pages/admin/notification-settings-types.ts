/**
 * Types and constants for notification settings.
 */

export type StaffPushRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'supervisor'
  | 'staff'
  | 'staff-kitchen'
  | 'cashier'
  | 'waiter'
  | 'kitchen'
  | 'bep'
  | 'barista'
  | 'chef'
  | 'shipper'
  | 'rider'
  | 'all';

export type StaffSubscription = {
  name: string;
  role: StaffPushRole;
  endpoint: string;
  subscribed: boolean;
  createdAt?: string;
};

export type PushSettings = {
  autoNotifyNewOrder: boolean;
  soundAlerts: boolean;
};

export const ROLE_OPTIONS: {
  value: StaffSubscription['role'];
  labelVn: string;
  labelEn: string;
}[] = [
  { value: 'owner', labelVn: 'Chủ cửa hàng', labelEn: 'Owner' },
  { value: 'admin', labelVn: 'Quản trị', labelEn: 'Admin' },
  { value: 'manager', labelVn: 'Quản lý', labelEn: 'Manager' },
  { value: 'supervisor', labelVn: 'Giám sát', labelEn: 'Supervisor' },
  { value: 'staff', labelVn: 'Nhân viên', labelEn: 'Staff' },
  { value: 'cashier', labelVn: 'Thu ngân', labelEn: 'Cashier' },
  { value: 'waiter', labelVn: 'Phục vụ', labelEn: 'Waiter' },
  { value: 'kitchen', labelVn: 'Bếp', labelEn: 'Kitchen' },
  { value: 'barista', labelVn: 'Pha chế', labelEn: 'Barista' },
  { value: 'chef', labelVn: 'Đầu bếp', labelEn: 'Chef' },
  { value: 'shipper', labelVn: 'Giao hàng', labelEn: 'Shipper' },
  { value: 'all', labelVn: 'Tất cả', labelEn: 'All' },
];
