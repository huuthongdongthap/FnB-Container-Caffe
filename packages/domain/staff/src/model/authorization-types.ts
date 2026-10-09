/**
 * Canonical Authorization & Operating Unit Domain Types
 * Defines the unified RBAC + Multi-Tenant Operating Unit Matrix
 */

export type RoleType = 'owner' | 'manager' | 'staff' | 'waiter' | 'customer' | 'guest';
export type ResourceType = 'staff' | 'shift' | 'table' | 'order' | 'payment' | 'inventory' | 'reservation' | 'catalog';
export type ActionType = 'read' | 'create' | 'update' | 'delete' | 'admin' | 'operate' | 'refund';

export interface ActorContext {
  id?: string;
  email?: string;
  name?: string;
  role: RoleType;
  tenantId?: string;
  operatingUnitId?: string;
  isPlaywright?: boolean;
}

export interface ResourceContext {
  type: ResourceType;
  id?: string;
  tenantId?: string | null;
  operatingUnitId?: string | null;
  ownerId?: string | null; // e.g. customer_id or staff_id
  status?: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason?: string;
  code?: 'unauthenticated' | 'unauthorized_role' | 'customer_idor' | 'cross_operating_unit_mismatch' | 'tenant_mismatch';
}
