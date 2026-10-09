/**
 * Canonical Audit Trail & Operational Event Contract Integration Tests
 * Verifies append-only logging, sensitive data redaction, diff tracking,
 * failure policies, correlation, and multi-tenant operating unit boundaries.
 */
import { describe, it, expect } from 'vitest';
import {
  writeCanonicalAuditLog, recordAuthorizationFailure, redactSensitiveData,
  calculateSafeDiff, type AuditPayload, type AuditActor,
} from '@aura/domain-audit';

function createMockDb() {
  const rows: any[] = [];
  let shouldFail = false;
  return {
    setShouldFail: (val: boolean) => { shouldFail = val; },
    getRows: () => rows,
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => { binds = args; return stmt; },
        run: async () => {
          if (shouldFail) throw new Error('D1 storage failure');
          if (sql.includes('INSERT INTO audit_logs')) {
            rows.push({
              id: binds[0], actor_id: binds[1], actor_name: binds[2], user_id: binds[3],
              action: binds[4], resource_type: binds[5], resource_id: binds[6],
              entity_type: binds[7], entity_id: binds[8], operating_unit_id: binds[9],
              tenant_id: binds[10], status: binds[11], details: binds[12], metadata: binds[13],
              correlation_id: binds[14], ip_address: binds[15], created_at: binds[16],
            });
          }
          return { success: true };
        },
      };
      return stmt as any;
    },
  };
}

