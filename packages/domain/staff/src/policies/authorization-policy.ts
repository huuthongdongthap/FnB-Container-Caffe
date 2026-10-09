/**
 * Canonical Server-Side Authorization Policy
 * Unifies RBAC + Multi-Tenant Operating Unit Boundary Enforcement
 * Flow: Staff → Shift → Table → Order → Payment → Inventory
 */
import type {
  ActorContext,
  ResourceContext,
  ActionType,
  AuthorizationDecision,
} from '../model/authorization-types';

export function isHQSuperAdmin(actor?: ActorContext | null): boolean {
  if (!actor) return false;
  return actor.role === 'owner' && (!actor.tenantId || actor.tenantId === 'default' || actor.tenantId === 'hq');
}

export function validateOperatingUnitScope(
  actor: ActorContext,
  resource: ResourceContext
): AuthorizationDecision {
  if (isHQSuperAdmin(actor)) {
    return { allowed: true };
  }

  // 1. Tenant boundary validation
  if (resource.tenantId && actor.tenantId && resource.tenantId !== actor.tenantId) {
    return {
      allowed: false,
      code: 'tenant_mismatch',
      reason: `Access denied: Resource belongs to tenant '${resource.tenantId}', but actor is bound to '${actor.tenantId}'`,
    };
  }

  // 2. Operating unit boundary validation
  if (
    resource.operatingUnitId &&
    actor.operatingUnitId &&
    resource.operatingUnitId !== actor.operatingUnitId
  ) {
    return {
      allowed: false,
      code: 'cross_operating_unit_mismatch',
      reason: `Access denied: Resource belongs to operating unit '${resource.operatingUnitId}', but actor is bound to '${actor.operatingUnitId}'`,
    };
  }

  return { allowed: true };
}

export function authorizeAction(
  actor: ActorContext | null | undefined,
  resource: ResourceContext,
  action: ActionType = 'read'
): AuthorizationDecision {
  // If no actor is provided, treat as anonymous guest.
  const currentActor: ActorContext = actor || { role: 'guest' };
  const role = currentActor.role;

  // 1. Check Operating Unit / Tenant Boundaries first for authenticated users
  if (role !== 'guest') {
    const scopeDecision = validateOperatingUnitScope(currentActor, resource);
    if (!scopeDecision.allowed) {
      return scopeDecision;
    }
  }

  // 2. HQ Super-Admin bypass for tenant permissions
  if (isHQSuperAdmin(currentActor)) {
    return { allowed: true };
  }

  // 3. Guest Access Boundaries
  if (role === 'guest') {
    if (resource.type === 'catalog' && action === 'read') return { allowed: true };
    if (resource.type === 'reservation' && (action === 'read' || action === 'create')) return { allowed: true };
    if (resource.type === 'order' && action === 'create') return { allowed: true };
    if (resource.type === 'order' && action === 'read' && !resource.ownerId) return { allowed: true };
    if (resource.type === 'payment' && action === 'create') return { allowed: true };
    if (resource.type === 'table' && action === 'read') return { allowed: true };

    return {
      allowed: false,
      code: 'unauthenticated',
      reason: 'Authentication required for protected resource action',
    };
  }

  // 4. Customer Access Boundaries & IDOR Prevention
  if (role === 'customer') {
    if (resource.type === 'catalog' && action === 'read') return { allowed: true };
    if (resource.type === 'reservation' && (action === 'read' || action === 'create' || action === 'update')) return { allowed: true };
    if (resource.type === 'payment' && action === 'create') return { allowed: true };

    if (resource.type === 'order') {
      if (action === 'create') return { allowed: true };
      if (!resource.ownerId || resource.ownerId === currentActor.id) {
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'customer_idor',
        reason: 'Forbidden: Cannot access orders belonging to other customers',
      };
    }

    return {
      allowed: false,
      code: 'unauthorized_role',
      reason: `Customer role is not authorized to perform ${action} on ${resource.type}`,
    };
  }

  // 5. Waiter Access Boundaries
  if (role === 'waiter') {
    if (resource.type === 'table' && ['read', 'update'].includes(action)) return { allowed: true };
    if (resource.type === 'order' && ['read', 'create', 'update'].includes(action)) return { allowed: true };
    if (resource.type === 'reservation' && ['read', 'create', 'update'].includes(action)) return { allowed: true };
    if (resource.type === 'catalog' && action === 'read') return { allowed: true };

    return {
      allowed: false,
      code: 'unauthorized_role',
      reason: `Waiter role is not authorized to perform ${action} on ${resource.type}`,
    };
  }

  // 6. Staff (Kitchen / Counter / Operations) Boundaries
  if (role === 'staff') {
    if (resource.type === 'catalog' && ['read', 'create', 'update'].includes(action)) return { allowed: true };
    if (resource.type === 'table' && ['read', 'update'].includes(action)) return { allowed: true };
    if (resource.type === 'order' && ['read', 'create', 'update'].includes(action)) return { allowed: true };
    if (resource.type === 'shift' && ['read', 'create', 'operate'].includes(action)) return { allowed: true };
    if (resource.type === 'shift' && action === 'update') {
      if (!resource.ownerId || resource.ownerId === currentActor.id) return { allowed: true };
      return { allowed: false, code: 'unauthorized_role', reason: 'Peer staff cannot close another staff shift' };
    }
    if (resource.type === 'inventory' && action === 'read') return { allowed: true };
    if (resource.type === 'payment' && ['read', 'create'].includes(action)) return { allowed: true };

    return {
      allowed: false,
      code: 'unauthorized_role',
      reason: `Staff role is not authorized to perform ${action} on ${resource.type}`,
    };
  }

  // 7. Manager Boundaries
  if (role === 'manager') {
    if (['table', 'order', 'reservation', 'shift', 'inventory', 'catalog'].includes(resource.type)) {
      return { allowed: true };
    }
    if (resource.type === 'payment') return { allowed: true };
    if (resource.type === 'staff' && action !== 'delete') return { allowed: true };

    return {
      allowed: false,
      code: 'unauthorized_role',
      reason: `Manager role is not authorized to perform ${action} on ${resource.type}`,
    };
  }

  // 8. Tenant Owner
  if (role === 'owner') {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: 'unauthorized_role',
    reason: 'Forbidden: Role not authorized',
  };
}
