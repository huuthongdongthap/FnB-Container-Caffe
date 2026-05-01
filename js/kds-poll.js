/**
 * ═══════════════════════════════════════════════
 *  AURA CAFE — KDS Smart Poller
 *  Cloudflare KV flag–based realtime (Option A)
 *  Replaces Node.js WebSocket server dependency
 * ═══════════════════════════════════════════════
 */

import { API_CONFIG } from './config.js';

const DBG = () => typeof window !== 'undefined' && window.AURA_DEBUG;

export class KdsPollClient {
  constructor(baseUrl, pollMs = 3000) {
    this.baseUrl = baseUrl ?? API_CONFIG.WORKER_BASE_URL;
    this.pollMs = pollMs;
    this._timer = null;
    this._lastTs = null;
    this._running = false;
    this.onUpdate = null;
    /** Fired on network error during polling. */
    this.onError = null;
    /** Fired when polling starts / stops. */
    this.onStatusChange = null;
  }

  start() {
    if (this._running) {return;}
    this._running = true;
    this._tick();
    this._timer = setInterval(() => this._tick(), this.pollMs);
    this.onStatusChange?.('started');
    if (DBG()) {console.log(`[KDS] Polling started — ${this.pollMs}ms interval`);}
  }

  stop() {
    if (!this._running) {return;}
    this._running = false;
    clearInterval(this._timer);
    this._timer = null;
    this.onStatusChange?.('stopped');
    if (DBG()) {console.log('[KDS] Polling stopped');}
  }

  async ping() { return this._tick(); }

  async _tick() {
    try {
      const res = await fetch(`${this.baseUrl}/kds/orders/latest`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
      const { ts } = await res.json();
      if (ts && ts !== this._lastTs) {
        const prev = this._lastTs;
        this._lastTs = ts;
        const DEBUG = typeof window !== 'undefined' && window.AURA_DEBUG;
        if (prev !== null) {
          if (DEBUG) {console.log(`[KDS] Update detected: ${ts}`);}
          this.onUpdate?.(ts);
          this._notifyDOM(ts);
        } else if (DEBUG) {
          console.log(`[KDS] Seeded initial ts: ${ts}`);
        }
      }
    } catch (err) {
      this.onError?.(err);
    }
  }

  _notifyDOM(ts) {
    window.dispatchEvent(new CustomEvent('kds:update', { detail: { ts } }));
  }
}

let _singleton = null;
export function startKdsPolling(onUpdate, opts = {}) {
  if (_singleton) {_singleton.stop();}
  _singleton = new KdsPollClient(opts.baseUrl, opts.pollMs ?? 3000);
  _singleton.onUpdate = onUpdate;
  _singleton.start();
  return _singleton;
}
export function stopKdsPolling() { _singleton?.stop(); _singleton = null; }
export default KdsPollClient;
