/**
 * Security Headers Middleware — AURA OS
 * OWASP-compliant defensive response headers for all Cloudflare Worker routes.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import { CANONICAL_SECURITY_HEADERS } from '@aura/domain-security';

export function securityHeaders(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    await next();
    for (const [header, value] of Object.entries(CANONICAL_SECURITY_HEADERS)) {
      c.res.headers.set(header, value);
    }
  };
}
