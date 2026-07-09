/**
 * KV helpers for rate limiting, caching, and coordination.
 */

import type { KVNamespace } from '@cloudflare/workers-types';

export async function kvIncrement(
  kv: KVNamespace,
  key: string,
  expirationTtl: number
): Promise<number> {
  const current = parseInt((await kv.get(key)) || '0', 10);
  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl });
  return next;
}

export async function kvGet<T = string>(
  kv: KVNamespace,
  key: string
): Promise<T | null> {
  const val = await kv.get(key);
  if (val === null) {
    return null;
  }
  try {
    return JSON.parse(val) as T;
  } catch {
    return val as unknown as T;
  }
}

export async function kvSet(
  kv: KVNamespace,
  key: string,
  value: string,
  expirationTtl?: number
): Promise<void> {
  if (expirationTtl) {
    await kv.put(key, value, { expirationTtl });
  } else {
    await kv.put(key, value);
  }
}
