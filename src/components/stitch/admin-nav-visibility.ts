import type { NavItemData, NavSectionData } from './StitchAdminTerminalNew-types';

export interface AdminNavActor {
  role?: string | null;
  tenantId?: string | null;
  tenant_id?: string | null;
}

const TENANT_SAAS_ADMIN_ROLES = new Set(['owner', 'admin', 'manager']);
const HQ_SUPER_ADMIN_ROLES = new Set(['owner', 'admin']);
const HQ_TENANT_SCOPES = new Set(['hq', '*']);

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveActorTenant(actor?: AdminNavActor | null): string {
  if (!actor) return '';
  const camel = normalizeLower(actor.tenantId);
  if (camel) return camel;
  return normalizeLower(actor.tenant_id);
}

/**
 * Mirrors backend `isHQSuperAdmin` (`worker/src/middleware/tenant.ts`):
 * requires an actual `owner` or `admin` explicitly scoped to tenant `'hq'` or `'*'`.
 * UI navigation filtering improves discoverability only; backend middleware enforces authorization.
 */
export function isHqSuperAdminActor(actor?: AdminNavActor | null): boolean {
  if (!actor) return false;
  const role = normalizeLower(actor.role);
  if (!HQ_SUPER_ADMIN_ROLES.has(role)) return false;
  const tenant = resolveActorTenant(actor);
  return HQ_TENANT_SCOPES.has(tenant);
}

/**
 * Mirrors backend `requireOwnerOrAdmin` (`worker/src/routes/saas-commercial.ts`):
 * tenant `owner`, `admin`, and `manager` accounts (plus HQ super-admins) can manage SaaS settings.
 * UI navigation filtering improves discoverability only; backend middleware enforces authorization.
 */
export function isTenantSaasAdminActor(actor?: AdminNavActor | null): boolean {
  if (!actor) return false;
  const role = normalizeLower(actor.role);
  return TENANT_SAAS_ADMIN_ROLES.has(role) || isHqSuperAdminActor(actor);
}

export function canViewAdminNavItem(
  item: Pick<NavItemData, 'access'>,
  actor?: AdminNavActor | null,
): boolean {
  if (!item.access) return true;
  if (item.access === 'hqAdmin') {
    return isHqSuperAdminActor(actor);
  }
  if (item.access === 'merchantAdmin') {
    return isTenantSaasAdminActor(actor);
  }
  return false;
}

export function filterAdminNavSections(
  sections: NavSectionData[],
  actor?: AdminNavActor | null,
): NavSectionData[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canViewAdminNavItem(item, actor)),
    }))
    .filter((section) => section.items.length > 0);
}
