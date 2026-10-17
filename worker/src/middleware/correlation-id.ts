/**
 * Correlation ID & Trace Propagation Middleware
 * Integrates W3C traceparent, X-Request-ID, and X-Correlation-ID standards.
 */

import type { MiddlewareHandler } from 'hono';
import { generateTraceContext, parseTraceparent, formatTraceparent } from '@aura/domain-observability';
import type { Env } from '../types/env';

export const REQUEST_ID_HEADER = 'X-Request-ID';
export const CORRELATION_ID_HEADER = 'X-Correlation-ID';
export const TRACEPARENT_HEADER = 'traceparent';

export function correlationId(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const incomingReqId = c.req.header(REQUEST_ID_HEADER);
    const isValidReqId = !!(incomingReqId && incomingReqId.length >= 8 && incomingReqId.length <= 128);
    const requestId = isValidReqId ? incomingReqId : `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const incomingCorrId = c.req.header(CORRELATION_ID_HEADER);
    const incomingTraceparent = c.req.header(TRACEPARENT_HEADER);

    const parsedW3c = parseTraceparent(incomingTraceparent);
    const trace = generateTraceContext({
      traceId: parsedW3c?.traceId,
      parentId: parsedW3c?.spanId,
      correlationId: incomingCorrId || requestId,
      sampled: parsedW3c?.sampled
    });

    const ctx = c as unknown as { set(_key: string, _value: unknown): void };
    ctx.set('requestId', requestId);
    ctx.set('correlationId', trace.correlationId);
    ctx.set('traceContext', trace);

    await next();

    c.res.headers.set(REQUEST_ID_HEADER, requestId);
    c.res.headers.set(CORRELATION_ID_HEADER, trace.correlationId);
    c.res.headers.set(TRACEPARENT_HEADER, formatTraceparent(trace));
  };
}

export const correlationIdMiddleware = correlationId;
