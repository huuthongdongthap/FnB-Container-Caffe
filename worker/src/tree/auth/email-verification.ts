/** Email verification helpers — D1-backed, 6-char codes, 10 min TTL */

const CODE_TTL_MINUTES = 10;

export function generateVerifyToken(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

export function expiresAtFromNow(): string {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
}

export function isExpired(expiresAt: string): boolean {
  return Date.now() > new Date(expiresAt).getTime();
}

/** Store verification code. */
export async function storeVerifyCode(
  db: { prepare(_sql: string): { bind(..._args: unknown[]): { run(): Promise<{ rowCount: number }> } } },
  id: string,
  email: string,
  code: string,
  expiresAt: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        'INSERT OR REPLACE INTO email_verifications (id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(id, email, code, expiresAt, now)
      .run();
  } catch (err) {
    if (String((err as Error)?.message || '').includes('column')) {
      await db
        .prepare(
          'INSERT OR REPLACE INTO email_verifications (id, user_id, email, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(id, email, email, code, expiresAt, now)
        .run();
      return;
    }
    throw err;
  }
}

/** Look up pending code by email. */
export async function lookupVerifyCode(
  db: { prepare(_sql: string): { bind(..._args: unknown[]): { first<T = Record<string, unknown>>(): Promise<T | null> } } },
  email: string
): Promise<{ id: string; code: string; expires_at: string } | null> {
  try {
    const row = await db
      .prepare('SELECT id, code, expires_at FROM email_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1')
      .bind(email)
      .first<{ id: string; code: string; expires_at: string }>();
    return row ?? null;
  } catch (err) {
    if (String((err as Error)?.message || '').includes('column')) {
      const row = await db
        .prepare('SELECT id, token AS code, expires_at FROM email_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1')
        .bind(email)
        .first<{ id: string; code: string; expires_at: string }>();
      return row ?? null;
    }
    throw err;
  }
}

/** Mark code used (delete after successful verification). */
export async function deleteVerifyCode(
  db: { prepare(_sql: string): { bind(..._args: unknown[]): { run(): Promise<{ rowCount: number }> } } },
  id: string
): Promise<void> {
  await db.prepare('DELETE FROM email_verifications WHERE id = ?').bind(id).run();
}
