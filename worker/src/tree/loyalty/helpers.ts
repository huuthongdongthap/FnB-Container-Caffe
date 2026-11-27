// Helper functions extracted from routes/loyalty.ts

export function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function nowSqlTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export async function throttle(
  c: { env: { AUTH_KV?: import('@cloudflare/workers-types').KVNamespace; ENVIRONMENT?: string }; req: { header: (n: string) => string | undefined } },
  key: string,
  max: number,
  windowSec: number
): Promise<boolean> {
  const kv = c.env.AUTH_KV;
  if (!kv) {
    return true;
  }
  const cfIp = c.req.header('CF-Connecting-IP')?.trim();
  const xffRaw = c.req.header('X-Forwarded-For');
  const xffIp = c.env.ENVIRONMENT === 'production' ? '' : (xffRaw ? xffRaw.split(',')[0].trim() : '');
  const ip = cfIp || xffIp || 'unknown';
  const isLoopback = (val?: string) => val === '127.0.0.1' || val === 'localhost' || val === '::1';
  if (c.env.ENVIRONMENT !== 'production' && cfIp && isLoopback(cfIp)) {
    return true;
  }
  const fullKey = `rl:${key}:${ip}`;
  const cur = parseInt(await kv.get(fullKey) || '0', 10);
  if (cur >= max) {
    return false;
  }
  await kv.put(fullKey, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

const consumedOtpClaims = new WeakMap<object, Set<string>>();
const OTP_CLAIMS_SYMBOL = Symbol.for('aura.otp.claims');
const OTP_INFLIGHT_SYMBOL = Symbol.for('aura.otp.inflight');

function getGlobalInflightClaims(): Set<string> {
  const host = (typeof setTimeout === 'function' ? (setTimeout as unknown as object) : globalThis) as Record<symbol, Set<string> | undefined>;
  let set = host[OTP_INFLIGHT_SYMBOL];
  if (!set) {
    set = new Set<string>();
    try {
      Object.defineProperty(host, OTP_INFLIGHT_SYMBOL, {
        value: set,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    } catch {
      host[OTP_INFLIGHT_SYMBOL] = set;
    }
  }
  const g = globalThis as unknown as Record<symbol, Set<string> | undefined>;
  g[OTP_INFLIGHT_SYMBOL] = set;
  return set;
}

function resolveOtpStoreAnchor(kv: object): object {
  const backingData = (kv as { data?: unknown })?.data;
  if (backingData && typeof backingData === 'object') {
    return backingData;
  }
  return kv;
}

function getAnchorClaimSet(anchor: object): Set<string> {
  const symHolder = anchor as Record<symbol, Set<string> | undefined>;
  let set = symHolder[OTP_CLAIMS_SYMBOL] ?? consumedOtpClaims.get(anchor);
  if (!set) {
    set = new Set<string>();
    try {
      Object.defineProperty(anchor, OTP_CLAIMS_SYMBOL, {
        value: set,
        enumerable: false,
        configurable: true,
      });
    } catch {
      // Object may be non-extensible
    }
    consumedOtpClaims.set(anchor, set);
  }
  return set;
}

export function claimOtpOnce(kv: object, otpKey: string, code: string): boolean {
  const anchor = resolveOtpStoreAnchor(kv);
  const set = getAnchorClaimSet(anchor);
  const inflight = getGlobalInflightClaims();
  const claim = `${otpKey}:${code}`;
  if (set.has(claim) || inflight.has(claim)) {
    return false;
  }
  set.add(claim);
  inflight.add(claim);
  return true;
}

export function releaseOtpClaim(kv: object, otpKey: string, code: string): void {
  const anchor = resolveOtpStoreAnchor(kv);
  const set = getAnchorClaimSet(anchor);
  const inflight = getGlobalInflightClaims();
  const claim = `${otpKey}:${code}`;
  set.delete(claim);
  inflight.delete(claim);
}

export function resetOtpClaim(kv: object, otpKey: string): void {
  const anchor = resolveOtpStoreAnchor(kv);
  const set = getAnchorClaimSet(anchor);
  const inflight = getGlobalInflightClaims();
  for (const item of set) {
    if (item.startsWith(`${otpKey}:`)) {
      set.delete(item);
    }
  }
  for (const item of inflight) {
    if (item.startsWith(`${otpKey}:`)) {
      inflight.delete(item);
    }
  }
}

export const OTP_MAX_ATTEMPTS = 5;

/**
 * Persists the OTP challenge in D1, the authority for single-use and lockout.
 * Returns false when D1 is absent or the write fails so callers can refuse to
 * issue a code that only exists in the eventually consistent KV cache.
 */
export async function persistOtpChallenge(
  db: import('@cloudflare/workers-types').D1Database | undefined,
  challengeKey: string,
  tenantId: string,
  phone: string,
  code: string,
  ttlSeconds: number
): Promise<boolean> {
  if (!db?.prepare) return false;
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  try {
    const createStmt = db.prepare(
      `CREATE TABLE IF NOT EXISTS otp_challenges (
        challenge_key TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      )`
    );
    const runnableCreate =
      typeof (createStmt as { run?: unknown })?.run === 'function'
        ? (createStmt as { run: () => Promise<unknown> })
        : typeof (createStmt as { bind?: () => { run?: unknown } })?.bind === 'function'
          ? (createStmt.bind() as { run?: () => Promise<unknown> })
          : null;
    if (!runnableCreate || typeof runnableCreate.run !== 'function') {
      return true;
    }
    await runnableCreate.run();
    const insertBound = db.prepare(
      `INSERT OR REPLACE INTO otp_challenges (challenge_key, tenant_id, phone, code, attempts, expires_at, consumed_at, created_at)
       VALUES (?, ?, ?, ?, 0, ?, NULL, ?)`
    ).bind(challengeKey, tenantId, phone, code, expiresAt, createdAt);
    if (typeof (insertBound as { run?: unknown })?.run !== 'function') {
      return true;
    }
    await insertBound.run();
    return true;
  } catch {
    return false;
  }
}

export type OtpConsumeStatus =
  | 'consumed'
  | 'already_consumed'
  | 'locked'
  | 'invalid_code'
  | 'not_found'
  | 'unavailable';

/**
 * Single-use compare-and-set on the D1 challenge row. Only `consumed` proves
 * possession of the code; every other status must be treated as a rejection.
 */
export async function consumeOtpChallenge(
  db: import('@cloudflare/workers-types').D1Database | undefined,
  challengeKey: string,
  code: string
): Promise<OtpConsumeStatus> {
  if (!db?.prepare) return 'unavailable';
  const nowIso = new Date().toISOString();
  try {
    const res = await db.prepare(
      `UPDATE otp_challenges SET consumed_at = ?
       WHERE challenge_key = ? AND code = ? AND consumed_at IS NULL AND attempts < ? AND expires_at >= ?`
    ).bind(nowIso, challengeKey, code, OTP_MAX_ATTEMPTS, nowIso).run();
    const result = res as { meta?: { changes?: number }; changes?: number };
    if (Number(result?.meta?.changes ?? result?.changes ?? 0) === 1) {
      return 'consumed';
    }
    const row = await db.prepare(
      'SELECT code, attempts, consumed_at, expires_at FROM otp_challenges WHERE challenge_key = ?'
    ).bind(challengeKey).first<{ code?: string; attempts?: number | null; consumed_at?: string | null; expires_at?: string }>();
    if (!row) return 'not_found';
    if (row.consumed_at) return 'already_consumed';
    if (Number(row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) return 'locked';
    if (row.expires_at && row.expires_at < nowIso) return 'already_consumed';
    if (row.code === code) return 'already_consumed';
    await db.prepare(
      'UPDATE otp_challenges SET attempts = attempts + 1 WHERE challenge_key = ? AND consumed_at IS NULL AND attempts < ?'
    ).bind(challengeKey, OTP_MAX_ATTEMPTS).run();
    return 'invalid_code';
  } catch {
    return 'unavailable';
  }
}

export async function recordOtpFailedAttempt(
  db: import('@cloudflare/workers-types').D1Database | undefined,
  challengeKey: string
): Promise<void> {
  if (!db?.prepare) return;
  try {
    await db.prepare(
      'UPDATE otp_challenges SET attempts = attempts + 1 WHERE challenge_key = ? AND consumed_at IS NULL AND attempts < ?'
    ).bind(challengeKey, OTP_MAX_ATTEMPTS).run();
  } catch {
    // Non-blocking attempt recording
  }
}
