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

const STAFF_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'supervisor',
  'staff',
  'waiter',
  'cashier',
  'kitchen',
  'barista',
  'chef',
  'shipper',
]);

const CUSTOMER_ROLES = new Set(['customer', 'guest']);

export function validateAccessControl(
  auth: AccessControlContext,
  target: ResourceAccessTarget
): AccessDecision {
  const role = typeof auth.userRole === 'string' ? auth.userRole.trim() : '';
  const isStaffRole = STAFF_ROLES.has(role);
  const isCustomerRole = CUSTOMER_ROLES.has(role);

  // 1. Unauthenticated Check
  if (!auth.userId && !role) {
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
  if (auth.isSuperAdmin || (role === 'owner' && (!auth.userTenantId || auth.userTenantId === 'default' || auth.userTenantId === 'hq'))) {
    return { allowed: true, code: 'ALLOWED' };
  }

  if (!role) {
    return {
      allowed: false,
      code: 'UNAUTHENTICATED',
      reason: 'Authenticated user role is required to access resource'
    };
  }

  if (!isStaffRole && !isCustomerRole) {
    return {
      allowed: false,
      code: 'FORBIDDEN_ROLE',
      reason: 'Unrecognized or unauthorized user role'
    };
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

  // 5. Non-Staff IDOR Protection
  if (!isStaffRole) {
    if (target.ownerId && target.ownerId !== auth.userId) {
      return {
        allowed: false,
        code: 'FORBIDDEN_IDOR',
        reason: 'Customers are strictly prohibited from accessing another customer resources'
      };
    }
    if (target.resourceType === 'customer' && (!target.ownerId || !auth.userId)) {
      return {
        allowed: false,
        code: 'FORBIDDEN_IDOR',
        reason: 'Customer profile access requires matching owner identity'
      };
    }
  }

  return { allowed: true, code: 'ALLOWED' };
}

export function evaluateThreatPosture(findings: ThreatModelItem[]): SecurityAuditSummary {
  const safeFindings = Array.isArray(findings) ? findings : [];
  const unmitigated = safeFindings.filter((f) => f.status === 'pending');
  const criticalOrHighUnmitigated = unmitigated.filter(
    (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'
  );

  return {
    healthy: safeFindings.length > 0 && criticalOrHighUnmitigated.length === 0,
    totalFindings: safeFindings.length,
    mitigatedFindings: safeFindings.filter((f) => f.status === 'mitigated').length,
    unresolvedBlockers: criticalOrHighUnmitigated.length,
    items: safeFindings
  };
}
