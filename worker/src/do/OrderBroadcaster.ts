/**
 * OrderBroadcaster Durable Object — single source of truth for realtime order state.
 *
 * Persistence contract:
 *   CF Workers auto-serializes `this.state` (structured clone) on every mutation.
 *   Non-structured keys (raw event payloads) go through `this.ctx.storage.put()`.
 *
 * State shape:
 *   {
 *     clients: Record<clientId, { role: string, orderIds: string[] }>,
 *     orders:  Record<orderId, OrderEvent>,
 *     seq:     number   // monotonically increments per broadcast
 *   }
 */

// ── Types ────────────────────────────────────────────────────────────

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
  seq?: number; // assigned by broadcast(); reflects position in stream
}

export interface ClientInfo {
  role: string;
  orderIds: string[];
}

export interface OrderBroadcasterState {
  clients: Record<string, ClientInfo>;
  orders: Record<string, OrderEvent>;
  seq: number;
}

// ── Class ─────────────────────────────────────────────────────────────

export class OrderBroadcaster {
  // CF Workers inject state (auto-persisted) + ctx (for storage API).
  // For testing we accept any object that satisfies the same interface.

  private state: OrderBroadcasterState;
  private storage?: { put(_key: string, _value: string): Promise<void> };

  /**
   * @param state  — structured state (CF: this.state; test: proxy)
   * @param ctx    — execution context (CF: DurableObjectState; test: { storage: { put } })
   */
  constructor(state: OrderBroadcasterState, storage?: { put(_key: string, _value: string): Promise<void> }) {
    this.state = state;
    this.storage = storage;
    // Ensure all maps exist on re-hydration (CF re-calls constructor with loaded state)
    this.state.clients = this.state.clients ?? {};
    this.state.orders = this.state.orders ?? {};
    this.state.seq = this.state.seq ?? 0;
  }

  // ── Broadcast ──────────────────────────────────────────────────────

  /**
   * Persist an order event, increment sequence, and return the assigned seq.
   * Caller (fetch handler) is responsible for WS fan-out.
   *
   * Throws if ctx.storage.put fails — caller catches and logs to KV.
   */
  async broadcast(event: OrderEvent): Promise<{ event: OrderEvent; seq: number }> {
    const prevSeq = this.state.seq;
    const prevOrder = this.state.orders[event.orderId];

    this.state.seq++;
    const seq = this.state.seq;

    // Attach seq to the event for getState correlation
    const persisted: OrderEvent = { ...event, seq };

    // Structured write — CF runtime auto-persists this.state
    this.state.orders[event.orderId] = persisted;

    // Non-structured write — survives eviction independently
    if (this.storage) {
      try {
        await this.storage.put(`order:${event.orderId}`, JSON.stringify(persisted));
      } catch (err) {
        this.state.seq = prevSeq;
        if (prevOrder !== undefined) {
          this.state.orders[event.orderId] = prevOrder;
        } else {
          delete this.state.orders[event.orderId];
        }
        throw err;
      }
    }

    // Prune terminal orders past 200 items to prevent memory bloat
    const keys = Object.keys(this.state.orders);
    if (keys.length > 200) {
      const terminal = new Set(['completed', 'cancelled', 'delivered']);
      for (const k of keys) {
        if (terminal.has(this.state.orders[k]?.status) && k !== event.orderId) {
          delete this.state.orders[k];
          if (Object.keys(this.state.orders).length <= 200) break;
        }
      }
    }

    return { event: persisted, seq };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/state') {
      const since = Number(url.searchParams.get('since') || '0');
      return new Response(JSON.stringify(this.getState(since)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  }

  // ── Client lifecycle ───────────────────────────────────────────────

  register(clientId: string, role: string, orderIds: string[]): void {
    this.state.clients[clientId] = { role, orderIds };
  }

  unregister(clientId: string): void {
    delete this.state.clients[clientId];
  }

  // ── State query (diff-sync) ────────────────────────────────────────

  /**
   * Returns all orders whose seq > sinceSeq, ordered by seq ascending.
   * Used by reconnecting clients to fetch missed events.
   */
  getState(sinceSeq: number): OrderEvent[] {
    return Object.values(this.state.orders)
      .filter((o) => (o.seq ?? 0) > sinceSeq)
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  }

  // ── Helpers (used by fetch() handler, not exposed to tests directly) ──

  getClient(clientId: string): ClientInfo | undefined {
    return this.state.clients[clientId];
  }

  getAllClients(): Record<string, ClientInfo> {
    return { ...this.state.clients };
  }
}
