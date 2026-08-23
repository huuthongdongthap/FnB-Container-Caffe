/**
 * API versioning middleware.
 *
 * Serves routes under both `/api/v1/...` and the legacy `/api/...` paths so
 * existing clients keep working while consumers migrate to the versioned
 * contract. The canonical path is `/api/v1/`; legacy paths log a deprecation
 * notice so the migration can be tracked in the request metrics.
 */

import type { MiddlewareHandler } from 'hono';
import { createLogger } from './logger';

const log = createLogger({ route: 'api-version' });

export const API_VERSION = '1';
export const VERSION_PREFIX = `/api/v${API_VERSION}`;

/**
 * Mount a Hono sub-router under both the versioned and legacy prefixes.
 * Legacy requests are forwarded unchanged so behaviour is identical.
 */
export function mountVersioned(app: { route: (prefix: string, router: unknown) => void }, router: unknown): void {
  app.route(VERSION_PREFIX, router as never);
  app.route('/api', router as never);
}

export const apiVersionMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  // Flag legacy (unversioned) responses so dashboards can measure migration progress.
  if (!c.req.path.startsWith(VERSION_PREFIX) && c.req.path.startsWith('/api/')) {
    c.header('X-API-Deprecation', 'legacy');
    log.warn('Legacy API path used', { path: c.req.path });
  }
};
