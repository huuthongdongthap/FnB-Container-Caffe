import { Hono } from 'hono';
import {
  reconcileShiftCash,
  getReconciliationForShift,
  type ReconciliationInput,
} from '@aura/domain-shift';
import type { Env } from '../types/env';
import { authenticateRequest } from '../middleware/auth';

const shiftReconciliationRouter = new Hono<{ Bindings: Env }>();

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

function isCashReconciliationEnabled(env: Env | undefined): boolean {
  const flag = String(env?.CASH_RECONCILIATION_ENABLED ?? '').trim().toLowerCase();
  return flag === 'true' || flag === '1';
}

function resolveTenantScope(
  c: { req: { header: (k: string) => string | undefined; query: (k: string) => string | undefined }; get: (k: string) => unknown },
  user: { role?: string; tenant_id?: string }
): { tenantId?: string; status?: 400 | 403; error?: string } {
  const boundTenant = user.tenant_id && user.tenant_id.trim() ? user.tenant_id.trim() : 'default';
  const isHq = HQ_ROLES.has(String(user.role || '')) && (boundTenant === '*' || boundTenant.toLowerCase() === 'hq');
  const headerTenant = c.req.header('X-Tenant-ID')?.trim() || '';
  const queryTenant = c.req.query('tenant_id')?.trim() || '';
  if (headerTenant && queryTenant && headerTenant !== queryTenant) {
    return { status: 400, error: 'Conflicting tenant scope parameters' };
  }
  const requested = headerTenant || queryTenant;
  if (!isHq) {
    if (requested && requested !== boundTenant) {
      return { status: 403, error: 'Forbidden cross-tenant reconciliation access' };
    }
    return { tenantId: boundTenant };
  }
  const ctxTenant = typeof c.get('tenantId') === 'string' ? String(c.get('tenantId')).trim() : '';
  const target = requested || ctxTenant || 'default';
  return { tenantId: target.toLowerCase() === 'hq' ? '*' : target };
}

async function resolveShiftActor(
  c: { get?: (k: never) => unknown; req: { raw: Request }; env: Env }
): Promise<{ sub?: string; id?: string; role?: string; tenant_id?: string } | undefined> {
  const fromCtx = (typeof c.get === 'function' ? c.get('user' as never) : undefined) as
    | { sub?: string; id?: string; role?: string; tenant_id?: string }
    | undefined;
  if (fromCtx) return fromCtx;
  const session = await authenticateRequest(c.req.raw, c.env, { optional: true }).catch(() => null);
  if (!session || 'blocked' in session) return undefined;
  const payload = session.payload;
  return {
    sub: payload.sub,
    id: payload.sub,
    role: payload.role,
    tenant_id: payload.tenantId ?? (payload as unknown as { tenant_id?: string }).tenant_id,
  };
}

shiftReconciliationRouter.post('/:id/reconcile', async (c) => {
  const user = await resolveShiftActor(c);
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);
  if (!RECONCILIATION_ROLES.has(String(user.role || ''))) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
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

  const scope = resolveTenantScope(c as never, user);
  if (scope.error && scope.status) {
    return c.json({ success: false, error: scope.error }, scope.status);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
  }

  const shiftId = c.req.param('id');
  const staffId = String(user.sub || user.id || '');
  const denominations =
    body.denominations && typeof body.denominations === 'object'
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

shiftReconciliationRouter.get('/:id/reconciliation', async (c) => {
  const user = await resolveShiftActor(c);
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);
  if (!RECONCILIATION_ROLES.has(String(user.role || ''))) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
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

  const scope = resolveTenantScope(c as never, user);
  if (scope.error && scope.status) {
    return c.json({ success: false, error: scope.error }, scope.status);
  }

  const shiftId = c.req.param('id');
  const record = await getReconciliationForShift(c.env, shiftId, scope.tenantId);
  if (!record) {
    return c.json({ success: false, error: 'Shift reconciliation not found' }, 404);
  }
  return c.json({ success: true, data: record });
});

export { shiftReconciliationRouter };
