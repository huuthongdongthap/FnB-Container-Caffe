/**
 * Canonical Audit Trail & Operational Event Types
 * Defines the immutable audit contract for critical business mutations.
 */

export type AuditOutcome = 'success' | 'failure' | 'rejected';
export type AuditFailurePolicy = 'best_effort' | 'strict_fail_closed';

export interface AuditActor {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  tenantId?: string;
  operatingUnitId?: string;
}

export interface AuditDiff {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changes?: string[];
}

export interface AuditPayload {
  actor: AuditActor;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  tenantId?: string | null;
  operatingUnitId?: string | null;
  outcome?: AuditOutcome;
  reason?: string | null;
  diff?: AuditDiff | null;
  metadata?: Record<string, unknown> | null;
  correlationId?: string | null;
  ipAddress?: string | null;
}

export interface CanonicalAuditRecord {
  id: string;
  actor_id: string;
  actor_name: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  entity_type: string;
  entity_id: string | null;
  operating_unit_id: string | null;
  tenant_id: string | null;
  status: AuditOutcome;
  details: string;
  metadata: string;
  correlation_id: string | null;
  ip_address: string | null;
  created_at: string;
}
