/** Staff account state is D1-authoritative; KV supplies optional display metadata. */
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { authenticateRequest } from '../../lib/staff-session-auth';
import { staffSessionErrorResponse, SessionUnavailableError } from '../../lib/staff-session';
import type { Env } from '../../types/env';

export async function listStaff(request: Request, rawEnv: Record<string, unknown>) {
  const env = rawEnv as unknown as Env;
  try {
    const session = await authenticateRequest(request, env);
    if (!session || 'blocked' in session) return errorResponse('Vui lòng đăng nhập', 401);
    if (!session.account || !['owner', 'admin', 'manager'].includes(session.account.role)) return errorResponse('Không đủ quyền', 403);
    let rows;
    try {
      rows = await env.AURA_DB.prepare(`SELECT id, name, phone, role, is_active, created_at FROM users
        WHERE role != 'customer' AND COALESCE(NULLIF(tenant_id, ''), 'default') = ? ORDER BY created_at DESC`)
        .bind(session.account.tenant_id || 'default').all<Record<string, unknown>>();
    } catch { throw new SessionUnavailableError(); }
    const metadata = new Map<string, Record<string, unknown>>();
    // Only this tenant's canonical accounts are eligible for enrichment. Bound
    // concurrent KV reads; never enumerate other tenants' credential records.
    const accounts = rows.results || [];
    for (let offset = 0; offset < accounts.length; offset += 10) {
      await Promise.all(accounts.slice(offset, offset + 10).map(async row => {
        try { metadata.set(String(row.id), JSON.parse(await env.AUTH_KV.get(`user:${row.id}`) || '{}')); }
        catch { /* Optional display metadata. */ }
      }));
    }
    const users = accounts.map(row => {
      const extra = metadata.get(String(row.id)) || {};
      return { id: row.id, name: row.name || row.id, phone: row.phone || '', email: extra.email || '',
        role: row.role, position: row.role, active: row.is_active === 1, isActive: row.is_active === 1,
        startedAt: row.created_at || '', created_at: row.created_at || null, last_login: extra.last_login || null };
    });
    return jsonResponse({ success: true, users, staff: users });
  } catch (error) {
    return staffSessionErrorResponse(error) || errorResponse('Không thể tải danh sách nhân viên', 500);
  }
}
