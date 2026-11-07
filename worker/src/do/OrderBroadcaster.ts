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
  tenant_id?: string;
  tenantId?: string;
  __tenant_id?: string;
  _cachedAt?: number;
}

function normalizeOrderTenant(raw: unknown): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return 'default';
  if (trimmed.toLowerCase() === 'hq' || trimmed === '*') return '*';
  return trimmed;
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
  public recentOrders: Map<string, Record<string, unknown>> = new Map();
  private sessions: Map<{ send: (msg: string) => void }, { tenantId: string }> = new Map();

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
          for (const order of Object.values(saved.orders)) {
            const orderTenant = normalizeOrderTenant(order.__tenant_id ?? order.tenant_id ?? order.tenantId);
            const cacheKey = `${orderTenant}:${order.orderId}`;
            this.recentOrders.set(cacheKey, {
              ...order,
              __tenant_id: orderTenant,
              _cachedAt: order._cachedAt ?? order.updatedAt ?? Date.now(),
            });
          }
        }
      };
      this.ready = input.blockConcurrencyWhile ? input.blockConcurrencyWhile(hydrate) : hydrate();
    }
  }

  /** Serialize writes and publish memory only after storage succeeds. */
  broadcast(event: OrderEvent, tenantOverride?: string): Promise<{ event: OrderEvent; seq: number }> {
    const task = this.pending.then(async () => {
      await this.ready;
      const parsed = parseOrderBroadcast(event);
      if (!parsed) throw new Error('Invalid order event');
      const rawEvent = event as unknown as Record<string, unknown>;
      const rawTenant = tenantOverride ?? rawEvent.__tenant_id ?? rawEvent.tenant_id ?? rawEvent.tenantId;
      const orderTenant = normalizeOrderTenant(rawTenant);
      const orderId = parsed.orderId;
      const cacheKey = `${orderTenant}:${orderId}`;
      const stateKey = orderTenant === 'default' ? orderId : cacheKey;
      const seq = this.state.seq + 1;
      const persisted: OrderEvent = {
        ...parsed,
        ...(rawTenant !== undefined ? { tenant_id: orderTenant, __tenant_id: orderTenant } : {}),
        seq,
      };
      const merged = { ...this.state.orders, [stateKey]: persisted };
      // Bounded retention: TTL for closed orders, then a hard cap by age.
      const orders = evictStaleOrders(merged, stateKey);
      if (this.snapshotStorage) {
        // `clients` is deliberately empty: a registration is a live WebSocket
        // handle, and one that outlived a DO restart would point at a socket
        // that no longer exists. Clients re-register on reconnect.
        await this.snapshotStorage.put(STATE_KEY, { clients: {}, orders, seq });
      }
      this.state.orders = orders;
      this.state.seq = seq;

      this.recentOrders.set(cacheKey, {
        ...rawEvent,
        ...persisted,
        __tenant_id: orderTenant,
        _cachedAt: Date.now(),
      });
      while (this.recentOrders.size > MAX_ORDERS) {
        const oldestKey = this.recentOrders.keys().next().value;
        if (!oldestKey || oldestKey === cacheKey) break;
        this.recentOrders.delete(oldestKey);
      }

      const payloadMsg = JSON.stringify({ type: 'order_update', order: persisted, tenantId: orderTenant });
      for (const [sock, meta] of this.sessions.entries()) {
        if (meta.tenantId === '*' || meta.tenantId === orderTenant) {
          try {
            sock.send(payloadMsg);
          } catch {
            this.sessions.delete(sock);
          }
        }
      }

      return { event: persisted, seq };
    });
    this.pending = task.then(() => {}, () => {});
    return task;
  }

  handleWebSocket(
    request: Request,
    socketOverride?: { send: (msg: string) => void; addEventListener?: (type: string, cb: () => void) => void }
  ): Response {
    const url = new URL(request.url);
    const rawTenant =
      request.headers.get('X-Tenant-ID') ||
      request.headers.get('x-tenant-id') ||
      request.headers.get('X-Store-ID') ||
      request.headers.get('x-store-id') ||
      url.searchParams.get('tenant_id') ||
      url.searchParams.get('tenantId') ||
      url.searchParams.get('store_id') ||
      url.searchParams.get('storeId') ||
      'default';
    const socketTenant = normalizeOrderTenant(rawTenant);

    const recentList = Array.from(this.recentOrders.values()).filter((item) => {
      const itemTenant = normalizeOrderTenant(
        item.__tenant_id || item.tenant_id || item.tenantId || 'default'
      );
      return socketTenant === '*' || itemTenant === socketTenant;
    });

    if (socketOverride) {
      this.sessions.set(socketOverride, { tenantId: socketTenant });
      socketOverride.send(JSON.stringify({ type: 'snapshot', orders: recentList }));
      if (typeof socketOverride.addEventListener === 'function') {
        socketOverride.addEventListener('close', () => this.sessions.delete(socketOverride));
      }
      return Response.json({ type: 'snapshot', orders: recentList });
    }

    const WsPairCtor = (globalThis as unknown as { WebSocketPair?: new () => { 0: WebSocket; 1: WebSocket & { accept: () => void } } }).WebSocketPair;
    if (typeof WsPairCtor === 'function') {
      const pair = new WsPairCtor();
      const client = pair[0];
      const server = pair[1];
      server.accept();
      this.sessions.set(server, { tenantId: socketTenant });
      server.send(JSON.stringify({ type: 'snapshot', orders: recentList }));
      server.addEventListener('close', () => this.sessions.delete(server));
      return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    }

    return Response.json({ type: 'snapshot', orders: recentList });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    // Only binding-origin requests can mutate; public realtime proxies keep their original path/host.
    if (url.hostname === 'do' && url.pathname === '/broadcast' && request.method === 'POST') {
      let body: unknown;
      try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
      const fields = body && typeof body === 'object' ? body as Record<string, unknown> : {};
      const headerTenant =
        request.headers.get('X-Tenant-ID') ||
        request.headers.get('x-tenant-id') ||
        url.searchParams.get('tenant_id') ||
        url.searchParams.get('tenantId') ||
        undefined;
      const rawTenant = fields.__tenant_id ?? fields.tenant_id ?? fields.tenantId ?? headerTenant;
      const orderTenant = normalizeOrderTenant(rawTenant);
      const id = fields.orderId ?? fields.order_id;
      const cacheKey = typeof id === 'string' ? `${orderTenant}:${id}` : '';
      const previous =
        typeof id === 'string'
          ? (this.state.orders[cacheKey] ?? (orderTenant === 'default' ? this.state.orders[id] : undefined))
          : undefined;
      const event = parseOrderBroadcast(body, previous);
      if (!event) return new Response('Invalid order event', { status: 400 });
      try {
        const result = await this.broadcast(
          rawTenant !== undefined ? { ...event, tenant_id: orderTenant, __tenant_id: orderTenant } : event,
          rawTenant !== undefined ? orderTenant : undefined
        );
        return Response.json({ success: true, seq: result.seq });
      } catch { return new Response('Order broadcast unavailable', { status: 503 }); }
    }
    if (url.pathname === '/state' && request.method === 'GET') {
      const since = Number(url.searchParams.get('since') || '0');
      const rawTenant =
        request.headers.get('X-Tenant-ID') ||
        request.headers.get('x-tenant-id') ||
        url.searchParams.get('tenant_id') ||
        url.searchParams.get('tenantId') ||
        undefined;
      return Response.json(
        this.getState(
          Number.isFinite(since) && since >= 0 ? since : 0,
          rawTenant ? normalizeOrderTenant(rawTenant) : undefined
        )
      );
    }
    if (
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket' ||
      url.pathname === '/ws' ||
      url.pathname.startsWith('/api/realtime')
    ) {
      return this.handleWebSocket(request);
    }
    return new Response('Not found', { status: 404 });
  }

  register(clientId: string, role: string, orderIds: string[]): void { this.state.clients[clientId] = { role, orderIds }; }
  unregister(clientId: string): void { delete this.state.clients[clientId]; }
  getState(sinceSeq: number, tenantId?: string): OrderEvent[] {
    const normalizedFilter = tenantId ? normalizeOrderTenant(tenantId) : undefined;
    return Object.values(this.state.orders)
      .filter((order) => {
        if ((order.seq ?? 0) <= sinceSeq) return false;
        if (!normalizedFilter || normalizedFilter === '*') return true;
        const itemTenant = normalizeOrderTenant(order.__tenant_id ?? order.tenant_id ?? order.tenantId);
        return itemTenant === normalizedFilter;
      })
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  }
  getClient(clientId: string): ClientInfo | undefined { return this.state.clients[clientId]; }
  getAllClients(): Record<string, ClientInfo> { return { ...this.state.clients }; }
}
