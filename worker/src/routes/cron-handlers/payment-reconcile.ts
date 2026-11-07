import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { createLogger } from '../../middleware/logger';
import { resolvePilotStore } from '../../middleware/tenant';
import {
  claimReconcileJob,
  reconcilePayOSPayment,
  releaseReconcileJob,
  type ReconcileOutcome,
} from '../../../../packages/domain/payment/commands/payos-reconcile';

const log = createLogger({ route: 'cron:payment-reconcile' });

const MIN_PENDING_AGE_MS = 2 * 60 * 1000;
const PENDING_COOLDOWN_MS = 15 * 60 * 1000;
const TERMINAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const BASE_BACKOFF_MS = 5 * 60 * 1000;
const MAX_CANDIDATES = 10;
const CONCURRENCY = 2;
const DEFAULT_BUDGET_MS = 45_000;

export interface ReconcileCronOptions {
  nowMs?: number;
  budgetMs?: number;
  leaseOwnerPrefix?: string;
  tenantId?: string;
}

interface CandidateRow {
  payment_id: string;
  status: string;
  refund_status?: string | null;
  created_at: string | null;
  order_status?: string | null;
  order_payment_status: string;
  order_tenant_id?: string | null;
  attempts: number | null;
  last_checked_at: string | null;
}

const TERMINAL_ORDER_STATUSES = new Set([
  'cancelled',
  'canceled',
  'rejected',
  'failed',
  'expired',
  'refunded',
]);

export function parsePaymentTimestampMs(raw: string | null | undefined): number | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = trimmed.includes('T') ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeNextAttemptAtMs(
  outcome: ReconcileOutcome,
  attempts: number,
  nowMs: number
): number {
  if (outcome === 'pending') {
    return nowMs + PENDING_COOLDOWN_MS;
  }
  if (outcome === 'provider_error') {
    const exp = Math.max(0, attempts - 1);
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, exp));
    return nowMs + delay;
  }
  return nowMs + TERMINAL_COOLDOWN_MS;
}

