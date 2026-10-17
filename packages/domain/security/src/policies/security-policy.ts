/**
 * Canonical Security Policy Evaluator
 * Server-authoritative validation of identity, tenancy, IDOR, and role boundaries.
 */

import type {
  AccessControlContext,
  ResourceAccessTarget,
  AccessDecision,
  ThreatModelItem,
  SecurityAuditSummary
} from '../model/security-types';

export function validateAccessControl(
  auth: AccessControlContext,
  target: ResourceAccessTarget
): AccessDecision {
  const isStaffRole = ['owner', 'manager', 'staff', 'waiter'].includes(auth.userRole || '');

  // 1. Unauthenticated Check
  if (!auth.userId && !auth.userRole) {
    if (target.resourceType === 'order' && !target.ownerId) {
      // Anonymous / Guest Order Creation is permissible
      return { allowed: true, code: 'ALLOWED' };
    }
    return {
      allowed: false,
      code: 'UNAUTHENTICATED',
      reason: 'Authentication required to access resource'
    };
  }

  // 2. Super-Admin Cross-Unit Override
  if (auth.isSuperAdmin || (auth.userRole === 'owner' && (!auth.userTenantId || auth.userTenantId === 'default' || auth.userTenantId === 'hq'))) {
    return { allowed: true, code: 'ALLOWED' };
  }

  // 3. Multi-Tenant Scoping (Tenant Isolation)
  if (target.tenantId && auth.userTenantId && target.tenantId !== auth.userTenantId) {
    return {
      allowed: false,
      code: 'FORBIDDEN_TENANT',
      reason: 'Cross-tenant resource access is strictly prohibited'
    };
  }

  // 4. Role & Resource Scoping
  if (target.resourceType === 'inventory' || target.resourceType === 'report' || target.resourceType === 'system') {
    if (!isStaffRole) {
      return {
        allowed: false,
        code: 'FORBIDDEN_ROLE',
        reason: 'Staff or manager role required for administrative resources'
      };
    }
  }

  // 5. Customer IDOR Protection
  if (auth.userRole === 'customer') {
    if (target.ownerId && target.ownerId !== auth.userId) {
      return {
        allowed: false,
        code: 'FORBIDDEN_IDOR',
        reason: 'Customers are strictly prohibited from accessing another customer resources'
      };
    }
  }

  return { allowed: true, code: 'ALLOWED' };
}

export function evaluateThreatPosture(findings: ThreatModelItem[]): SecurityAuditSummary {
  const unmitigated = findings.filter((f) => f.status === 'pending');
  const criticalOrHighUnmitigated = unmitigated.filter(
    (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'
  );

  return {
    healthy: criticalOrHighUnmitigated.length === 0,
    totalFindings: findings.length,
    mitigatedFindings: findings.filter((f) => f.status === 'mitigated').length,
    unresolvedBlockers: criticalOrHighUnmitigated.length,
    items: findings
  };
}
