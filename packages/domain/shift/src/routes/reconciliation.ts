import type { Hono } from 'hono';
import { reconcileShiftCash, getReconciliationForShift } from '../policies/cash-reconciliation-policy';
import type { ReconciliationInput } from '../model/reconciliation-types';

const RECONCILIATION_ROLES = new Set([
  'owner',
  'manager',
  'supervisor',
  'staff',
  'admin',
  'cashier',
  'waiter',
]);
const HQ_ROLES = new Set(['owner', 'admin']);

function isCashReconciliationEnabled(env: Record<string, unknown> | undefined): boolean {
  const flag = String(env?.CASH_RECONCILIATION_ENABLED ?? '').trim().toLowerCase();
  return flag === 'true' || flag === '1';
}

async function isTenantCashReconciliationOptedOut(
  env: Record<string, unknown> | undefined,
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { all: <T = unknown>() => Promise<{ results?: T[] | null }> } } },
  tenantId: string,
): Promise<boolean> {
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
  const headerTenant = c.req.header('X-Tenant-ID')?.trim() || '';
  const queryTenant = c.req.query('tenant_id')?.trim() || '';

  if (headerTenant && queryTenant && headerTenant !== queryTenant) {
    return { error: { status: 400, body: { success: false, error: 'Conflicting tenant scope parameters' } } };
  }
  const requested = headerTenant || queryTenant;
  if (!isHq) {
    if (requested && requested !== rawUserTenant) {
      return { error: { status: 403, body: { success: false, error: 'Forbidden cross-tenant reconciliation access' } } };
    }
    return { tenantId: rawUserTenant };
  }
  const target = requested || (typeof c.get('tenantId') === 'string' ? String(c.get('tenantId')).trim() : '') || 'default';
  return { tenantId: target.toLowerCase() === 'hq' ? '*' : target };
}

export function reconciliationRoutes(app: Hono<any>) {
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

    if (await isTenantCashReconciliationOptedOut(c.env, c.env.AURA_DB, scope.tenantId!)) {
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

    const shiftId = c.req.param('id');
    const staffId = String(user.sub || user.id || '');
    const denominations: ReconciliationInput['denominations'] = Array.isArray(body.denominations)
      ? { denominations: body.denominations as ReconciliationInput['denominations']['denominations'] }
      : body.denominations && typeof body.denominations === 'object'
        ? (body.denominations as ReconciliationInput['denominations'])
        : { denominations: [] };

    const input: ReconciliationInput & { actual_cash_counted?: unknown } = {
      shift_id: shiftId,
      opening_float: Number(body.opening_float ?? 0),
      denominations,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      ...(body.actual_cash_counted !== undefined ? { actual_cash_counted: body.actual_cash_counted } : {}),
    };

    try {
      const result = await reconcileShiftCash(c.env, input, staffId, scope.tenantId);
      return c.json({ success: true, data: result }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reconcile shift cash';
      if (msg.includes('already been reconciled')) {
        return c.json({ success: false, error: msg }, 409);
      }
      if (msg.includes('not found')) {
        return c.json({ success: false, error: msg }, 404);
      }
      return c.json({ success: false, error: msg }, 400);
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

    if (await isTenantCashReconciliationOptedOut(c.env, c.env.AURA_DB, scope.tenantId!)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation disabled for tenant',
        },
        501,
      );
    }

    const shiftId = c.req.param('id');
    const record = await getReconciliationForShift(c.env, shiftId, scope.tenantId);
    if (!record) {
      return c.json({ success: false, error: 'Shift reconciliation not found' }, 404);
    }
    return c.json({ success: true, data: record });
  });
}
