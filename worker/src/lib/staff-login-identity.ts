import type { Env } from '../types/env';
import { SessionUnavailableError } from './staff-session';

export async function staffEmailInUse(env: Env, email: string, staffId?: string) {
  try {
    const raw = await env.AUTH_KV?.get(`user:${email}`);
    if (!raw) return false;
    const existing = JSON.parse(raw);
    return !staffId || existing.id !== staffId;
  } catch { throw new SessionUnavailableError(); }
}

/** D1 locates new Staff accounts even while optional KV metadata is unavailable. */
export async function findLoginUser(env: Env, email: string): Promise<Record<string, any> | null> {
  let legacy: Record<string, any> | null = null;
  let kvFailed = false;
  try { legacy = JSON.parse(await env.AUTH_KV.get(`user:${email}`) || 'null'); }
  catch { kvFailed = true; }
  try {
    const identity = await env.AURA_DB.prepare('SELECT staff_id FROM staff_login_identities WHERE email = ?')
      .bind(email).first<{ staff_id: string }>();
    if (identity?.staff_id) return { ...legacy, id: identity.staff_id, email, role: 'staff',
      password: legacy?.id === identity.staff_id ? legacy.password : '' };
    if (legacy?.role && legacy.role !== 'customer') {
      const canonical = await env.AURA_DB.prepare('SELECT email FROM staff_login_identities WHERE staff_id = ?')
        .bind(legacy.id).first<{ email: string }>();
      if (canonical?.email && canonical.email !== email) return null;
    }
  } catch {
    // Customer authentication keeps its existing optional-D1 contract. Staff
    // schema/authority failures must never become a KV authorization fallback.
    if (!legacy || (legacy.role && legacy.role !== 'customer')) throw new SessionUnavailableError();
  }
  if (kvFailed) throw new SessionUnavailableError();
  return legacy;
}

export async function createStaffIdentity(env: Env, user: {
  id: string; name: string; role: string; phone: string; tenant_id: string;
  password: string; email: string; active?: boolean;
}, firstOwner = false) {
  // Legacy customer/Staff accounts may not yet have a D1 login directory entry.
  if (await staffEmailInUse(env, user.email, user.id)) return false;
  const now = new Date().toISOString();
  const values = [user.id, user.name, user.role, user.phone, user.tenant_id,
    user.active === false ? 0 : 1, user.password, now, now];
  const account = env.AURA_DB.prepare(`INSERT INTO users
    (id, name, role, phone, tenant_id, is_active, auth_version, password_hash, created_at, updated_at)
    ${firstOwner ? "SELECT ?, ?, ?, ?, ?, ?, 1, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')" : 'VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)'}`)
    .bind(...values);
  const identity = env.AURA_DB.prepare(`INSERT INTO staff_login_identities (email, staff_id)
    SELECT ?, id FROM users WHERE id = ?`).bind(user.email, user.id);
  try {
    const result = await env.AURA_DB.batch([account, identity]);
    return (result[0]?.meta.changes || 0) > 0 && (result[1]?.meta.changes || 0) > 0;
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error))) return false;
    throw new SessionUnavailableError();
  }
}
