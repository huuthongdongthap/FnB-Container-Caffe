/**
 * Canonical Server-Side Audit Writer Policy
 * Enforces immutable, append-only operational event logging across business mutations.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type {
  AuditPayload,
  AuditDiff,
  AuditActor,
  AuditFailurePolicy,
  CanonicalAuditRecord,
} from '../model/audit-types';
import { redactSensitiveData } from './audit-redaction-policy';

export function calculateSafeDiff(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
): AuditDiff {
  const safeBefore = (before ? redactSensitiveData(before) : null) as Record<string, unknown> | null;
  const safeAfter = (after ? redactSensitiveData(after) : null) as Record<string, unknown> | null;

  const allKeys = new Set<string>([
    ...Object.keys(safeBefore || {}),
    ...Object.keys(safeAfter || {}),
  ]);

  const changes: string[] = [];
  for (const key of allKeys) {
    const valB = safeBefore ? safeBefore[key] : undefined;
    const valA = safeAfter ? safeAfter[key] : undefined;
    if (JSON.stringify(valB) !== JSON.stringify(valA)) {
      changes.push(key);
    }
  }

  return { before: safeBefore, after: safeAfter, changes };
}

export function buildCanonicalAuditRecord(payload: AuditPayload): CanonicalAuditRecord {
  const now = new Date().toISOString();
  const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const actorId = payload.actor.id || 'system';
  const actorName = payload.actor.name || payload.actor.email || 'System';
  const tenantId = payload.tenantId || payload.actor.tenantId || null;
  const operatingUnitId = payload.operatingUnitId || payload.actor.operatingUnitId || null;
  const status = payload.outcome || 'success';
  const correlationId = payload.correlationId || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const safeDiff = payload.diff ? {
    before: payload.diff.before ? redactSensitiveData(payload.diff.before) : null,
    after: payload.diff.after ? redactSensitiveData(payload.diff.after) : null,
    changes: payload.diff.changes || [],
  } : null;

  const safeMetadata = payload.metadata ? (redactSensitiveData(payload.metadata) as Record<string, unknown>) : {};

  const detailsObj = {
    outcome: status,
    reason: payload.reason || null,
    correlationId,
    tenantId,
    operatingUnitId,
    diff: safeDiff,
    metadata: safeMetadata,
  };

  return {
    id,
    actor_id: actorId,
    actor_name: actorName,
    user_id: actorId,
    action: payload.action,
    resource_type: payload.resourceType,
    resource_id: payload.resourceId || null,
    entity_type: payload.resourceType,
    entity_id: payload.resourceId || null,
    operating_unit_id: operatingUnitId,
    tenant_id: tenantId,
    status,
    details: JSON.stringify(detailsObj),
    metadata: JSON.stringify(safeMetadata),
    correlation_id: correlationId,
    ip_address: payload.ipAddress || null,
    created_at: now,
  };
}

export async function writeCanonicalAuditLog(
  db: D1Database,
  payload: AuditPayload,
  options?: { policy?: AuditFailurePolicy }
): Promise<{ ok: boolean; record: CanonicalAuditRecord; error?: string }> {
  const policy = options?.policy || 'best_effort';
  const record = buildCanonicalAuditRecord(payload);

  try {
    await db.prepare(
      `INSERT INTO audit_logs (
        id, actor_id, actor_name, user_id, action,
        resource_type, resource_id, entity_type, entity_id,
        operating_unit_id, tenant_id, status, details, metadata,
        correlation_id, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      record.id, record.actor_id, record.actor_name, record.user_id, record.action,
      record.resource_type, record.resource_id, record.entity_type, record.entity_id,
      record.operating_unit_id, record.tenant_id, record.status, record.details, record.metadata,
      record.correlation_id, record.ip_address, record.created_at
    ).run();

    return { ok: true, record };
  } catch (err) {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (
          id, actor_id, actor_name, action, resource_type, resource_id, details, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        record.id, record.actor_id, record.actor_name, record.action,
        record.resource_type, record.resource_id, record.details, record.ip_address, record.created_at
      ).run();

      return { ok: true, record };
    } catch (fallbackErr) {
      if (policy === 'strict_fail_closed') {
        throw new Error(`Audit write failed under strict_fail_closed policy: ${String(fallbackErr || err)}`);
      }
      return { ok: false, record, error: String(fallbackErr || err) };
    }
  }
}

export async function recordAuthorizationFailure(
  db: D1Database,
  actor: AuditActor,
  resource: { type: string; id?: string },
  reason: string,
  options?: { correlationId?: string; operatingUnitId?: string; tenantId?: string; ipAddress?: string }
): Promise<void> {
  await writeCanonicalAuditLog(db, {
    actor,
    action: 'auth.rejected',
    resourceType: resource.type,
    resourceId: resource.id,
    outcome: 'rejected',
    reason,
    correlationId: options?.correlationId,
    operatingUnitId: options?.operatingUnitId,
    tenantId: options?.tenantId,
    ipAddress: options?.ipAddress,
  });
}
