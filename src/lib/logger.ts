/* ── Structured Logger ──────────────────────────── */

type LogContext = Record<string, unknown>;

function isProduction(): boolean {
  return import.meta.env.PROD === true;
}

function formatMessage(level: string, msg: string, ctx?: LogContext): string {
  const ts = new Date().toISOString();
  if (ctx && Object.keys(ctx).length > 0) {
    return `[${ts}] [${level}] ${msg} ${JSON.stringify(ctx)}`;
  }
  return `[${ts}] [${level}] ${msg}`;
}

export const logger = {
  info(msg: string, ctx?: LogContext): void {
    console.info(formatMessage('INFO', msg, ctx));
  },

  warn(msg: string, ctx?: LogContext): void {
    console.warn(formatMessage('WARN', msg, ctx));
  },

  error(msg: string, ctx?: LogContext): void {
    console.error(formatMessage('ERROR', msg, ctx));
  },

  debug(msg: string, ctx?: LogContext): void {
    if (isProduction()) return;
    console.debug(formatMessage('DEBUG', msg, ctx));
  },
};
