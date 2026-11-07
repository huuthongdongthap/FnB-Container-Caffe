/** Staff account state is D1-authoritative; KV supplies optional display metadata. */
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { authenticateRequest } from '../../lib/staff-session-auth';
import { staffSessionErrorResponse, SessionUnavailableError } from '../../lib/staff-session';
import type { Env } from '../../types/env';

export async function listStaff(
  requestOrContext: Request | { req: { raw: Request }; env: Record<string, unknown> },
  rawEnv?: Record<string, unknown>
) {
  const isContext = Boolean(requestOrContext && 'req' in requestOrContext && requestOrContext.req?.raw);
  const request = isContext ? (requestOrContext as { req: { raw: Request } }).req.raw : (requestOrContext as Request);
  const env = (isContext ? (requestOrContext as { env: Record<string, unknown> }).env : rawEnv) as unknown as Env;
  try {
    const session = await authenticateRequest(request, env);
    if (!session || 'blocked' in session) return errorResponse('Vui lòng đăng nhập', 401);
    if (!session.account || !['owner', 'admin', 'manager', 'supervisor'].includes(session.account.role)) return errorResponse('Không đủ quyền', 403);
    const callerTenant = (session.account.tenant_id || '').trim() || 'default';
    const isHqAdmin =
      (session.account.role === 'owner' || session.account.role === 'admin') &&
      (callerTenant.toLowerCase() === 'hq' || callerTenant === '*');
    const headerOverride = (
      request.headers.get('X-Tenant-ID') ||
      request.headers.get('x-tenant-id') ||
      request.headers.get('X-Store-ID') ||
      request.headers.get('x-store-id') ||
      ''
    ).trim();
    const urlOverride = (() => {
      try {
        const sp = new URL(request.url).searchParams;
        return (
          sp.get('tenant_id') ||
          sp.get('tenantId') ||
          sp.get('store_id') ||
          sp.get('storeId') ||
          ''
        ).trim();
      } catch {
        return '';
      }
    })();
    const requestedTenant = headerOverride || urlOverride;
    if (!isHqAdmin) {
      if (
        callerTenant === '*' ||
        callerTenant.toLowerCase() === 'hq' ||
        requestedTenant === '*' ||
        requestedTenant.toLowerCase() === 'hq' ||
        (requestedTenant && requestedTenant !== callerTenant)
      ) {
        return errorResponse('Cross-tenant staff access denied', 403);
      }
    }
    const effectiveTenant = isHqAdmin
      ? (requestedTenant && requestedTenant.toLowerCase() !== 'hq' ? requestedTenant : '*')
      : callerTenant;
    let rows;
    try {
      rows = await env.AURA_DB.prepare(`SELECT id, name, phone, role, is_active, created_at FROM users
        WHERE role != 'customer' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY created_at DESC`)
        .bind(effectiveTenant, effectiveTenant).all<Record<string, unknown>>();
    } catch { throw new SessionUnavailableError(); }
    const metadata = new Map<string, Record<string, unknown>>();
    // Only this tenant's canonical accounts are eligible for enrichment. Bound
    // concurrent KV reads; never enumerate other tenants' credential records.
    const accounts = rows.results || [];
    const canViewFullPii = session.account.role === 'owner' || session.account.role === 'admin';
    const callerId = String(session.account.id);
    if (env.AUTH_KV) {
      for (let offset = 0; offset < accounts.length; offset += 10) {
        await Promise.all(accounts.slice(offset, offset + 10).map(async row => {
          try { metadata.set(String(row.id), JSON.parse(await env.AUTH_KV.get(`user:${row.id}`) || '{}')); }
          catch { /* Optional display metadata. */ }
        }));
      }
    }
    const users = accounts.map(row => {
      const extra = metadata.get(String(row.id)) || {};
      const isSelf = String(row.id) === callerId;
      const showPii = canViewFullPii || isSelf;
      return {
        id: row.id,
        name: row.name || row.id,
        phone: showPii ? (row.phone || '') : null,
        email: showPii ? (extra.email || '') : null,
        role: row.role,
        position: row.role,
        active: row.is_active === 1,
        isActive: row.is_active === 1,
        startedAt: row.created_at || '',
        created_at: row.created_at || null,
        last_login: extra.last_login || null,
      };
    });
    return jsonResponse({ success: true, users, staff: users });
  } catch (error) {
    return staffSessionErrorResponse(error) || errorResponse('Không thể tải danh sách nhân viên', 500);
  }
}
