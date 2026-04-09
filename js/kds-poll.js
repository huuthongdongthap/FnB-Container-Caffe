/**
 * ═══════════════════════════════════════════════
 *  AURA SPACE — KDS Smart Poller
 *  Cloudflare KV flag–based realtime (Option A)
 *  Replaces Node.js WebSocket server dependency
 * ═══════════════════════════════════════════════
 *
 * Strategy:
 *   • Poll GET /api/orders/latest (KV read, ~1ms cost) every POLL_MS
 *   • If `ts` changed → fire onUpdate callback + optional full reload
 *   • No WebSocket server needed; works on Cloudflare Workers free tier
 *
 * Usage:
 *   import { KdsPollClient } from './kds-poll.js';
 *   const kds = new KdsPollClient('http://127.0.0.1:8787');
 *   kds.onUpdate = (ts) => reloadOrders();
 *   kds.start();
 *   // later: kds.stop();
 */

import { API_CONFIG } from './config.js';

export class KdsPollClient {
  /**
   * @param {string} [baseUrl]  — Worker base URL (defaults to API_CONFIG.WORKER_BASE_URL)
   * @param {number} [pollMs]   — Polling interval in ms (default 3000)
   */
  constructor(baseUrl, pollMs = 3000) {
    this.baseUrl  = baseUrl ?? API_CONFIG.WORKER_BASE_URL;
    this.pollMs   = pollMs;
    this._timer   = null;
    this._lastTs  = null;
    this._running = false;

    /** Fired when a new order or status change is detected. Receives the new KV ts string. */
    this.onUpdate = null;
    /** Fired on network error during polling. */
    this.onError  = null;
    /** Fired when polling starts / stops. */
    this.onStatusChange = null;
  }

  /** Start polling. Idempotent — safe to call multiple times. */
  start() {
    if (this._running) return;
    this._running = true;
    this._tick();
    this._timer = setInterval(() => this._tick(), this.pollMs);
    this.onStatusChange?.('started');
    console.log(`[KDS] Polling started — ${this.pollMs}ms interval`);
  }

  /** Stop polling. */
  stop() {
    if (!this._running) return;
    this._running = false;
    clearInterval(this._timer);
    this._timer = null;
    this.onStatusChange?.('stopped');
    console.log('[KDS] Polling stopped');
  }

  /** Force an immediate poll cycle (e.g. after user action). */
  async ping() {
    return this._tick();
  }

  // ── internal ──────────────────────────────────────────────────────────
  async _tick() {
    try {
      const res = await fetch(`${this.baseUrl}/api/orders/latest`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { ts } = await res.json();

      if (ts && ts !== this._lastTs) {
        const prev    = this._lastTs;
        this._lastTs  = ts;
        if (prev !== null) {
          // Real change detected — not just first load
          console.log(`[KDS] Update detected: ${ts}`);
          this.onUpdate?.(ts);
          this._notifyDOM(ts);
        } else {
          // First tick — seed _lastTs without firing callback
          console.log(`[KDS] Seeded initial ts: ${ts}`);
        }
      }
    } catch (err) {
      this.onError?.(err);
      // Silent in prod — network blips are expected
    }
  }

  /** Dispatch a CustomEvent on window for decoupled listeners. */
  _notifyDOM(ts) {
    window.dispatchEvent(new CustomEvent('kds:update', { detail: { ts } }));
  }
}

// ── Singleton helpers for simple scripts ──────────────────────────────────

let _singleton = null;

/**
 * Start the global KDS poller singleton.
 * @param {function} onUpdate  — callback(ts) when an update is detected
 * @param {object}   [opts]
 * @param {number}   [opts.pollMs=3000]
 * @param {string}   [opts.baseUrl]
 */
export function startKdsPolling(onUpdate, opts = {}) {
  if (_singleton) _singleton.stop();
  _singleton = new KdsPollClient(opts.baseUrl, opts.pollMs ?? 3000);
  _singleton.onUpdate = onUpdate;
  _singleton.start();
  return _singleton;
}

/** Stop the global KDS poller singleton. */
export function stopKdsPolling() {
  _singleton?.stop();
  _singleton = null;
}

export default KdsPollClient;
