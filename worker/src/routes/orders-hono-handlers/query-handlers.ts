import type { Hono } from 'hono';
import type { Env } from '../../types/env';

/**
 * Order reads are served exclusively by `openApiOrdersRouter`
 * (`worker/src/routes/openapi-orders-handlers`), which scopes every query through
 * `resolveCustomerScope()` and projects guest payloads through the allowlist DTO.
 *
 * The previously registered handlers here were unauthenticated row dumps:
 *   - GET /            SELECT * FROM orders            → full-table read, no scope
 *   - GET /my-orders   keyed by customer phone         → any known phone = full history
 *   - GET /:id         SELECT * FROM orders WHERE id=? → IDOR: any UUID = any order
 * They are retired. Do not re-register them; extend the OpenAPI router instead.
 */
export function registerQueryHandlers(_app: Hono<{ Bindings: Env }>) {
  // Intentionally empty — see doc comment above.
}