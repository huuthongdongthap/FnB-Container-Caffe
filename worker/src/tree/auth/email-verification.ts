/** Email verification helpers — D1-backed, 6-char codes, 10 min TTL */

const CODE_TTL_MINUTES = 10;

export function generateVerifyToken(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function expiresAtFromNow(): string {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60_1000).toISOString();
}

export function isExpired(expiresAt: string): boolean {
  return Date.now() > new Date(expiresAt).getTime();
}

/** Store verification code. */
export async function storeVerifyCode(
  db: { prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<{ rowCount: number }> } } },
  id: string,
  email: string,
  code: string,
  expiresAt: string
): Promise<void> {
  await db
    .prepare(
      'INSERT OR REPLACE INTO email_verifications (id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, email, code, expiresAt, new Date().toISOString())
    .run();
}

/** Look up pending code by email. */
export async function lookupVerifyCode(
  db: { prepare(sql: string): { bind(...args: unknown[]): { first<T = Record<string, unknown>>(): Promise<T | null> } } },
  email: string
): Promise<{ id: string; code: string; expires_at: string } | null> {
  const row = await db
    .prepare('SELECT id, code, expires_at FROM email_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1')
    .bind(email)
    .first<{ id: string; code: string; expires_at: string }>();
  return row ?? null;
}

/** Mark code used (delete after successful verification). */
export async function deleteVerifyCode(
  db: { prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<{ rowCount: number }> } } },
  id: string
): Promise<void> {
  await db.prepare('DELETE FROM email_verifications WHERE id = ?').bind(id).run();
}
