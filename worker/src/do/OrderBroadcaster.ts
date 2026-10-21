/** Durable realtime order snapshots. D1 remains the transactional source of truth. */
import { parseOrderBroadcast } from './order-broadcast-event';

export interface OrderEvent {
  orderId: string;
  status: string;
  payment_status: string;
  items: unknown[];
  total: number;
  customer_name: string;
  customer_phone: string;
  table_id?: string | null;
  createdAt: number;
  updatedAt: number;
  seq?: number;
}
export interface ClientInfo { role: string; orderIds: string[] }
export interface OrderBroadcasterState {
  clients: Record<string, ClientInfo>;
  orders: Record<string, OrderEvent>;
  seq: number;
}
interface SnapshotStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<unknown>;
}
const STATE_KEY = 'order-broadcaster:state';

/**
 * Eviction bounds for the in-memory order map.
 *
 * `TTL_MS` retires closed orders 24h after their last update. Only terminal
 * orders age out: an active order is one a client may still be waiting on, and
 * the KDS dashboard needs it until it closes.
 * `MAX_ORDERS` caps retention under sustained pressure. Past the cap the oldest
 * entries go first, but the order written in the current tick is always kept —
 * dropping it would make its own broadcast a no-op.
 */
const MAX_ORDERS = 500;
const TTL_MS = 24 * 60 * 60 * 1000;
/**
 * Cache-eviction terminal set. `delivered` is terminal *here* even though the
 * backend lifecycle still allows delivered → completed: once an order reaches
 * the customer it no longer needs a live SSE slot.
 *
 * Members must match a status a broadcast can actually carry. The order
 * lifecycle (`ORDER_STATUSES`) is the canonical source; `refunded` lives only
 * on `payment_status` and no code path broadcasts it as an order status, so
 * leaving it out keeps a settlement from pinning a cache slot.
 */
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'delivered', 'failed', 'expired']);

/**
 * Bounds retention: terminal orders past the TTL are dropped, then — only if
 * still over the cap — the oldest remaining entries are dropped too.
 */
function evictStaleOrders(
  orders: Record<string, OrderEvent>,
  keepOrderId: string
): Record<string, OrderEvent> {
  const now = Date.now();
  const pruned: Record<string, OrderEvent> = {};
  for (const [key, order] of Object.entries(orders)) {
    if (key === keepOrderId || !TERMINAL_STATUSES.has(order.status)) {
      pruned[key] = order;
      continue;
    }
    const age = now - (order.updatedAt ?? order.createdAt ?? now);
    if (age <= TTL_MS) {
      pruned[key] = order;
    }
  }

  const keys = Object.keys(pruned);
  if (keys.length <= MAX_ORDERS) {
    return pruned;
  }

  const overflow = keys.length - MAX_ORDERS;
  // Oldest first, so the freshest orders are the ones that survive.
  keys.sort((a, b) => (pruned[a].updatedAt ?? pruned[a].createdAt ?? 0) - (pruned[b].updatedAt ?? pruned[b].createdAt ?? 0));
  let dropped = 0;
  for (const key of keys) {
    if (dropped >= overflow) break;
    if (key === keepOrderId) continue;
    delete pruned[key];
    dropped++;
  }
  return pruned;
}

export class OrderBroadcaster {
  /** Live state — the object the runtime (or fixture) handed us. */
  private state: OrderBroadcasterState;
  private snapshotStorage?: SnapshotStorage;
  private ready: Promise<void> = Promise.resolve();
  private pending: Promise<void> = Promise.resolve();

  /**
   * CF hands a DO its own `state` — which owns `storage` and
   * `blockConcurrencyWhile` — so the init argument doubles as the state we
   * mutate. A test fixture supplies the same shape inline.
   */
  constructor(input: DurableObjectState) {
    this.state = input as unknown as OrderBroadcasterState;
    this.state.clients ??= {};
    this.state.orders ??= {};
    this.state.seq ??= 0;

    const storage = input.storage;
    if (typeof storage?.get === 'function') {
      this.snapshotStorage = storage;
      const hydrate = async () => {
        const saved = await storage.get<OrderBroadcasterState>(STATE_KEY);
        if (saved && saved.orders && Number.isFinite(saved.seq)) {
          this.state.orders = saved.orders;
          this.state.seq = saved.seq;
        }
      };
      this.ready = input.blockConcurrencyWhile ? input.blockConcurrencyWhile(hydrate) : hydrate();
    }
  }

  /** Serialize writes and publish memory only after storage succeeds. */
  broadcast(event: OrderEvent): Promise<{ event: OrderEvent; seq: number }> {
    const task = this.pending.then(async () => {
      await this.ready;
      const parsed = parseOrderBroadcast(event);
      if (!parsed) throw new Error('Invalid order event');
      const seq = this.state.seq + 1;
      const persisted = { ...parsed, seq };
      const merged = { ...this.state.orders, [parsed.orderId]: persisted };
      // Bounded retention: TTL for closed orders, then a hard cap by age.
      const orders = evictStaleOrders(merged, parsed.orderId);
      if (this.snapshotStorage) {
        // `clients` is deliberately empty: a registration is a live WebSocket
        // handle, and one that outlived a DO restart would point at a socket
        // that no longer exists. Clients re-register on reconnect.
        await this.snapshotStorage.put(STATE_KEY, { clients: {}, orders, seq });
      }
      this.state.orders = orders;
      this.state.seq = seq;
      return { event: persisted, seq };
    });
    this.pending = task.then(() => {}, () => {});
    return task;
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    // Only binding-origin requests can mutate; public realtime proxies keep their original path/host.
    if (url.hostname === 'do' && url.pathname === '/broadcast' && request.method === 'POST') {
      let body: unknown;
      try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
      const fields = body && typeof body === 'object' ? body as Record<string, unknown> : {};
      const id = fields.orderId ?? fields.order_id;
      const previous = typeof id === 'string' ? this.state.orders[id] : undefined;
      const event = parseOrderBroadcast(body, previous);
      if (!event) return new Response('Invalid order event', { status: 400 });
      try {
        const result = await this.broadcast(event);
        return Response.json({ success: true, seq: result.seq });
      } catch { return new Response('Order broadcast unavailable', { status: 503 }); }
    }
    if (url.pathname === '/state' && request.method === 'GET') {
      const since = Number(url.searchParams.get('since') || '0');
      return Response.json(this.getState(Number.isFinite(since) && since >= 0 ? since : 0));
    }
    return new Response('Not found', { status: 404 });
  }

  register(clientId: string, role: string, orderIds: string[]): void { this.state.clients[clientId] = { role, orderIds }; }
  unregister(clientId: string): void { delete this.state.clients[clientId]; }
  getState(sinceSeq: number): OrderEvent[] {
    return Object.values(this.state.orders).filter(order => (order.seq ?? 0) > sinceSeq)
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  }
  getClient(clientId: string): ClientInfo | undefined { return this.state.clients[clientId]; }
  getAllClients(): Record<string, ClientInfo> { return { ...this.state.clients }; }
}
