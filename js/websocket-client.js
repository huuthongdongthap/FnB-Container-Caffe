/**
 * ═══════════════════════════════════════════════
 *  AURA SPACE — Order Tracker (CF-native)
 *  Replaces Node.js WebSocket server with
 *  Cloudflare KV-flag polling (no extra infra).
 * ═══════════════════════════════════════════════
 */
import { KdsPollClient } from './kds-poll.js';
import { ApiService } from './api-client.js';

class OrderTracker {
  constructor() {
    this._poller = new KdsPollClient();
    this._handlers = new Map();
    this.clientId = null;
    this.clientType = null;
    this._connected = false;
    this._poller.onUpdate = (ts) => this._emit('order_updated', { ts });
    this._poller.onError = (err) => this._emit('error', { message: err.message });
  }
  connect(clientType = 'customer') {
    this.clientType = clientType;
    this.clientId = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this._poller.start();
    this._connected = true;
    this._emit('connected', { clientId: this.clientId, clientType });
    return Promise.resolve({ clientId: this.clientId, clientType });
  }
  disconnect() { this._poller.stop(); this._connected = false; }
  on(type, handler) {
    if (!this._handlers.has(type)) {this._handlers.set(type, new Set());}
    this._handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }
  off(type, handler) { this._handlers.get(type)?.delete(handler); }
  ping() { return this._poller.ping(); }
  sendNewOrder() {}
  updateOrder() {}
  cancelOrder() {}
  async getAllOrders(opts = {}) { return ApiService.getOrders(opts); }
  async getOrderStatus(orderId) { return ApiService.getOrder(orderId); }
  get isConnected() { return this._connected; }
  _emit(type, data) {
    this._handlers.get(type)?.forEach(fn => { try { fn(data); } catch { /* silent */ } });
  }
}
export { OrderTracker };
window.OrderTracker = OrderTracker;
window.orderTracker = new OrderTracker();
