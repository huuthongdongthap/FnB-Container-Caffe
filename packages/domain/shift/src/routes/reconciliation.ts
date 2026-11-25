import type { Hono } from 'hono';
import type { Env } from 'worker/src/types/env';
import { createLogger } from 'worker/src/middleware/logger';
import { RECONCILIATION_ROLES } from '../../model/shift-types';
import { extractRequestedShiftTenant, ShiftContractError } from '../../commands/shift-access';
import {
  reconcileShiftCash,
  getReconciliationForShift,
  assignCashPaymentsToShift,
  listShiftCashPayouts,
  createShiftCashPayout,
} from '../policies/cash-reconciliation-policy';
import type { ReconciliationInput } from '../model/reconciliation-types';

const log = createLogger({ route: 'shift-reconciliation' });

const HQ_ROLES = new Set(['owner', 'admin']);
const VALID_HTTP_VND_DENOMINATIONS = new Set([
  100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000,
]);

function isCashReconciliationEnabled(env: Record<string, unknown> | undefined): boolean {
  const flag = String(env?.CASH_RECONCILIATION_ENABLED ?? '').trim().toLowerCase();
  return flag === 'true' || flag === '1';
}

async function isTenantCashReconciliationOptedOut(
  env: Record<string, unknown> | undefined,
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { all: <T = unknown>() => Promise<{ results?: T[] | null }> } } },
  tenantId: string,
): Promise<boolean> {
  if (!tenantId || tenantId === '*' || tenantId.toLowerCase() === 'hq') return false;
  const disabledTenants = String(env?.CASH_RECONCILIATION_DISABLED_TENANTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (disabledTenants.includes(tenantId)) return true;

  try {
    // Tenant-specific row wins over the 'default' fallback row.
    const res = await db
      .prepare(
        `SELECT value FROM settings
         WHERE key = 'cash_reconciliation_enabled'
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') IN (?, 'default')
         ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END
         LIMIT 1`,
      )
      .bind(tenantId, tenantId)
      .all<{ value: string }>();
    const resolved = res.results?.[0]?.value;
    if (resolved !== undefined && ['false', '0'].includes(String(resolved).trim().toLowerCase())) return true;
  } catch {
    // settings table absent or unreadable → fall back to env flag only
  }
  return false;
}

async function resolveEffectiveReconTenant(
  db: Env['AURA_DB'],
  shiftId: string,
  scopeTenantId: string,
): Promise<string> {
  if (scopeTenantId && scopeTenantId !== '*' && scopeTenantId.toLowerCase() !== 'hq') {
    return scopeTenantId;
  }
  try {
    const row = await db
      .prepare('SELECT tenant_id FROM staff_shifts WHERE CAST(id AS TEXT) = ? LIMIT 1')
      .bind(shiftId)
      .first<{ tenant_id?: string | null }>();
    if (row && typeof row.tenant_id === 'string' && row.tenant_id.trim()) {
      return row.tenant_id.trim();
    }
    if (row) return 'default';
  } catch {
    try {
      const fallback = await db
        .prepare('SELECT tenant_id FROM staff_shifts WHERE id = ? LIMIT 1')
        .bind(shiftId)
        .first<{ tenant_id?: string | null }>();
      if (fallback && typeof fallback.tenant_id === 'string' && fallback.tenant_id.trim()) {
        return fallback.tenant_id.trim();
      }
      if (fallback) return 'default';
    } catch {
      // Fall back to scopeTenantId below
    }
  }
  return scopeTenantId;
}

function resolveReconciliationTenant(
  c: { req: { header: (k: string) => string | undefined; query: (k: string) => string | undefined }; get: (k: string) => unknown },
  user: Record<string, unknown>
): { tenantId?: string; error?: { status: 400 | 403; body: Record<string, unknown> } } {
  const userTenantCandidate =
    typeof user.tenantId === 'string' && user.tenantId.trim()
      ? user.tenantId.trim()
      : typeof user.tenant_id === 'string' && user.tenant_id.trim()
        ? user.tenant_id.trim()
        : '';
  const rawUserTenant = userTenantCandidate || 'default';
  const role = String(user.role || '');
  const isHq = HQ_ROLES.has(role) && (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq');
  const requested = extractRequestedShiftTenant(c);

  if (requested === '__CONFLICT__') {
    return { error: { status: 400, body: { success: false, error: 'Conflicting tenant scope parameters' } } };
  }
  if (!isHq) {
    if (requested && (requested === '*' || requested.toLowerCase() === 'hq' || requested !== rawUserTenant)) {
      return { error: { status: 403, body: { success: false, error: 'Forbidden cross-tenant reconciliation access' } } };
    }
    return { tenantId: rawUserTenant };
  }
  if (requested) {
    return { tenantId: requested.toLowerCase() === 'hq' ? '*' : requested };
  }
  const ctxTenant = typeof c.get('tenantId') === 'string' ? String(c.get('tenantId')).trim() : '';
  if (ctxTenant) {
    return { tenantId: ctxTenant.toLowerCase() === 'hq' ? '*' : ctxTenant };
  }
  return { tenantId: '*' };
}

export function reconciliationRoutes(app: Hono<{ Bindings: Env; Variables: { user: Record<string, unknown>; tenantId: string } }>) {
  app.post('/api/shifts/:id/reconcile', async (c) => {
    const user = c.get('user') as unknown as Record<string, unknown> | undefined;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (!RECONCILIATION_ROLES.has(String(user.role || ''))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!isCashReconciliationEnabled(c.env)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation is unavailable for the attendance pilot',
        },
        501
      );
    }

    const scope = resolveReconciliationTenant(c, user);
    if (scope.error) return c.json(scope.error.body, scope.error.status);

    const shiftId = c.req.param('id');
    const effectiveOptOutTenant = await resolveEffectiveReconTenant(c.env.AURA_DB, shiftId, scope.tenantId!);
    if (await isTenantCashReconciliationOptedOut(c.env, c.env.AURA_DB, effectiveOptOutTenant)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation disabled for tenant',
        },
        501,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) return c.json({ success: false, error: 'Invalid payload' }, 400);
    if (
      body.opening_float !== undefined &&
      (typeof body.opening_float !== 'number' || !Number.isInteger(body.opening_float) || body.opening_float < 0)
    ) {
      return c.json({ success: false, error: 'Invalid opening_float: must be a non-negative integer' }, 400);
    }
    if (
      body.remitted_cash !== undefined &&
      (typeof body.remitted_cash !== 'number' || !Number.isInteger(body.remitted_cash) || body.remitted_cash < 0)
    ) {
      return c.json({ success: false, error: 'Invalid remitted_cash: must be a non-negative integer' }, 400);
    }
    if (
      body.closing_float !== undefined &&
      (typeof body.closing_float !== 'number' || !Number.isInteger(body.closing_float) || body.closing_float < 0)
    ) {
      return c.json({ success: false, error: 'Invalid closing_float: must be a non-negative integer' }, 400);
    }
    if (
      body.actual_cash_counted !== undefined &&
      (typeof body.actual_cash_counted !== 'number' || !Number.isInteger(body.actual_cash_counted) || body.actual_cash_counted < 0)
    ) {
      return c.json({ success: false, error: 'Invalid actual_cash_counted: must be a non-negative integer' }, 400);
    }
    if (body.close_shift !== undefined && typeof body.close_shift !== 'boolean') {
      return c.json({ success: false, error: 'Invalid close_shift: must be a boolean' }, 400);
    }

    let rawDenomEntries: unknown[] = [];
    if (body.denominations !== undefined) {
      if (Array.isArray(body.denominations)) {
        rawDenomEntries = body.denominations;
      } else if (
        body.denominations &&
        typeof body.denominations === 'object' &&
        Array.isArray((body.denominations as Record<string, unknown>).denominations)
      ) {
        rawDenomEntries = (body.denominations as Record<string, unknown>).denominations as unknown[];
      } else {
        return c.json({ success: false, error: 'Invalid denominations payload' }, 400);
      }
    }
    for (const entry of rawDenomEntries) {
      const d = entry as { denomination?: unknown; count?: unknown } | null;
      if (
        !d ||
        typeof d !== 'object' ||
        typeof d.denomination !== 'number' ||
        !Number.isInteger(d.denomination) ||
        !VALID_HTTP_VND_DENOMINATIONS.has(d.denomination) ||
        typeof d.count !== 'number' ||
        !Number.isInteger(d.count) ||
        d.count < 0
      ) {
        return c.json(
          { success: false, error: 'Invalid cash denomination or count: must use valid VND denominations and non-negative integer counts' },
          400,
        );
      }
    }

    const staffId = String(user.sub || user.id || '');
    const denominations: ReconciliationInput['denominations'] = {
      denominations: rawDenomEntries as ReconciliationInput['denominations']['denominations'],
    };

    if (
      body.handover_to_staff_id !== undefined &&
      body.handover_to_staff_id !== null &&
      typeof body.handover_to_staff_id !== 'string'
    ) {
      return c.json({ success: false, error: 'Invalid handover_to_staff_id' }, 400);
    }
    const trimmedHandoverTo = typeof body.handover_to_staff_id === 'string' ? body.handover_to_staff_id.trim() : undefined;

    const input: ReconciliationInput & { actual_cash_counted?: unknown } = {
      shift_id: shiftId,
      opening_float: body.opening_float !== undefined ? (body.opening_float as number) : 0,
      denominations,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      ...(body.remitted_cash !== undefined ? { remitted_cash: body.remitted_cash as number } : {}),
      ...(body.closing_float !== undefined ? { closing_float: body.closing_float as number } : {}),
      ...(trimmedHandoverTo ? { handover_to_staff_id: trimmedHandoverTo } : {}),
      ...(typeof body.close_shift === 'boolean' ? { close_shift: body.close_shift } : {}),
      ...(body.actual_cash_counted !== undefined ? { actual_cash_counted: body.actual_cash_counted } : {}),
    };

    try {
      const result = await reconcileShiftCash(c.env, input, staffId, scope.tenantId, String(user.role || ''));
      return c.json({ success: true, data: result }, 201);
    } catch (err) {
      if (err instanceof ShiftContractError) {
        const ambiguousPaymentIds = Array.isArray(err.details?.ambiguous_payment_ids)
          ? err.details.ambiguous_payment_ids
          : undefined;
        return c.json(
          {
            success: false,
            error: err.message,
            ...(err.code ? { code: err.code } : {}),
            ...(err.details ? { details: err.details } : {}),
            ...(ambiguousPaymentIds ? { ambiguous_payment_ids: ambiguousPaymentIds } : {}),
          },
          err.status,
        );
      }
      log.error('Unexpected shift reconciliation error', {
        shiftId,
        message: err instanceof Error ? err.message : String(err),
      });
      return c.json({ success: false, error: 'Failed to reconcile shift cash' }, 500);
    }
  });

  app.get('/api/shifts/:id/reconciliation', async (c) => {
    const user = c.get('user') as unknown as Record<string, unknown> | undefined;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (!RECONCILIATION_ROLES.has(String(user.role || ''))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!isCashReconciliationEnabled(c.env)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation is unavailable for the attendance pilot',
        },
        501
      );
    }

    const scope = resolveReconciliationTenant(c, user);
    if (scope.error) return c.json(scope.error.body, scope.error.status);

    const shiftId = c.req.param('id');
    const effectiveOptOutTenant = await resolveEffectiveReconTenant(c.env.AURA_DB, shiftId, scope.tenantId!);
    if (await isTenantCashReconciliationOptedOut(c.env, c.env.AURA_DB, effectiveOptOutTenant)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation disabled for tenant',
        },
        501,
      );
    }

    const actorId = String(user.id || user.sub || '').trim();
    const actorRole = String(user.role || '').trim();
    try {
      const record = await getReconciliationForShift(c.env, shiftId, scope.tenantId, {
        id: actorId,
        role: actorRole,
      });
      if (!record) {
        return c.json({ success: false, error: 'Shift reconciliation not found' }, 404);
      }
      return c.json({ success: true, data: record });
    } catch (err) {
      if (err instanceof ShiftContractError) {
        return c.json({ success: false, error: err.message }, err.status as 400 | 403 | 404 | 409);
      }
      throw err;
    }
  });

  app.post('/api/shifts/:id/assign-cash-payments', async (c) => {
    const user = c.get('user') as unknown as Record<string, unknown> | undefined;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const role = String(user.role || '');
    if (!RECONCILIATION_ROLES.has(role)) return c.json({ error: 'Forbidden' }, 403);
    if (!isCashReconciliationEnabled(c.env)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation is disabled in attendance pilot mode',
        },
        501,
      );
    }

    const scope = resolveReconciliationTenant(c, user);
    if (scope.error) return c.json(scope.error.body, scope.error.status);
    const shiftId = c.req.param('id');
    const effectiveOptOutTenant = await resolveEffectiveReconTenant(c.env.AURA_DB, shiftId, scope.tenantId!);
    if (await isTenantCashReconciliationOptedOut(c.env, c.env.AURA_DB, effectiveOptOutTenant)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation disabled for tenant',
        },
        501,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
    }
    if (!body || typeof body !== 'object' || !Array.isArray(body.payment_ids)) {
      return c.json({ success: false, error: 'payment_ids array is required' }, 400);
    }

    const actorId = String(user.sub || user.id || '');
    try {
      const result = await assignCashPaymentsToShift(
        c.env,
        shiftId,
        body.payment_ids.map(String),
        actorId,
        scope.tenantId!,
        role,
      );
      return c.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof ShiftContractError) return c.json({ success: false, error: err.message }, err.status);
      log.error('Unexpected assign-cash-payments error', {
        shiftId,
        message: err instanceof Error ? err.message : String(err),
      });
      return c.json({ success: false, error: 'Failed to assign cash payments' }, 500);
    }
  });

  app.get('/api/shifts/:id/payouts', async (c) => {
    const user = c.get('user') as unknown as Record<string, unknown> | undefined;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const role = String(user.role || '');
    if (!RECONCILIATION_ROLES.has(role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    if (!isCashReconciliationEnabled(c.env)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation is disabled in attendance pilot mode',
        },
        501,
      );
    }
    const scope = resolveReconciliationTenant(c, user);
    if (scope.error) return c.json(scope.error.body, scope.error.status);
    const shiftId = c.req.param('id');
    const effectiveOptOutTenant = await resolveEffectiveReconTenant(c.env.AURA_DB, shiftId, scope.tenantId!);
    if (await isTenantCashReconciliationOptedOut(c.env, c.env.AURA_DB, effectiveOptOutTenant)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation disabled for tenant',
        },
        501,
      );
    }

    const actorId = String(user.sub || user.id || '');
    try {
      const payouts = await listShiftCashPayouts(c.env, shiftId, scope.tenantId!, actorId, role);
      return c.json({ success: true, data: payouts });
    } catch (err) {
      if (err instanceof ShiftContractError) return c.json({ success: false, error: err.message }, err.status);
      log.error('Unexpected list shift payouts error', {
        shiftId,
        message: err instanceof Error ? err.message : String(err),
      });
      return c.json({ success: false, error: 'Failed to list shift payouts' }, 500);
    }
  });

  app.post('/api/shifts/:id/payouts', async (c) => {
    const user = c.get('user') as unknown as Record<string, unknown> | undefined;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const role = String(user.role || '');
    if (!RECONCILIATION_ROLES.has(role)) return c.json({ error: 'Forbidden' }, 403);
    if (!isCashReconciliationEnabled(c.env)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation is disabled in attendance pilot mode',
        },
        501,
      );
    }

    const scope = resolveReconciliationTenant(c, user);
    if (scope.error) return c.json(scope.error.body, scope.error.status);
    const shiftId = c.req.param('id');
    const effectiveOptOutTenant = await resolveEffectiveReconTenant(c.env.AURA_DB, shiftId, scope.tenantId!);
    if (await isTenantCashReconciliationOptedOut(c.env, c.env.AURA_DB, effectiveOptOutTenant)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation disabled for tenant',
        },
        501,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ success: false, error: 'Invalid payload' }, 400);
    }
    if (typeof body.amount !== 'number' || !Number.isInteger(body.amount) || body.amount <= 0) {
      return c.json({ success: false, error: 'Payout amount must be a positive integer' }, 400);
    }

    const actorId = String(user.sub || user.id || '');
    try {
      const payout = await createShiftCashPayout(
        c.env,
        shiftId,
        {
          amount: body.amount,
          reason: typeof body.reason === 'string' ? body.reason : '',
        },
        actorId,
        scope.tenantId!,
        role,
      );
      return c.json({ success: true, data: payout }, 201);
    } catch (err) {
      if (err instanceof ShiftContractError) return c.json({ success: false, error: err.message }, err.status);
      log.error('Unexpected create shift payout error', {
        shiftId,
        message: err instanceof Error ? err.message : String(err),
      });
      return c.json({ success: false, error: 'Failed to record shift payout' }, 500);
    }
  });
}
