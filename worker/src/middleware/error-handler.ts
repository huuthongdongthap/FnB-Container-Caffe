/**
 * Global error boundary middleware
 * Converts errors to structured JSON responses.
 */

import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../types/env';
import { createLogger } from './logger';
import { ZodError } from 'zod';

const log = createLogger({ route: 'error-handler' });

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public detail?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler: ErrorHandler<{ Bindings: Env }> = (err, c) => {
  if (err instanceof ZodError) {
    const issues = 'issues' in err ? (err as { issues: Array<{ path: (string | number)[]; message: string }> }).issues : [];
    log.warn('Validation error', {
      path: c.req.path,
      errors: issues.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
    return c.json({
      success: false,
      error: 'Validation failed',
      detail: 'Dữ liệu không hợp lệ',
      fields: issues.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    }, 400 as ContentfulStatusCode);
  }

  if (err instanceof AppError) {
    log.warn('App error', { statusCode: err.statusCode, message: err.message, path: c.req.path });
    return c.json({
      success: false,
      error: err.message,
      detail: err.detail || err.message
    }, err.statusCode as ContentfulStatusCode);
  }

// TEMP: expose real error in test assertions
const errMsg = err instanceof Error ? err.message : String(err);
log.error('Unhandled error', {
  message: errMsg,
  path: c.req.path,
  stack: err instanceof Error ? err.stack : undefined,
});
return c.json({
  success: false,
  error: 'Internal server error',
  detail: errMsg,
}, 500 as ContentfulStatusCode);
};
