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
