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
  ResourceType,
} from '../model/authorization-types';

export type RoleType =
  | 'guest'
  | 'customer'
  | 'waiter'
  | 'staff'
  | 'barista'
  | 'kitchen'
  | 'chef'
  | 'cashier'
  | 'manager'
  | 'admin'
  | 'owner';

export const ROLE_HIERARCHY: Record<RoleType, number> = {
  guest: 0,
  customer: 10,
  waiter: 20,
  kitchen: 30,
  barista: 30,
  chef: 30,
  cashier: 30,
  staff: 30,
  manager: 50,
  admin: 90,
  owner: 100,
};

export const ROLE_PERMISSIONS: Record<RoleType, Partial<Record<ResourceType, ActionType[]>>> = {
  guest: {
    catalog: ['read'],
    reservation: ['read', 'create'],
    order: ['read', 'create'],
    payment: ['create'],
    table: ['read'],
  },
  customer: {
    catalog: ['read'],
    reservation: ['read', 'create', 'update'],
    order: ['read', 'create', 'update'],
    payment: ['create'],
  },
  waiter: {
    catalog: ['read'],
    table: ['read', 'update'],
    order: ['read', 'create', 'update'],
    reservation: ['read', 'create', 'update'],
  },
  kitchen: {
    catalog: ['read'],
    table: ['read'],
    order: ['read', 'update'],
    shift: ['read', 'create', 'operate', 'update'],
    inventory: ['read'],
  },
  barista: {
    catalog: ['read'],
    table: ['read'],
    order: ['read', 'update'],
    shift: ['read', 'create', 'operate', 'update'],
    inventory: ['read'],
  },
  chef: {
    catalog: ['read'],
    table: ['read'],
    order: ['read', 'update'],
    shift: ['read', 'create', 'operate', 'update'],
    inventory: ['read'],
  },
  cashier: {
    catalog: ['read'],
    table: ['read', 'update'],
    order: ['read', 'create', 'update'],
    shift: ['read', 'create', 'operate', 'update'],
    payment: ['read', 'create'],
  },
  staff: {
    catalog: ['read', 'create', 'update'],
    table: ['read', 'update'],
    order: ['read', 'create', 'update'],
    shift: ['read', 'create', 'operate', 'update'],
    inventory: ['read'],
    payment: ['read', 'create'],
  },
  manager: {
    catalog: ['read', 'create', 'update', 'delete', 'operate'],
    table: ['read', 'create', 'update', 'delete', 'operate'],
    order: ['read', 'create', 'update', 'delete', 'operate'],
    reservation: ['read', 'create', 'update', 'delete', 'operate'],
    shift: ['read', 'create', 'update', 'delete', 'operate'],
    inventory: ['read', 'create', 'update', 'delete', 'operate'],
    payment: ['read', 'create', 'update', 'delete', 'operate'],
    staff: ['read', 'create', 'update', 'operate'],
  },
  admin: {
    catalog: ['read', 'create', 'update', 'delete', 'operate'],
    table: ['read', 'create', 'update', 'delete', 'operate'],
    order: ['read', 'create', 'update', 'delete', 'operate'],
    reservation: ['read', 'create', 'update', 'delete', 'operate'],
    shift: ['read', 'create', 'update', 'delete', 'operate'],
    inventory: ['read', 'create', 'update', 'delete', 'operate'],
    payment: ['read', 'create', 'update', 'delete', 'operate'],
    staff: ['read', 'create', 'update', 'delete', 'operate'],
  },
  owner: {
    catalog: ['read', 'create', 'update', 'delete', 'operate'],
    table: ['read', 'create', 'update', 'delete', 'operate'],
    order: ['read', 'create', 'update', 'delete', 'operate'],
    reservation: ['read', 'create', 'update', 'delete', 'operate'],
    shift: ['read', 'create', 'update', 'delete', 'operate'],
    inventory: ['read', 'create', 'update', 'delete', 'operate'],
    payment: ['read', 'create', 'update', 'delete', 'operate'],
    staff: ['read', 'create', 'update', 'delete', 'operate'],
  },
};

export function isHQSuperAdmin(actor?: ActorContext | null): boolean {
  if (!actor) return false;
  const roleStr = String(actor.role);
  return (roleStr === 'owner' || roleStr === 'admin') && (!actor.tenantId || actor.tenantId === 'default' || actor.tenantId === 'hq');
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

  // 6. Staff (Kitchen / Counter / Operations / Barista / Chef / Cashier) Boundaries
  const roleStr = String(role);
  if (roleStr === 'staff' || roleStr === 'barista' || roleStr === 'kitchen' || roleStr === 'chef' || roleStr === 'cashier') {
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
  if (roleStr === 'manager') {
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

  // 8. Tenant Owner & Admin
  if (roleStr === 'owner' || roleStr === 'admin') {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: 'unauthorized_role',
    reason: 'Forbidden: Role not authorized',
  };
}
