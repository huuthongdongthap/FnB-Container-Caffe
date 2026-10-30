 
/**
 * Structured Logger — JSON line output for Cloudflare Workers
 *
 * Ngay cả `console.log('foo')` trong Workers cũng bị cắt trong Log Tail nếu không có cấu trúc.
 * Logger này xuất JSON 1-dòng để dễ grep, filter, và đẩy sang log aggregator sau này.
 *
 * Usage:
 *   import { createLogger } from '../utils/logger.js';
 *   const log = createLogger({ request_id, route: 'payment.create' });
 *   log.info('order_fetched', { order_id, amount });
 *   log.error('payos_failed', { status: 500, err: e.message });
 *
 * Output line:
 *   {"level":"info","ts":"2026-04-19T...","request_id":"...","route":"payment.create","msg":"order_fetched","order_id":"ORD_123","amount":45000}
 */

const LEVELS = ['debug', 'info', 'warn', 'error'];
const REDACTED_KEYS = /^(signature|checksum|token|secret|password|authorization|api_key|apikey|payment_payload|customer_phone|customer_email|phone|email|to|recipient)$/i;
const REDACTED = '[REDACTED]';

export function redact(value, depth = 0) {
  if (depth > 4) {
    return '[DEPTH_LIMIT]';
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => redact(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACTED_KEYS.test(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && /^0\d{9}$/.test(value)) {
    return REDACTED;
  }
  return value;
}

function nowIso() {
  return new Date().toISOString();
}

function emit(level, base, msg, extra) {
  const record = {
    level,
    ts: nowIso(),
    ...redact(base),
    msg: typeof msg === 'string' && /^0\d{9}$/.test(msg) ? REDACTED : msg,
    ...(extra && typeof extra === 'object' ? redact(extra) : {}),
  };
  // Keep error objects short — Workers logs truncate at ~4KB
  const line = JSON.stringify(record);
  if (level === 'error') {console.error(line);}
  else if (level === 'warn') {console.warn(line);}
  else {console.log(line);}
}

/**
 * @param {object} context - persistent fields: {request_id, route, user_id, ...}
 * @returns {{debug:Function, info:Function, warn:Function, error:Function, child:Function}}
 */
export function createLogger(context = {}) {
  const base = { ...context };
  const api = {
    child(extra) { return createLogger({ ...base, ...extra }); },
  };
  for (const lvl of LEVELS) {
    api[lvl] = (msg, extra) => emit(lvl, base, String(msg || ''), extra);
  }
  return api;
}

/**
 * Generate a short request_id (for correlation).
 */
export function newRequestId() {
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
