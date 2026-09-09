/**
 * Correlation ID Middleware — assigns/propagates a request ID on every request.
 *
 * Accepts an inbound X-Request-ID (so upstream gateways can stitch traces),
 * otherwise mints one via newRequestId(). Stores it on the Hono context so
 * route handlers can include it in structured logs, and echoes it back as
 * both a response header and the `x-request-id` CORS-exposed header so
 * browser clients can quote it in support requests.
 */
import type { MiddlewareHandler } from 'hono';
import { newRequestId } from './logger';
import type { Env } from '../types/env';

export const REQUEST_ID_HEADER = 'X-Request-ID';

export function correlationId(): MiddlewareHandler<{ Bindings: Env }> {
  return async(c, next) => {
    const incoming = c.req.header(REQUEST_ID_HEADER);
    const requestId = incoming && incoming.length >= 8 && incoming.length <= 128
      ? incoming
      : newRequestId();
    (c as unknown as { set(_key: string, _value: string): void }).set('requestId', requestId);
    await next();
    c.res.headers.set(REQUEST_ID_HEADER, requestId);
  };
}
