/**
 * ═══════════════════════════════════════════════
 *  AURA SPACE — Order Tracker (CF-native)
 *  Replaces Node.js WebSocket server with
 *  Cloudflare KV-flag polling (no extra infra).
 *
 *  Public API is intentionally compatible with
 *  the old WebSocketClient so call-sites need
 *  minimal changes.
 * ═══════════════════════════════════════════════
 */

import { KdsPollClient } from './kds-poll.js';
import { ApiService }    from './api-client.js';

class OrderTracker {
  constructor() {
    this._poller   = new KdsPollClient();
    this._handlers = new Map(); // messageType → Set<fn>
    this.clientId  = null;
    this.clientType = null;
    this._connected = false;

    // Wire poller events → registered handlers
    this._poller.onUpdate = (ts) => this._emit('order_updated', { ts });
    this._poller.onError  = (err) => this._emit('error', { message: err.message });
  }

  // ── Public API (compatible with old WebSocketClient) ──────────────────

  /**
   * "Connect" — starts polling.
   * @param {'admin'|'kitchen'|'customer'} clientType
   * @returns {Promise<{ clientId, clientType }>}
   */
  connect(clientType = 'customer') {
    this.clientType = clientType;
    this.clientId   = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this._poller.start();
    this._connected = true;
    this._emit('connected', { clientId: this.clientId, clientType });
    return Promise.resolve({ clientId: this.clientId, clientType });
  }

  /** Stop polling. */
  disconnect() {
    this._poller.stop();
    this._connected = false;
  }

  /**
   * Register a message handler.
   * Supported types: 'connected' | 'order_updated' | 'new_order' | 'error'
   * @returns {function} unsubscribe function
   */
  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    this._handlers.get(type)?.delete(handler);
  }

  /** Force an immediate poll. */
  ping() { return this._poller.ping(); }

  /**
   * Notify server that a new order was created.
   * In the CF model the Worker already wrote the KV flag, so this
   * is a no-op — kept for API compat.
   */
  sendNewOrder() {}
  updateOrder()  {}
  cancelOrder()  {}

  /**
   * Fetch all active orders from D1 (replaces in-memory orderState).
   * @returns {Promise<Array>}
   */
  async getAllOrders(opts = {}) {
    return ApiService.getOrders(opts);
  }

  /**
   * Fetch a single order with its items.
   * @returns {Promise<object|null>}
   */
  async getOrderStatus(orderId) {
    return ApiService.getOrder(orderId);
  }

  get isConnected() { return this._connected; }

  // ── internal ──────────────────────────────────────────────────────────
  _emit(type, data) {
    this._handlers.get(type)?.forEach(fn => {
      try { fn(data); } catch { /* silent */ }
    });
  }
}

// ── Exports ───────────────────────────────────────────────────────────────
export { OrderTracker };

// Global singletons (backward compat with non-module scripts)
window.OrderTracker   = OrderTracker;
window.orderTracker   = new OrderTracker();
