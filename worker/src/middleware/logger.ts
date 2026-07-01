/**
 * Structured Logger — JSON line output for Cloudflare Workers
 * Converted from utils/logger.js.
 *
 * Usage:
 *   import { createLogger } from '../middleware/logger';
 *   const log = createLogger({ request_id, route: 'payment.create' });
 *   log.info('order_fetched', { order_id, amount });
 *   log.error('payos_failed', { status: 500 });
 */

export interface LoggerContext {
  request_id?: string;
  route?: string;
  user_id?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug: (msg: string, extra?: Record<string, unknown>) => void;
  info: (msg: string, extra?: Record<string, unknown>) => void;
  warn: (msg: string, extra?: Record<string, unknown>) => void;
  error: (msg: string, extra?: Record<string, unknown>) => void;
  child: (extra: LoggerContext) => Logger;
}

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function emit(level: string, base: LoggerContext, msg: string, extra?: Record<string, unknown>): void {
  const record = {
    level,
    ts: nowIso(),
    ...base,
    msg,
    ...(extra && typeof extra === 'object' ? extra : {}),
  };
  const line = JSON.stringify(record);
  if (level === 'error') { console.error(line); }
  else if (level === 'warn') { console.warn(line); }
  else { console.log(line); }
}

export function createLogger(context: LoggerContext = {}): Logger {
  const base = { ...context };
  const api: Logger = {
    child(extra: LoggerContext) { return createLogger({ ...base, ...extra }); },
    debug: (msg, extra) => emit('debug', base, msg, extra),
    info: (msg, extra) => emit('info', base, msg, extra),
    warn: (msg, extra) => emit('warn', base, msg, extra),
    error: (msg, extra) => emit('error', base, msg, extra),
  };
  return api;
}

export function newRequestId(): string {
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