describe('Audit Trail & Operational Event Contract', () => {
  it('1. successful mutation: writes canonical audit log with actor, action, and correlation ID', async () => {
    const db = createMockDb();
    const actor: AuditActor = { id: 'staff_01', name: 'Barista John', role: 'staff', tenantId: 'sadec', operatingUnitId: 'bar_1' };
    const payload: AuditPayload = {
      actor, action: 'order.created', resourceType: 'order', resourceId: 'ord_101',
      correlationId: 'corr_flow_01', outcome: 'success', metadata: { total: 45000, itemsCount: 2 },
    };
    const res = await writeCanonicalAuditLog(db as any, payload);
    expect(res.ok).toBe(true);
    expect(db.getRows().length).toBe(1);
    const row = db.getRows()[0];
    expect(row.actor_id).toBe('staff_01');
    expect(row.action).toBe('order.created');
    expect(row.operating_unit_id).toBe('bar_1');
    expect(row.tenant_id).toBe('sadec');
    expect(row.correlation_id).toBe('corr_flow_01');
    expect(row.status).toBe('success');
  });

  it('2. rejected authorization: records rejected auth attempt with reason and actor context', async () => {
    const db = createMockDb();
    const actor: AuditActor = { id: 'waiter_02', name: 'Waiter Bob', role: 'waiter', tenantId: 'sadec' };
    await recordAuthorizationFailure(db as any, actor, { type: 'shift', id: 'shift_99' }, 'unauthorized_role', {
      correlationId: 'corr_auth_01', operatingUnitId: 'pos_2', tenantId: 'sadec',
    });
    expect(db.getRows().length).toBe(1);
    const row = db.getRows()[0];
    expect(row.action).toBe('auth.rejected');
    expect(row.status).toBe('rejected');
    expect(JSON.parse(row.details).reason).toBe('unauthorized_role');
  });

  it('3. before/after diff: computes safe diff capturing changed keys and values', () => {
    const before = { name: 'Iced Latte', price: 40000, secretRecipeCode: 'RECIPE_SECRET' };
    const after = { name: 'Iced Latte Special', price: 45000, secretRecipeCode: 'RECIPE_SECRET' };
    const diff = calculateSafeDiff(before, after);
    expect(diff.changes).toEqual(['name', 'price']);
    expect(diff.before?.name).toBe('Iced Latte');
    expect(diff.after?.name).toBe('Iced Latte Special');
    expect(diff.before?.secretRecipeCode).toBe('[REDACTED]');
  });

  it('4. cross-unit access: logs operating unit mismatch when actor crosses boundary', async () => {
    const db = createMockDb();
    const actor: AuditActor = { id: 'staff_01', role: 'staff', tenantId: 'sadec', operatingUnitId: 'counter_1' };
    const res = await writeCanonicalAuditLog(db as any, {
      actor, action: 'shift.operate', resourceType: 'shift', resourceId: 'shift_counter_2',
      operatingUnitId: 'counter_2', outcome: 'rejected', reason: 'cross_operating_unit_mismatch',
    });
    expect(res.ok).toBe(true);
    expect(db.getRows()[0].operating_unit_id).toBe('counter_2');
    expect(db.getRows()[0].status).toBe('rejected');
  });

  it('5. retry/idempotency: retries with same correlation ID log idempotency trace', async () => {
    const db = createMockDb();
    const actor: AuditActor = { id: 'cust_01', role: 'customer' };
    const payload: AuditPayload = {
      actor, action: 'payment.create', resourceType: 'payment', resourceId: 'pay_link_01',
      correlationId: 'corr_pay_unique_123',
    };
    const firstWrite = await writeCanonicalAuditLog(db as any, payload);
    const secondWrite = await writeCanonicalAuditLog(db as any, { ...payload, metadata: { idempotent_retry: true } });
    expect(firstWrite.ok).toBe(true);
    expect(secondWrite.ok).toBe(true);
    expect(db.getRows().length).toBe(2);
    expect(db.getRows()[0].correlation_id).toBe('corr_pay_unique_123');
    expect(db.getRows()[1].correlation_id).toBe('corr_pay_unique_123');
    expect(JSON.parse(db.getRows()[1].details).metadata.idempotent_retry).toBe(true);
  });

  it('6. sensitive-field redaction: masks credentials, tokens, cards, and authorization headers', () => {
    const rawData = {
      password: 'mySecretPassword123',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozG5q',
      pin: '1234', card_number: '4532015012345678', normalField: 'Public product name',
    };
    const sanitized = redactSensitiveData(rawData) as any;
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.pin).toBe('[REDACTED]');
    expect(sanitized.card_number).toBe('[REDACTED]');
    expect(sanitized.normalField).toBe('Public product name');
  });

  it('7. append-only behavior: mutations create new records with linked correlation IDs', async () => {
    const db = createMockDb();
    const actor: AuditActor = { id: 'mgr_01', role: 'manager' };
    await writeCanonicalAuditLog(db as any, {
      actor, action: 'inventory.stock_in', resourceType: 'inventory', resourceId: 'item_coffee_beans',
      correlationId: 'corr_po_500', metadata: { qtyAdded: 50 },
    });
    await writeCanonicalAuditLog(db as any, {
      actor, action: 'inventory.adjustment', resourceType: 'inventory', resourceId: 'item_coffee_beans',
      correlationId: 'corr_po_500', metadata: { qtyAdjusted: -2, reason: 'spillage' },
    });
    expect(db.getRows().length).toBe(2);
    expect(db.getRows()[0].id).not.toBe(db.getRows()[1].id);
    expect(db.getRows()[0].correlation_id).toBe(db.getRows()[1].correlation_id);
  });

  it('8. audit-write failure handling: best_effort logs error, strict_fail_closed throws', async () => {
    const db = createMockDb();
    db.setShouldFail(true);
    const actor: AuditActor = { id: 'system', role: 'owner' };
    const bestEffortRes = await writeCanonicalAuditLog(db as any, {
      actor, action: 'order.sync', resourceType: 'order',
    }, { policy: 'best_effort' });
    expect(bestEffortRes.ok).toBe(false);
    expect(bestEffortRes.error).toContain('D1 storage failure');

    await expect(writeCanonicalAuditLog(db as any, {
      actor, action: 'payment.capture', resourceType: 'payment',
    }, { policy: 'strict_fail_closed' })).rejects.toThrow('Audit write failed under strict_fail_closed policy');
  });

  it('9. correlation across Order/Payment/Shift: unified correlation links related lifecycle events', async () => {
    const db = createMockDb();
    const sharedCorrelationId = 'corr_checkout_lifecycle_999';
    await writeCanonicalAuditLog(db as any, {
      actor: { id: 'staff_01', role: 'staff', operatingUnitId: 'pos_1' },
      action: 'shift.order_added', resourceType: 'shift', resourceId: 'shift_01', correlationId: sharedCorrelationId,
    });
    await writeCanonicalAuditLog(db as any, {
      actor: { id: 'cust_01', role: 'customer' },
      action: 'order.created', resourceType: 'order', resourceId: 'ord_999', correlationId: sharedCorrelationId,
    });
    await writeCanonicalAuditLog(db as any, {
      actor: { id: 'cust_01', role: 'customer' },
      action: 'payment.completed', resourceType: 'payment', resourceId: 'pay_999', correlationId: sharedCorrelationId,
    });
    expect(db.getRows().length).toBe(3);
    expect(db.getRows().every(r => r.correlation_id === sharedCorrelationId)).toBe(true);
  });

  it('10. schema and migration compatibility: generates both legacy and canonical field mappings', async () => {
    const actor: AuditActor = { id: 'admin_01', name: 'Admin', role: 'owner' };
    const payload: AuditPayload = {
      actor, action: 'tenant.setting_updated', resourceType: 'tenant', resourceId: 'tenant_dalat', metadata: { theme: 'dark' },
    };
    const out = await writeCanonicalAuditLog({ prepare: () => ({ bind: () => ({ run: async () => ({ success: true }) }) }) } as any, payload);
    expect(out.record.actor_id).toBe('admin_01');
    expect(out.record.user_id).toBe('admin_01');
    expect(out.record.resource_type).toBe('tenant');
    expect(out.record.entity_type).toBe('tenant');
    expect(out.record.status).toBe('success');
  });
});
