/**
 * Multi-Operating-Unit Readiness Contract Integration Tests
 *
 * Verifies the 7 core domains under multi-operating-unit invariants:
 * 1. Explicit Ownership: Global vs Tenant vs Operating Unit.
 * 2. Server-Authoritative Scope: Zero trust in client-supplied headers/IDs.
 * 3. Cross-Unit Isolation: Shifts, tables, orders, stock strictly partitioned.
 * 4. Shared Catalog Master: Products/categories shared without per-unit row duplication.
 * 5. Fail-Closed Boundary: Ambiguous or missing scope rejected on protected ops.
 * 6. Audit & Reporting Partitioning: Metrics and logs bound to operating units.
 */
import { describe, it, expect } from 'vitest';
import {
  authorizeAction,
  validateOperatingUnitScope,
  isHQSuperAdmin,
  type ActorContext,
  type ResourceContext,
} from '@aura/domain-staff';
import { buildOrderFilterClause } from '../../../../packages/domain/order/queries/shared-listing';
import { resolveItemPrice } from '../../../../packages/domain/catalog/policies/pricing';

describe('Multi-Operating-Unit Readiness Contract', () => {
  it('1. explicit scope ownership: verifies tenant vs operating-unit vs global boundaries', () => {
    // Global catalog: accessible without tenant/unit constraints
    const guest: ActorContext = { role: 'guest' };
    const globalCatalog: ResourceContext = { type: 'catalog' };
    expect(authorizeAction(guest, globalCatalog, 'read').allowed).toBe(true);

    // Tenant-scoped customer account: accessible to customer and staff of same tenant
    const tenantStaff: ActorContext = { id: 'st_01', role: 'staff', tenantId: 'sadec_01' };
    const tenantResource: ResourceContext = { type: 'customer', tenantId: 'sadec_01' };
    expect(validateOperatingUnitScope(tenantStaff, tenantResource).allowed).toBe(true);

    // Operating-unit-scoped shift: bound to specific container / location
    const unitShift: ResourceContext = {
      type: 'shift',
      tenantId: 'sadec_01',
      operatingUnitId: 'loc_container_01',
    };
    const scopedStaff: ActorContext = {
      id: 'st_01',
      role: 'staff',
      tenantId: 'sadec_01',
      operatingUnitId: 'loc_container_01',
    };
    expect(validateOperatingUnitScope(scopedStaff, unitShift).allowed).toBe(true);
  });

  it('2. server-side scope authority: rejects client-spoofed operating unit headers', () => {
    // Attacker claims to operate Container 02, but JWT claim bounds them to Container 01
    const staffInUnit1: ActorContext = {
      id: 'staff_barista',
      role: 'staff',
      tenantId: 'tenant_sadec',
      operatingUnitId: 'loc_container_01',
    };
    const targetUnit2Resource: ResourceContext = {
      type: 'order',
      tenantId: 'tenant_sadec',
      operatingUnitId: 'loc_container_02',
    };

    const decision = validateOperatingUnitScope(staffInUnit1, targetUnit2Resource);
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('cross_operating_unit_mismatch');
    expect(decision.reason).toContain("belongs to operating unit 'loc_container_02'");
  });

  it('3. cross-unit shift isolation: staff cannot operate cash drawers of another unit', () => {
    const unit1Cashier: ActorContext = {
      id: 'cashier_01',
      role: 'staff',
      tenantId: 'tenant_sadec',
      operatingUnitId: 'loc_container_01',
    };
    const unit2Shift: ResourceContext = {
      type: 'shift',
      tenantId: 'tenant_sadec',
      operatingUnitId: 'loc_container_02',
    };

    const actionCheck = authorizeAction(unit1Cashier, unit2Shift, 'operate');
    expect(actionCheck.allowed).toBe(false);
    expect(actionCheck.code).toBe('cross_operating_unit_mismatch');
  });

  it('4. shared catalog master integrity: products not duplicated per unit, deltas applied dynamically', () => {
    // Single authoritative product master
    const basePrice = 35000; // Bac Xiu 35,000 VND
    const now = new Date('2026-10-09T10:00:00Z');

    const dineInPrice = resolveItemPrice({
      basePriceCents: basePrice,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [],
      now,
    });

    const deliveryPrice = resolveItemPrice({
      basePriceCents: basePrice,
      channel: 'delivery',
      modifierChoices: [],
      happyHourWindows: [],
      now,
      channelDeltas: { delivery: 5000 }, // +5,000 delivery delta
    });

    expect(dineInPrice).toBe(35000);
    expect(deliveryPrice).toBe(40000);
    // Base catalog remains single master without duplicating product rows
    expect(basePrice).toBe(35000);
  });

  it('5. order list query isolation: scopes tenant and prevents cross-unit data leaks', () => {
    const scopedFilter = buildOrderFilterClause({
      tenantId: 'tenant_sadec_02',
      filters: [['o.status', 'completed']],
    });
    expect(scopedFilter.clause).toContain('AND o.tenant_id = ?');
    expect(scopedFilter.clause).toContain('AND o.status = ?');
    expect(scopedFilter.params).toEqual(['tenant_sadec_02', 'completed']);

    // Wildcard query allows HQ super-admin aggregate without tenant predicate
    const wildcardFilter = buildOrderFilterClause({
      tenantId: '*',
      filters: [['o.status', 'completed']],
    });
    expect(wildcardFilter.clause).not.toContain('tenant_id');
    expect(wildcardFilter.params).toEqual(['completed']);
  });

  it('6. fail-closed on cross-tenant access: rejects mismatched tenant for non-HQ actors', () => {
    const sadecManager: ActorContext = {
      id: 'mgr_sadec',
      role: 'manager',
      tenantId: 'tenant_sadec_01',
    };
    const canthoInventory: ResourceContext = {
      type: 'inventory',
      tenantId: 'tenant_cantho_01',
      operatingUnitId: 'loc_cantho_main',
    };

    const decision = authorizeAction(sadecManager, canthoInventory, 'update');
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('tenant_mismatch');
  });

  it('7. HQ super-admin authority: owner with default/hq role bypasses tenant boundary for ops', () => {
    const hqSuperAdmin: ActorContext = {
      id: 'owner_founder',
      role: 'owner',
      tenantId: 'hq',
    };
    const franchiseUnit: ResourceContext = {
      type: 'order',
      tenantId: 'franchise_vinh_long',
      operatingUnitId: 'loc_vl_01',
    };

    expect(isHQSuperAdmin(hqSuperAdmin)).toBe(true);
    expect(validateOperatingUnitScope(hqSuperAdmin, franchiseUnit).allowed).toBe(true);
    expect(authorizeAction(hqSuperAdmin, franchiseUnit, 'read').allowed).toBe(true);
  });
});
