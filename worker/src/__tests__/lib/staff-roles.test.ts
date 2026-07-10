import { describe, it, expect } from 'vitest';
import { STAFF_ROLES, ROLE_LABELS, ROLE_PERMISSIONS, hasPermission, visibleRolesFor } from '../../lib/staff-roles';

describe('STAFF_ROLES', () => {
  it('lists exactly 4 roles', () => {
    expect(STAFF_ROLES).toHaveLength(4);
  });
  it('contains owner, manager, staff, waiter', () => {
    expect(STAFF_ROLES).toEqual(['owner', 'manager', 'staff', 'waiter']);
  });
});

describe('ROLE_LABELS', () => {
  it('has vi and en for each role', () => {
    for (const role of STAFF_ROLES) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(ROLE_LABELS[role].vi).toBeTruthy();
      expect(ROLE_LABELS[role].en).toBeTruthy();
    }
  });
  it('owner label is correct', () => {
    expect(ROLE_LABELS.owner.vi).toBe('Chủ');
    expect(ROLE_LABELS.owner.en).toBe('Owner');
  });
  it('waiter label is correct', () => {
    expect(ROLE_LABELS.waiter.vi).toBe('Phục vụ');
    expect(ROLE_LABELS.waiter.en).toBe('Waiter');
  });
});

describe('ROLE_PERMISSIONS', () => {
  it('owner has wildcard permission', () => {
    expect(ROLE_PERMISSIONS.owner).toContain('*');
    expect(ROLE_PERMISSIONS.owner.length).toBeGreaterThanOrEqual(1);
  });
  it('manager can view KDS, tables, orders', () => {
    expect(ROLE_PERMISSIONS.manager).toContain('kds:view');
    expect(ROLE_PERMISSIONS.manager).toContain('tables:view');
    expect(ROLE_PERMISSIONS.manager).toContain('orders:create');
  });
  it('staff (kitchen) can view KDS', () => {
    expect(ROLE_PERMISSIONS.staff).toContain('kds:view');
    expect(ROLE_PERMISSIONS.staff).toContain('kds:update');
  });
  it('waiter can create orders and update tables', () => {
    expect(ROLE_PERMISSIONS.waiter).toContain('orders:create');
    expect(ROLE_PERMISSIONS.waiter).toContain('tables:update');
  });
});

describe('hasPermission', () => {
  it('returns true for owner on any permission', () => {
    expect(hasPermission('owner', 'anything')).toBe(true);
    expect(hasPermission('owner', 'admin:nuke')).toBe(true);
  });
  it('returns true when role explicitly has permission', () => {
    expect(hasPermission('manager', 'kds:view')).toBe(true);
    expect(hasPermission('waiter', 'orders:create')).toBe(true);
  });
  it('returns false when role lacks permission', () => {
    expect(hasPermission('staff', 'payments:view')).toBe(false);
    expect(hasPermission('waiter', 'payments:view')).toBe(false);
  });
  it('returns false for unknown role', () => {
    expect(hasPermission('guest', 'anything')).toBe(false);
  });
});

describe('visibleRolesFor', () => {
  it('owner sees all 4 roles', () => {
    expect(visibleRolesFor('owner')).toHaveLength(4);
  });
  it('manager sees staff and waiter', () => {
    const visible = visibleRolesFor('manager');
    expect(visible).toContain('staff');
    expect(visible).toContain('waiter');
    expect(visible).not.toContain('owner');
    expect(visible).not.toContain('manager');
  });
  it('staff sees only self', () => {
    expect(visibleRolesFor('staff')).toEqual(['staff']);
  });
  it('waiter sees only self', () => {
    expect(visibleRolesFor('waiter')).toEqual(['waiter']);
  });
  it('unknown role returns empty? (current behavior)', () => {
    expect(visibleRolesFor('customer')).toEqual(['customer']);
  });
});
