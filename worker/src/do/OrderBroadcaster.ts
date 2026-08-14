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

  /**
   * @param state  — structured state (CF: this.state; test: proxy)
   * @param ctx    — execution context (CF: DurableObjectState; test: { storage: { put } })
   */
  constructor(
    private state: OrderBroadcasterState,
    private storage?: { put(key: string, value: string): Promise<void> }
  ) {
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
    this.state.seq++;
    const seq = this.state.seq;

    // Attach seq to the event for getState correlation
    const persisted: OrderEvent = { ...event, seq };

    // Structured write — CF runtime auto-persists this.state
    this.state.orders[event.orderId] = persisted;

    // Non-structured write — survives eviction independently
    if (this.storage) {
      await this.storage.put(`order:${event.orderId}`, JSON.stringify(persisted));
    }

    return { event: persisted, seq };
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