export async function runPaymentReconciliation(
  env: Record<string, unknown>,
  options: ReconcileCronOptions = {}
): Promise<{ processed: number; outcomes: Record<string, ReconcileOutcome> }> {
  const db = (env.AURA_DB ?? env.DB) as D1Database | undefined;
  const kv = (env.AUTH_KV ?? null) as KVNamespace | null;
  const clientId = String(env.PAYOS_CLIENT_ID ?? '');
  const apiKey = String(env.PAYOS_API_KEY ?? '');
  const checksumKey = String(env.PAYOS_CHECKSUM_KEY ?? '');

  if (!db || !clientId || !apiKey || !checksumKey) {
    return { processed: 0, outcomes: {} };
  }

  const startWallMs = Date.now();
  const baseNowMs = options.nowMs ?? startWallMs;
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const nowStr = String(baseNowMs);

  let activeTenant = options.tenantId && options.tenantId.trim() ? options.tenantId.trim() : '';
  if (!activeTenant) {
    try {
      activeTenant = resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
    } catch {
      activeTenant = 'default';
    }
  }
  if (activeTenant.toLowerCase() === 'hq') {
    activeTenant = '*';
  }

  let rows: CandidateRow[] = [];
  try {
    const queryResult = await db.prepare(
      `SELECT p.id AS payment_id, p.status, p.created_at,
              o.status AS order_status,
              o.payment_status AS order_payment_status,
              o.tenant_id AS order_tenant_id,
              j.attempts, j.last_checked_at
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       LEFT JOIN payment_reconciliation_jobs j ON j.payment_id = p.id
       WHERE p.method = 'payos'
         AND p.status IN ('pending', 'completed')
         AND COALESCE(p.refund_status, '') != 'completed'
         AND o.payment_status NOT IN ('paid', 'refunded')
         AND NOT (p.status = 'completed' AND LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'))
         AND (j.last_outcome IS NULL OR j.last_outcome NOT IN ('settled', 'already_settled', 'requires_review'))
         AND (j.next_attempt_at IS NULL OR CAST(j.next_attempt_at AS INTEGER) <= CAST(? AS INTEGER))
         AND (j.lease_until IS NULL OR CAST(j.lease_until AS INTEGER) < CAST(? AS INTEGER))
         AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)
       ORDER BY COALESCE(j.attempts, 0) ASC, CAST(COALESCE(j.last_checked_at, '0') AS INTEGER) ASC, p.created_at ASC
       LIMIT 25`
    ).bind(nowStr, nowStr, activeTenant, activeTenant).all<CandidateRow>();
    rows = queryResult.results ?? [];
  } catch {
    try {
      const queryResult = await db.prepare(
        `SELECT p.id AS payment_id, p.status, p.created_at,
                o.status AS order_status,
                o.payment_status AS order_payment_status,
                j.attempts, j.last_checked_at
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         LEFT JOIN payment_reconciliation_jobs j ON j.payment_id = p.id
         WHERE p.method = 'payos'
           AND p.status IN ('pending', 'completed')
           AND COALESCE(p.refund_status, '') != 'completed'
           AND o.payment_status NOT IN ('paid', 'refunded')
           AND NOT (p.status = 'completed' AND LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'))
           AND (j.last_outcome IS NULL OR j.last_outcome NOT IN ('settled', 'already_settled', 'requires_review'))
           AND (j.next_attempt_at IS NULL OR CAST(j.next_attempt_at AS INTEGER) <= CAST(? AS INTEGER))
           AND (j.lease_until IS NULL OR CAST(j.lease_until AS INTEGER) < CAST(? AS INTEGER))
         ORDER BY COALESCE(j.attempts, 0) ASC, CAST(COALESCE(j.last_checked_at, '0') AS INTEGER) ASC, p.created_at ASC
         LIMIT 25`
      ).bind(nowStr, nowStr).all<CandidateRow>();
      rows = queryResult.results ?? [];
    } catch {
      try {
        const queryResult = await db.prepare(
          `SELECT p.id AS payment_id, p.status, p.created_at,
                  o.status AS order_status,
                  o.payment_status AS order_payment_status,
                  o.tenant_id AS order_tenant_id,
                  j.attempts, j.last_checked_at
           FROM payments p
           JOIN orders o ON o.id = p.order_id
           LEFT JOIN payment_reconciliation_jobs j ON j.payment_id = p.id
           WHERE p.method = 'payos'
             AND p.status IN ('pending', 'completed')
             AND o.payment_status NOT IN ('paid', 'refunded')
             AND NOT (p.status = 'completed' AND LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'))
             AND (j.last_outcome IS NULL OR j.last_outcome NOT IN ('settled', 'already_settled', 'requires_review'))
             AND (j.next_attempt_at IS NULL OR CAST(j.next_attempt_at AS INTEGER) <= CAST(? AS INTEGER))
             AND (j.lease_until IS NULL OR CAST(j.lease_until AS INTEGER) < CAST(? AS INTEGER))
             AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)
           ORDER BY COALESCE(j.attempts, 0) ASC, CAST(COALESCE(j.last_checked_at, '0') AS INTEGER) ASC, p.created_at ASC
           LIMIT 25`
        ).bind(nowStr, nowStr, activeTenant, activeTenant).all<CandidateRow>();
        rows = queryResult.results ?? [];
      } catch {
        const queryResult = await db.prepare(
          `SELECT p.id AS payment_id, p.status, p.created_at,
                  o.status AS order_status,
                  o.payment_status AS order_payment_status,
                  o.tenant_id AS order_tenant_id,
                  0 AS attempts, NULL AS last_checked_at
           FROM payments p
           JOIN orders o ON o.id = p.order_id
           WHERE p.method = 'payos'
             AND p.status IN ('pending', 'completed')
             AND o.payment_status NOT IN ('paid', 'refunded')
             AND NOT (p.status = 'completed' AND LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'))
             AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)
           ORDER BY p.created_at ASC
           LIMIT 25`
        ).bind(activeTenant, activeTenant).all<CandidateRow>().catch(async () =>
          db.prepare(
            `SELECT p.id AS payment_id, p.status, p.created_at,
                    o.status AS order_status,
                    o.payment_status AS order_payment_status,
                    0 AS attempts, NULL AS last_checked_at
             FROM payments p
             JOIN orders o ON o.id = p.order_id
             WHERE p.method = 'payos'
               AND p.status IN ('pending', 'completed')
               AND o.payment_status NOT IN ('paid', 'refunded')
               AND NOT (p.status = 'completed' AND LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'))
             ORDER BY p.created_at ASC
             LIMIT 25`
          ).all<CandidateRow>()
        );
        rows = queryResult.results ?? [];
      }
    }
  }

  rows = rows.filter((r) => {
    const ordStatus = typeof r.order_status === 'string' ? r.order_status.trim().toLowerCase() : '';
    if (r.status === 'completed' && TERMINAL_ORDER_STATUSES.has(ordStatus)) {
      return false;
    }
    if (typeof r.refund_status === 'string' && r.refund_status.trim().toLowerCase() === 'completed') {
      return false;
    }
    if (activeTenant !== '*') {
      if (!('order_tenant_id' in r) || r.order_tenant_id === undefined) {
        return activeTenant === 'default';
      }
      const rt = typeof r.order_tenant_id === 'string' && r.order_tenant_id.trim() ? r.order_tenant_id.trim() : 'default';
      return rt === activeTenant;
    }
    return true;
  });

  const eligible: CandidateRow[] = [];
  for (const row of rows) {
    if (eligible.length >= MAX_CANDIDATES) break;
    if (row.status === 'completed' && row.order_payment_status !== 'paid') {
      eligible.push(row);
      continue;
    }
    const createdMs = parsePaymentTimestampMs(row.created_at);
    if (createdMs === null) {
      log.warn('Skipping candidate with unparseable created_at', { paymentId: row.payment_id });
      continue;
    }
    if (baseNowMs - createdMs >= MIN_PENDING_AGE_MS) {
      eligible.push(row);
    }
  }

  const outcomes: Record<string, ReconcileOutcome> = {};
  let index = 0;
  let processed = 0;

  const worker = async (slot: number) => {
    while (index < eligible.length) {
      if (Date.now() - startWallMs >= budgetMs) break;
      const candidate = eligible[index++];
      if (!candidate) break;

      const currentNowMs = options.nowMs !== undefined ? options.nowMs : Date.now();
      const leaseOwner = `${options.leaseOwnerPrefix ?? 'cron'}:${slot}:${crypto.randomUUID()}`;
      const claimed = await claimReconcileJob(db, candidate.payment_id, leaseOwner, currentNowMs, false);
      if (!claimed) continue;

      processed++;
      try {
        const rawCandidateTenant = candidate.order_tenant_id ? String(candidate.order_tenant_id).trim() : '';
        const candidateTenant =
          activeTenant === '*'
            ? rawCandidateTenant && rawCandidateTenant !== '*' && rawCandidateTenant.toLowerCase() !== 'hq'
              ? rawCandidateTenant
              : 'default'
            : activeTenant;
        const res = await reconcilePayOSPayment({
          db,
          kv,
          paymentId: candidate.payment_id,
          tenantId: candidateTenant,
          clientId,
          apiKey,
          checksumKey,
          source: 'cron',
        });
        const jobRow = await db.prepare('SELECT attempts FROM payment_reconciliation_jobs WHERE payment_id = ?')
          .bind(candidate.payment_id).first<{ attempts: number }>().catch(() => null);
        const attempts = Number(jobRow?.attempts ?? (candidate.attempts ?? 0) + 1);
        const nextMs = computeNextAttemptAtMs(res.outcome, attempts, currentNowMs);
        await releaseReconcileJob(db, candidate.payment_id, leaseOwner, res.outcome, nextMs, currentNowMs);
        outcomes[candidate.payment_id] = res.outcome;
      } catch (err) {
        log.error('Reconcile candidate threw error', { paymentId: candidate.payment_id, error: (err as Error).message });
        const attempts = (candidate.attempts ?? 0) + 1;
        const nextMs = computeNextAttemptAtMs('provider_error', attempts, currentNowMs);
        await releaseReconcileJob(db, candidate.payment_id, leaseOwner, 'provider_error', nextMs, currentNowMs).catch(() => {});
        outcomes[candidate.payment_id] = 'provider_error';
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, eligible.length) }, (_, i) => worker(i)));
  return { processed, outcomes };
}
