/**
 * Global Error Boundary Middleware
 * Canonical classification: business outcome, application error, infrastructure failure.
 * Redacts secrets, extracts correlation IDs, and returns consistent error JSON.
 */

import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { classifyError } from '@aura/domain-observability';
import type { Env } from '../types/env';
import { createLogger } from './logger';

const log = createLogger({ route: 'error-handler' });

export class AppError extends Error {
  statusCode: number;
  detail?: string;
  category?: 'business' | 'application' | 'infrastructure';

  constructor(message: string, statusCode = 400, detail?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export const errorHandler: ErrorHandler<{ Bindings: Env }> = (err, c) => {
  const correlationId = (c as unknown as { get?: (_k: string) => string }).get?.('correlationId') || 'unknown';
  const path = c.req.path;

  // 1. Zod Schema Validation (Business / Client Input Violation)
  if (err instanceof ZodError) {
    const issues = 'issues' in err ? (err as { issues: Array<{ path: (string | number)[]; message: string }> }).issues : [];
    log.warn('validation_error', {
      category: 'business',
      correlationId,
      path,
      errors: issues.map(e => ({ path: e.path.join('.'), message: e.message }))
    });

    return c.json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_FAILED',
      correlationId,
      detail: 'Dữ liệu không hợp lệ',
      fields: issues.map(e => ({ field: e.path.join('.'), message: e.message }))
    }, 400 as ContentfulStatusCode);
  }

  // 2. Explicit Domain/Application AppError
  if (err instanceof AppError) {
    const classified = classifyError(err, err.statusCode);
    log.warn('application_error', {
      category: classified.category,
      correlationId,
      statusCode: err.statusCode,
      message: err.message,
      path
    });

    return c.json({
      success: false,
      error: err.message,
      code: classified.code,
      correlationId,
      detail: err.detail || err.message
    }, err.statusCode as ContentfulStatusCode);
  }

  // 3. Unhandled Exceptions / Infrastructure Failures
  const classified = classifyError(err, 500);
  const errMsg = err instanceof Error ? err.message : String(err);

  log.error('unhandled_error', {
    category: classified.category,
    code: classified.code,
    correlationId,
    message: errMsg,
    path,
    stack: err instanceof Error ? err.stack : undefined
  });

  return c.json({
    success: false,
    error: classified.category === 'infrastructure' ? 'Internal server error' : errMsg,
    code: classified.code,
    correlationId,
    detail: 'Đã xảy ra lỗi, vui lòng thử lại hoặc liên hệ hỗ trợ với mã tra cứu trên'
  }, classified.statusCode as ContentfulStatusCode);
};
