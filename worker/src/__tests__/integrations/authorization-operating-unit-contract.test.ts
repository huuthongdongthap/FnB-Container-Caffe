/**
 * Canonical Authorization & Operating Unit Contract Integration Tests
 * Flow: Staff → Shift → Table → Order → Payment → Inventory
 * Verifies RBAC + Multi-Tenant Operating Unit Boundary Invariants (< 200 LOC).
 */
import { describe, it, expect } from 'vitest';
import {
  authorizeAction,
  validateOperatingUnitScope,
  isHQSuperAdmin,
  type ActorContext,
  type ResourceContext,
} from '@aura/domain-staff';

describe('Authorization & Operating Unit Contract', () => {
  it('1. unauthenticated guest access: allows public catalog, blocks protected staff/inventory', () => {
    const guest: ActorContext = { role: 'guest' };
    const catalogRes: ResourceContext = { type: 'catalog' };
    const staffRes: ResourceContext = { type: 'staff' };
    const invRes: ResourceContext = { type: 'inventory' };

    expect(authorizeAction(guest, catalogRes, 'read').allowed).toBe(true);
    const staffCheck = authorizeAction(guest, staffRes, 'read');
    expect(staffCheck.allowed).toBe(false);
    expect(staffCheck.code).toBe('unauthenticated');

    const invCheck = authorizeAction(guest, invRes, 'read');
    expect(invCheck.allowed).toBe(false);
    expect(invCheck.code).toBe('unauthenticated');
  });

  it('2. customer IDOR protection: allows own order, strictly blocks accessing peer orders', () => {
    const customerA: ActorContext = { id: 'cust_01', role: 'customer' };
    const ownOrder: ResourceContext = { type: 'order', id: 'ord_01', ownerId: 'cust_01' };
    const peerOrder: ResourceContext = { type: 'order', id: 'ord_02', ownerId: 'cust_02' };

    expect(authorizeAction(customerA, ownOrder, 'read').allowed).toBe(true);
    const peerCheck = authorizeAction(customerA, peerOrder, 'read');
    expect(peerCheck.allowed).toBe(false);
    expect(peerCheck.code).toBe('customer_idor');
  });

  it('3. role hierarchy & waiter boundaries: blocks waiter from operating shifts or mutating inventory', () => {
    const waiter: ActorContext = { id: 'waiter_01', role: 'waiter', tenantId: 'sadec' };
    const shiftRes: ResourceContext = { type: 'shift', tenantId: 'sadec' };
    const invRes: ResourceContext = { type: 'inventory', tenantId: 'sadec' };
    const orderRes: ResourceContext = { type: 'order', tenantId: 'sadec' };

    expect(authorizeAction(waiter, orderRes, 'create').allowed).toBe(true);
    const shiftCheck = authorizeAction(waiter, shiftRes, 'create');
    expect(shiftCheck.allowed).toBe(false);
    expect(shiftCheck.code).toBe('unauthorized_role');

    const invCheck = authorizeAction(waiter, invRes, 'update');
    expect(invCheck.allowed).toBe(false);
    expect(invCheck.code).toBe('unauthorized_role');
  });

  it('4. staff vs manager inventory: staff reads stock, only manager/owner can mutate', () => {
    const staff: ActorContext = { id: 'staff_01', role: 'staff', tenantId: 'sadec' };
    const manager: ActorContext = { id: 'mgr_01', role: 'manager', tenantId: 'sadec' };
    const invRes: ResourceContext = { type: 'inventory', tenantId: 'sadec' };

    expect(authorizeAction(staff, invRes, 'read').allowed).toBe(true);
    expect(authorizeAction(staff, invRes, 'update').allowed).toBe(false);
    expect(authorizeAction(staff, invRes, 'update').code).toBe('unauthorized_role');

    expect(authorizeAction(manager, invRes, 'read').allowed).toBe(true);
    expect(authorizeAction(manager, invRes, 'update').allowed).toBe(true);
  });

  it('5. peer shift closing protection: blocks peer staff from closing another shift', () => {
    const staffA: ActorContext = { id: 'staff_01', role: 'staff', tenantId: 'sadec' };
    const staffB: ActorContext = { id: 'staff_02', role: 'staff', tenantId: 'sadec' };
    const manager: ActorContext = { id: 'mgr_01', role: 'manager', tenantId: 'sadec' };

    const shiftA: ResourceContext = { type: 'shift', ownerId: 'staff_01', tenantId: 'sadec' };

    expect(authorizeAction(staffA, shiftA, 'update').allowed).toBe(true);
    const peerClose = authorizeAction(staffB, shiftA, 'update');
    expect(peerClose.allowed).toBe(false);
    expect(peerClose.code).toBe('unauthorized_role');

    expect(authorizeAction(manager, shiftA, 'update').allowed).toBe(true);
  });

  it('6. cross-tenant access rejection: non-HQ staff strictly blocked from foreign tenant', () => {
    const sadecStaff: ActorContext = { id: 'staff_01', role: 'staff', tenantId: 'tenant_sadec' };
    const dalatOrder: ResourceContext = { type: 'order', tenantId: 'tenant_dalat' };

    const check = authorizeAction(sadecStaff, dalatOrder, 'read');
    expect(check.allowed).toBe(false);
    expect(check.code).toBe('tenant_mismatch');
  });

  it('7. cross-operating-unit mismatch: blocks staff from operating outside their assigned unit', () => {
    const counter1Staff: ActorContext = {
      id: 'staff_01', role: 'staff', tenantId: 'sadec', operatingUnitId: 'counter_01',
    };
    const counter2Shift: ResourceContext = {
      type: 'shift', tenantId: 'sadec', operatingUnitId: 'counter_02',
    };

    const check = authorizeAction(counter1Staff, counter2Shift, 'operate');
    expect(check.allowed).toBe(false);
    expect(check.code).toBe('cross_operating_unit_mismatch');
  });

  it('8. forged tenant header rejection: server validates against actor tenant, not forged header', () => {
    const staff: ActorContext = { id: 'staff_01', role: 'staff', tenantId: 'tenant_sadec' };
    const resource: ResourceContext = { type: 'shift', tenantId: 'tenant_hanoi' };

    const scopeCheck = validateOperatingUnitScope(staff, resource);
    expect(scopeCheck.allowed).toBe(false);
    expect(scopeCheck.code).toBe('tenant_mismatch');
  });

  it('9. HQ super-admin bypass: owner with default/hq tenant has global tenant access', () => {
    const hqOwner: ActorContext = { id: 'owner_boss', role: 'owner', tenantId: 'hq' };
    const anyTenantResource: ResourceContext = { type: 'shift', tenantId: 'tenant_anywhere' };

    expect(isHQSuperAdmin(hqOwner)).toBe(true);
    expect(authorizeAction(hqOwner, anyTenantResource, 'read').allowed).toBe(true);
    expect(authorizeAction(hqOwner, anyTenantResource, 'admin').allowed).toBe(true);
  });
});
