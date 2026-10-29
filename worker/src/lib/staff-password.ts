/** Staff credentials become D1-authoritative after verified legacy import. */
import type { D1Database } from '@cloudflare/workers-types';
import { hashPassword, verifyPassword } from './jwt';
import { SessionUnavailableError, StaffSessionError, type StaffAccount } from './staff-session';

export async function verifyStaffPassword(db: D1Database, account: StaffAccount, password: string, legacyHash: string) {
  let current;
  try { current = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(account.id).first<{ password_hash: string | null }>(); }
  catch { throw new SessionUnavailableError(); }
  if (!current) throw new StaffSessionError('SESSION_REVOKED');
  if (!await verifyPassword(password, current.password_hash || legacyHash)) return false;
  if (!current.password_hash) {
    const hash = legacyHash.startsWith('pbkdf2$') ? legacyHash : await hashPassword(password);
    let result;
    try {
      result = await db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND auth_version = ? AND password_hash IS NULL')
        .bind(hash, account.id, account.auth_version).run();
    } catch { throw new SessionUnavailableError(); }
    // A concurrent password change wins; the old KV hash must not re-authorize it.
    if (!result.meta.changes) throw new StaffSessionError('SESSION_REVOKED');
  }
  return true;
}
export async function changeStaffPassword(db: D1Database, account: StaffAccount, hash: string) {
  let result;
  try {
    result = await db.prepare('UPDATE users SET password_hash = ?, auth_version = auth_version + 1, updated_at = ? WHERE id = ? AND auth_version = ?')
      .bind(hash, new Date().toISOString(), account.id, account.auth_version).run();
  } catch { throw new SessionUnavailableError(); }
  if (!result.meta.changes) throw new StaffSessionError('SESSION_REVOKED');
}
