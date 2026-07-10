/**
 * Staff Roles & RBAC — AURA Mobile
 * Roles: owner | manager | staff (kitchen) | waiter
 */

export type StaffRole = 'owner' | 'manager' | 'staff' | 'waiter';

export const STAFF_ROLES: readonly StaffRole[] = [
  'owner',
  'manager',
  'staff',
  'waiter',
] as const;

export const ROLE_LABELS: Record<StaffRole, { vi: string; en: string }> = {
  owner: { vi: 'Chủ', en: 'Owner' },
  manager: { vi: 'Quản lý', en: 'Manager' },
  staff: { vi: 'Bếp', en: 'Kitchen' },
  waiter: { vi: 'Phục vụ', en: 'Waiter' },
};

export const ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  owner: ['*'], // everything
  manager: [
    'kds:view', 'kds:update',
    'tables:view', 'tables:update',
    'orders:view', 'orders:create', 'orders:update',
    'staff:view', 'staff:manage',
    'analytics:view', 'payments:view',
  ],
  staff: [
    'kds:view', 'kds:update',
    'orders:view',
  ],
  waiter: [
    'orders:view', 'orders:create', 'orders:update',
    'tables:view', 'tables:update',
  ],
};

export function hasPermission(role: StaffRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

export function visibleRolesFor(role: StaffRole): readonly StaffRole[] {
  if (role === 'owner') return STAFF_ROLES;
  if (role === 'manager') return ['staff', 'waiter'];
  return [role];
}
