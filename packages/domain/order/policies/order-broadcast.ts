/**
 * Shared Durable Object broadcast dispatcher for order realtime updates.
 *
 * Always invokes `stub.fetch('https://do/broadcast', ...)` before checking
 * `stub.broadcast`: in Cloudflare Workers (`workerd`), every DurableObjectStub
 * is a Proxy where `typeof stub.broadcast === 'function'` evaluates to true
 * even when the target Durable Object does not extend `DurableObject` for RPC,
 * causing calls to throw a runtime RPC error. The `stub.broadcast` fallback is
 * retained only for lightweight unit-test stubs that omit `fetch`.
 */

export interface OrderBroadcasterStubLike {
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  broadcast?: (msg: unknown) => Promise<unknown>;
}

export interface OrderBroadcasterNamespaceLike {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => OrderBroadcasterStubLike;
}

export function parseBroadcastItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseBroadcastTimestamp(raw: unknown, fallback: number = Date.now()): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim();
    const normalized = trimmed.includes('T') ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return fallback;
}

export function normalizeBroadcastTotal(raw: unknown): number {
  const num = Number(raw ?? 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num);
}

export function resolveOrderBroadcastChannels(orderId: string, rawTenant?: string | null): {
  tenantId: string;
  orderChannel: string;
  storeChannel: string;
} {
  const trimmed = typeof rawTenant === 'string' ? rawTenant.trim() : '';
  const tenantId =
    trimmed && trimmed !== '*' && trimmed.toLowerCase() !== 'hq'
      ? trimmed
      : 'default';
  const orderChannel = tenantId !== 'default' ? `${tenantId}:${orderId}` : orderId;
  const storeChannel = tenantId !== 'default' ? `${tenantId}:kitchen` : 'kitchen';
  return { tenantId, orderChannel, storeChannel };
}

export async function dispatchOrderBroadcast(
  broadcaster: unknown,
  channel: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const ns = broadcaster as OrderBroadcasterNamespaceLike | null | undefined;
  if (!ns || typeof ns.idFromName !== 'function' || typeof ns.get !== 'function') return;
  const stub = ns.get(ns.idFromName(channel));
  if (!stub) return;

  if (typeof stub.fetch === 'function') {
    const res = await stub.fetch(
      new Request('https://do/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
    if (res && typeof res.ok === 'boolean' && !res.ok) {
      throw new Error(`Order broadcast returned HTTP ${res.status}`);
    }
    return;
  }

  if (typeof stub.broadcast === 'function') {
    await stub.broadcast(payload);
  }
}

/**
 * Fans out an order event to BOTH the per-order tracking channel and the
 * tenant-scoped store-wide channel (`kitchen` for `'default'`, `${tenant}:kitchen`
 * for non-default stores) so KDS, POS, and Order Management WebSocket subscribers
 * receive live events alongside single-order guest trackers.
 */
export async function fanOutOrderBroadcast(
  broadcaster: unknown,
  orderId: string,
  rawTenant: string | null | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  const { orderChannel, storeChannel } = resolveOrderBroadcastChannels(orderId, rawTenant);
  const channels = orderChannel === storeChannel ? [orderChannel] : [orderChannel, storeChannel];
  const results = await Promise.allSettled(
    channels.map((ch) => dispatchOrderBroadcast(broadcaster, ch, payload)),
  );
  const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (firstFailure) {
    throw firstFailure.reason;
  }
}
