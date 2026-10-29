/** Account writes keep tenant/role boundaries and session version in the same SQL guard. */
import type { StaffAccount } from './staff-session';
import { staffTenant } from './staff-session';

const managed = new Set(['staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef']);
export function staffManagementDenial(actor: { role?: string; tenantId?: string }, target: StaffAccount, nextRole?: string) {
  if (staffTenant(target) !== (actor.tenantId || 'default')) return 'Không đủ quyền truy cập cửa hàng';
  if ((target.role === 'owner' || nextRole === 'owner') && actor.role !== 'owner') return 'Chỉ owner được thay đổi tài khoản owner';
  if (actor.role === 'manager' && (!managed.has(target.role) || (nextRole && !managed.has(nextRole)))) return 'Manager không được thay đổi tài khoản quản lý';
  return null;
}
export function staffMutationGuard(account: StaffAccount, protectLastOwner = false) {
  const sql = `id = ? AND auth_version = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?`;
  // Evaluated at UPDATE time, so two concurrent owner deactivations cannot both
  // pass a pre-read count and leave the store without an active owner.
  const ownerGuard = ` AND (role != 'owner' OR is_active != 1 OR EXISTS (
    SELECT 1 FROM users AS other WHERE other.id != users.id AND other.role = 'owner' AND other.is_active = 1
      AND COALESCE(NULLIF(other.tenant_id, ''), 'default') = COALESCE(NULLIF(users.tenant_id, ''), 'default'))) `;
  return { sql: sql + (protectLastOwner ? ownerGuard : ''), values: [account.id, account.auth_version, staffTenant(account)] };
}
