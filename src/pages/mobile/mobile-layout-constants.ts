import type { Tab } from './mobile-layout-types';

export const ROLE_ACCESS: Record<Tab, string[]> = {
  kds: ['kitchen', 'bep', 'manager', 'owner', 'admin'],
  orders: ['waiter', 'phuc_vu', 'manager', 'owner', 'admin'],
  tables: ['waiter', 'phuc_vu', 'kitchen', 'bep', 'manager', 'owner', 'admin'],
  notifications: ['waiter', 'phuc_vu', 'kitchen', 'bep', 'manager', 'owner', 'admin'],
  profile: ['waiter', 'phuc_vu', 'kitchen', 'bep', 'manager', 'owner', 'admin'],
};

export const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'kds', label: 'Bếp', icon: '🍳' },
  { id: 'orders', label: 'Đơn', icon: '📋' },
  { id: 'tables', label: 'Bàn', icon: '🪑' },
  { id: 'notifications', label: 'Thông báo', icon: '🔔' },
  { id: 'profile', label: 'Cá nhân', icon: '👤' },
];

export function canAccess(tab: Tab, role: string): boolean {
  return ROLE_ACCESS[tab].some((a) => role.toLowerCase().includes(a));
}
