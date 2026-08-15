/**
 * Types and constants for notification settings.
 */

export type StaffSubscription = {
  name: string;
  role: 'owner' | 'staff' | 'all';
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
  { value: 'staff', labelVn: 'Nhân viên', labelEn: 'Staff' },
  { value: 'all', labelVn: 'Tất cả', labelEn: 'All' },
];
