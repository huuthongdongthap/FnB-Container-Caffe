import type { Hono, Context } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import {
  hasFinancialRole,
  resolvePaymentTenantScope,
} from '../../../../packages/domain/payment/policies/payment-access';
import type { Env } from '../../types/env';
import { log } from './helpers';

interface ReadinessRow {
  tenant_id: string;
  reconciled_at: string;
  reconciled_by: string;
  evidence: string;
}

interface UnreconciledRefundRow {
  payment_id: string;
  order_id: string;
  amount: number;
  refund_amount: number | null;
  refund_status: string | null;
  refunded_at: string | null;
}

function isMissingSchemaError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return /no such table|no such column/i.test(msg);
}

async function queryUnreconciledLegacyRefunds(
  db: Env['AURA_DB'],
  tenantId: string,
): Promise<UnreconciledRefundRow[]> {
  try {
    const res = await db
      .prepare(
        `SELECT p.id AS payment_id, p.order_id, p.amount, p.refund_amount, p.refund_status, p.refunded_at
         FROM payments p
         INNER JOIN orders o ON o.id = p.order_id
         WHERE COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
           AND p.refund_status IS NOT NULL
           AND TRIM(p.refund_status) != ''
           AND NOT EXISTS (
             SELECT 1 FROM payment_refund_transfers t
             WHERE t.payment_id = p.id
               AND t.tenant_id = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
           )
         ORDER BY COALESCE(p.refunded_at, p.updated_at, p.created_at) DESC
         LIMIT 50`,
      )
      .bind(tenantId)
      .all<UnreconciledRefundRow>();
    return res.results ?? [];
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return [];
    }
    throw err;
  }
}

export async function handleGetRefundReadiness(c: Context<{ Bindings: Env }>): Promise<Response> {
  const user = c.get('user') as { id?: string; role?: string; email?: string } | undefined;
  const role = String(user?.role ?? '').trim().toLowerCase();
  if (role !== 'super_admin' && !hasFinancialRole(c)) return c.json({ success: false, error: 'Forbidden' }, 403);
  const scope = resolvePaymentTenantScope(c, false);
  if (!scope) return c.json({ success: false, error: 'Forbidden' }, 403);
  if (scope.wildcard || !scope.tenantId || scope.tenantId === '*') {
    return c.json({ success: false, error: 'explicit tenant_id required' }, 400);
  }

  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;

  try {
    const [row, unreconciled] = await Promise.all([
      db
        .prepare('SELECT tenant_id, reconciled_at, reconciled_by, evidence FROM refund_tenant_readiness WHERE tenant_id = ?')
        .bind(tenantId)
        .first<ReadinessRow>(),
      queryUnreconciledLegacyRefunds(db, tenantId),
    ]);

    return c.json({
      success: true,
      data: {
        tenantId,
        ready: Boolean(row),
        reconciledAt: row?.reconciled_at ?? null,
        reconciledBy: row?.reconciled_by ?? null,
        evidence: row?.evidence ?? null,
        unreconciledCount: unreconciled.length,
        unreconciledRefunds: unreconciled,
      },
    });
  } catch (err) {
    log.error('getRefundReadiness failed', { error: String(err), tenantId });
    return c.json({ success: false, error: 'Failed to check refund readiness' }, 500);
  }
}

export async function handleReconcileRefundReadiness(c: Context<{ Bindings: Env }>): Promise<Response> {
  const user = c.get('user') as { id?: string; role?: string; email?: string } | undefined;
  const role = String(user?.role ?? '').trim().toLowerCase();
  if (role !== 'super_admin' && !hasFinancialRole(c)) return c.json({ success: false, error: 'Forbidden' }, 403);
  const scope = resolvePaymentTenantScope(c, false);
  if (!scope) return c.json({ success: false, error: 'Forbidden' }, 403);
  if (scope.wildcard || !scope.tenantId || scope.tenantId === '*') {
    return c.json({ success: false, error: 'explicit tenant_id required' }, 400);
  }

  if (!['owner', 'admin', 'super_admin', 'manager'].includes(role)) {
    return c.json({ success: false, error: 'Only owner, admin, or manager can reconcile refund readiness' }, 403);
  }

  let body: { evidence?: string; acknowledgeLegacy?: boolean } = {};
  try {
    body = (await c.req.json()) as { evidence?: string; acknowledgeLegacy?: boolean };
  } catch {
    body = {};
  }

  const db = c.env.AURA_DB;
  const tenantId = scope.tenantId;

  try {
    const existing = await db
      .prepare('SELECT tenant_id, reconciled_at, reconciled_by, evidence FROM refund_tenant_readiness WHERE tenant_id = ?')
      .bind(tenantId)
      .first<ReadinessRow>();
    if (existing) {
      return c.json({
        success: true,
        data: {
          tenantId,
          ready: true,
          reconciledAt: existing.reconciled_at,
          reconciledBy: existing.reconciled_by,
          evidence: existing.evidence,
          alreadyReconciled: true,
        },
      });
    }

    const unreconciled = await queryUnreconciledLegacyRefunds(db, tenantId);
    if (unreconciled.length > 0 && body.acknowledgeLegacy !== true) {
      return c.json(
        {
          success: false,
          code: 'UNRECONCILED_LEGACY_REFUNDS',
          error: 'Legacy refunds without transfer ledger entries must be reviewed and acknowledged before enabling manual refunds',
          unreconciledCount: unreconciled.length,
          unreconciledRefunds: unreconciled,
        },
        409,
      );
    }

    const now = new Date().toISOString();
    const actorId = String(user?.id || user?.email || 'owner');
    const evidence =
      typeof body.evidence === 'string' && body.evidence.trim().length > 0
        ? body.evidence.trim().slice(0, 200)
        : `ui-reconciled:${actorId}:${now}`;

    await db
      .prepare(
        `INSERT OR IGNORE INTO refund_tenant_readiness (tenant_id, reconciled_at, reconciled_by, evidence)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(tenantId, now, actorId, evidence)
      .run();

    log.info('refund_readiness_reconciled', {
      tenantId,
      actorId,
      evidence,
      unreconciledCount: unreconciled.length,
    });

    return c.json({
      success: true,
      data: {
        tenantId,
        ready: true,
        reconciledAt: now,
        reconciledBy: actorId,
        evidence,
        unreconciledCount: unreconciled.length,
      },
    });
  } catch (err) {
    log.error('reconcileRefundReadiness failed', { error: String(err), tenantId });
    return c.json({ success: false, error: 'Failed to reconcile refund readiness' }, 500);
  }
}

export function registerRefundReadinessHandlers(router: Hono<{ Bindings: Env }>): void {
  router.get('/refund-readiness', requireAuth(), handleGetRefundReadiness);
  router.post('/refund-readiness/reconcile', requireAuth(), audit('refund_readiness_reconcile', 'refund_tenant_readiness'), handleReconcileRefundReadiness);
}
