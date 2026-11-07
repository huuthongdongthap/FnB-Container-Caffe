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
  const xffIp = xffRaw ? xffRaw.split(',')[0].trim() : '';
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

export async function persistOtpChallenge(
  db: import('@cloudflare/workers-types').D1Database | undefined,
  challengeKey: string,
  tenantId: string,
  phone: string,
  code: string,
  ttlSeconds: number
): Promise<void> {
  if (!db?.prepare) return;
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS otp_challenges (
        challenge_key TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      )`
    ).run();
    await db.prepare(
      `INSERT OR REPLACE INTO otp_challenges (challenge_key, tenant_id, phone, code, expires_at, consumed_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`
    ).bind(challengeKey, tenantId, phone, code, expiresAt, createdAt).run();
  } catch {
    // Optional challenge table in minimal mock D1 fixtures
  }
}

export async function consumeOtpChallenge(
  db: import('@cloudflare/workers-types').D1Database | undefined,
  challengeKey: string,
  code: string
): Promise<'consumed' | 'already_consumed' | 'unavailable'> {
  if (!db?.prepare) return 'unavailable';
  const nowIso = new Date().toISOString();
  try {
    const existing = await db.prepare(
      'SELECT code, consumed_at, expires_at FROM otp_challenges WHERE challenge_key = ?'
    ).bind(challengeKey).first<{ code?: string; consumed_at?: string | null; expires_at?: string }>();
    if (!existing) {
      return 'unavailable';
    }
    const res = await db.prepare(
      'UPDATE otp_challenges SET consumed_at = ? WHERE challenge_key = ? AND code = ? AND consumed_at IS NULL AND expires_at >= ?'
    ).bind(nowIso, challengeKey, code, nowIso).run();
    const changes = Number((res as { meta?: { changes?: number } })?.meta?.changes ?? 0);
    return changes === 1 ? 'consumed' : 'already_consumed';
  } catch {
    return 'unavailable';
  }
}
