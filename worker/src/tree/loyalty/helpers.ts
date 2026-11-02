// Helper functions extracted from routes/loyalty.ts

export function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function nowSqlTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export async function throttle(
  c: { env: { AUTH_KV?: import('@cloudflare/workers-types').KVNamespace }; req: { header: (n: string) => string | undefined } },
  key: string,
  max: number,
  windowSec: number
): Promise<boolean> {
  const kv = c.env.AUTH_KV;
  if (!kv) {
    return true;
  }
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') {
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
  const g = globalThis as unknown as Record<symbol, Set<string> | undefined>;
  let set = g[OTP_INFLIGHT_SYMBOL];
  if (!set) {
    set = new Set<string>();
    g[OTP_INFLIGHT_SYMBOL] = set;
  }
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
  setTimeout(() => {
    inflight.delete(claim);
  }, 50);
  return true;
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
