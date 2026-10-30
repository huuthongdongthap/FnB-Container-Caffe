/**
 * Staff role domain primitives.
 * Single source of truth for role taxonomy, RBAC permissions, labels, and role visibility.
 */
export type StaffRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'supervisor'
  | 'staff'
  | 'barista'
  | 'chef'
  | 'kitchen'
  | 'cashier'
  | 'waiter'
  | 'shipper';

export const STAFF_ROLES: readonly StaffRole[] = [
  'owner',
  'manager',
  'staff',
  'waiter',
] as const;

export const ROLE_LABELS: Record<StaffRole, { vi: string; en: string }> = {
  owner: { vi: 'Chủ', en: 'Owner' },
  admin: { vi: 'Quản trị', en: 'Admin' },
  manager: { vi: 'Quản lý', en: 'Manager' },
  supervisor: { vi: 'Giám sát', en: 'Supervisor' },
  staff: { vi: 'Bếp', en: 'Kitchen' },
  barista: { vi: 'Pha chế', en: 'Barista' },
  chef: { vi: 'Đầu bếp', en: 'Chef' },
  kitchen: { vi: 'Bếp', en: 'Kitchen' },
  cashier: { vi: 'Thu ngân', en: 'Cashier' },
  waiter: { vi: 'Phục vụ', en: 'Waiter' },
  shipper: { vi: 'Giao hàng', en: 'Shipper' },
};

export const ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  owner: ['*'],
  admin: ['*'],
  manager: [
    'kds:view', 'kds:update',
    'tables:view', 'tables:update',
    'orders:view', 'orders:create', 'orders:update',
    'staff:view', 'staff:manage',
    'analytics:view', 'payments:view',
  ],
  supervisor: [
    'kds:view', 'kds:update',
    'tables:view', 'tables:update',
    'orders:view', 'orders:create', 'orders:update',
    'staff:view',
    'analytics:view', 'payments:view',
  ],
  staff: [
    'kds:view', 'kds:update',
    'orders:view',
  ],
  barista: [
    'kds:view', 'kds:update',
    'orders:view',
  ],
  chef: [
    'kds:view', 'kds:update',
    'orders:view',
  ],
  kitchen: [
    'kds:view', 'kds:update',
    'orders:view',
  ],
  cashier: [
    'orders:view', 'orders:create', 'orders:update',
    'tables:view', 'tables:update',
    'payments:view',
  ],
  waiter: [
    'orders:view', 'orders:create', 'orders:update',
    'tables:view', 'tables:update',
  ],
  shipper: [
    'orders:view', 'orders:update',
    'payments:view',
  ],
};

export function hasPermission(role: StaffRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

export function visibleRolesFor(role: StaffRole): readonly StaffRole[] {
  if (role === 'owner' || role === 'admin') return STAFF_ROLES;
  if (role === 'manager') return ['staff', 'waiter'];
  return [role];
}
