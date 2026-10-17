/**
 * Canonical Security & Data Protection Types
 * Enforces threat modeling, access control, PII protection, and rate limiting.
 */

export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export type SecurityDimension =
  | 'authentication'
  | 'authorization_idor'
  | 'secrets_management'
  | 'pii_data_protection'
  | 'rate_limiting'
  | 'webhook_integrity'
  | 'input_validation'
  | 'security_headers'
  | 'audit_logging'
  | 'dependencies';

export interface ThreatModelItem {
  id: string;
  dimension: SecurityDimension;
  severity: ThreatSeverity;
  description: string;
  remediation: string;
  status: 'mitigated' | 'accepted' | 'pending';
  evidence: string;
}

export interface AccessControlContext {
  userId?: string;
  userRole?: 'owner' | 'manager' | 'staff' | 'waiter' | 'customer' | 'guest';
  userTenantId?: string;
  isSuperAdmin?: boolean;
}

export interface ResourceAccessTarget {
  resourceType: 'order' | 'customer' | 'table' | 'inventory' | 'report' | 'system';
  resourceId: string;
  ownerId?: string;
  tenantId?: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
  code: 'ALLOWED' | 'UNAUTHENTICATED' | 'FORBIDDEN_ROLE' | 'FORBIDDEN_TENANT' | 'FORBIDDEN_IDOR';
}

export interface SecurityAuditSummary {
  healthy: boolean;
  totalFindings: number;
  mitigatedFindings: number;
  unresolvedBlockers: number;
  items: ThreatModelItem[];
}
