import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export const RECONCILE_LEASE_MS = 90_000;
const REVIEW_TTL_SECONDS = 604_800;

export type ReconcileOutcome =
  | 'settled'
  | 'already_settled'
  | 'pending'
  | 'requires_review'
  | 'provider_error'
  | 'not_found';

export interface ReviewMarkerInput {
  paymentId?: string | null;
  orderId?: string | null;
  orderCode?: string | null;
  source: 'webhook' | 'cron' | 'manual' | 'create_link';
  stage: string;
  errorCode: string;
  untrusted?: boolean;
}

function sanitizeId(val: string | null | undefined, untrusted?: boolean): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  const cleaned = untrusted ? trimmed.replace(/[^A-Za-z0-9_:-]/g, '') : trimmed;
  return cleaned.slice(0, 64) || null;
}

export async function writePaymentReviewMarker(
  kv: KVNamespace | null | undefined,
  input: ReviewMarkerInput
): Promise<string | null> {
  if (!kv) return null;
  const correlationId = crypto.randomUUID();
  const paymentId = sanitizeId(input.paymentId, input.untrusted);
  const orderId = sanitizeId(input.orderId, input.untrusted);
  const orderCode = sanitizeId(input.orderCode, input.untrusted);
  const keySuffix = paymentId || (orderCode ? `unknown:${orderCode}` : `unidentified:${correlationId}`);
  const key = `payment:review:${keySuffix}`;
  const payload = {
    correlationId,
    source: input.source,
    stage: input.stage,
    errorCode: input.errorCode,
    timestamp: new Date().toISOString(),
    paymentId,
    orderId,
    orderCode,
    ...(input.untrusted ? { untrusted: true } : {}),
  };
  await kv.put(key, JSON.stringify(payload), { expirationTtl: REVIEW_TTL_SECONDS }).catch(() => {});
  return correlationId;
}

export async function claimReconcileJob(
  db: D1Database,
  paymentId: string,
  leaseOwner: string,
  nowMs = Date.now(),
  ignoreCooldown = false
): Promise<boolean> {
  const nowStr = String(nowMs);
  const leaseUntilStr = String(nowMs + RECONCILE_LEASE_MS);
  await db.prepare(
    `INSERT OR IGNORE INTO payment_reconciliation_jobs
     (payment_id, next_attempt_at, lease_until, lease_owner, last_checked_at, last_outcome, attempts, updated_at)
     VALUES (?, ?, NULL, NULL, NULL, NULL, 0, ?)`
  ).bind(paymentId, nowStr, nowStr).run();

  const res = await db.prepare(
    `UPDATE payment_reconciliation_jobs
     SET lease_owner = ?, lease_until = ?, attempts = attempts + 1, updated_at = ?
     WHERE payment_id = ?
       AND (lease_until IS NULL OR lease_until < ?)
       AND (? = 1 OR next_attempt_at <= ?)`
  ).bind(leaseOwner, leaseUntilStr, nowStr, paymentId, nowStr, ignoreCooldown ? 1 : 0, nowStr).run();

  return (res.meta?.changes ?? 0) > 0;
}

export async function releaseReconcileJob(
  db: D1Database,
  paymentId: string,
  leaseOwner: string,
  outcome: ReconcileOutcome,
  nextAttemptAtMs: number,
  checkedAtMs = Date.now()
): Promise<boolean> {
  const checkedStr = String(checkedAtMs);
  const nextStr = String(nextAttemptAtMs);
  const res = await db.prepare(
    `UPDATE payment_reconciliation_jobs
     SET lease_owner = NULL, lease_until = NULL, last_checked_at = ?, last_outcome = ?, next_attempt_at = ?, updated_at = ?
     WHERE payment_id = ? AND lease_owner = ?`
  ).bind(checkedStr, outcome, nextStr, checkedStr, paymentId, leaseOwner).run();

  return (res.meta?.changes ?? 0) > 0;
}
