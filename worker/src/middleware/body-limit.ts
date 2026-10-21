/**
 * Request body size limits.
 *
 * A Worker burns CPU parsing JSON before any handler sees the payload, so an
 * unbounded body is a cheap way to exhaust the isolate. These ceilings are set
 * per route family rather than globally: order payloads legitimately carry a
 * large cart, while auth payloads are a phone number or a short code and have no
 * reason to be bigger than a couple of KB.
 */

import { bodyLimit } from 'hono/body-limit';
import type { MiddlewareHandler } from 'hono';

/** Orders carry a cart — generous, but still far below anything a client should send. */
export const ORDER_BODY_LIMIT = 1024 * 1024;

/** Auth payloads are a phone number, an OTP, or a password. */
export const AUTH_BODY_LIMIT = 10 * 1024;

/** A single payout/charge-back callback from a payment gateway. */
export const PAYMENT_BODY_LIMIT = 256 * 1024;

function limit(maxSize: number): MiddlewareHandler {
  return bodyLimit({
    maxSize,
    onError: (c) => c.json({
      ok: false,
      error: 'Request body too large',
      limit: maxSize,
    }, 413),
  }) as unknown as MiddlewareHandler;
}

export const orderBodyLimit = () => limit(ORDER_BODY_LIMIT);
export const authBodyLimit = () => limit(AUTH_BODY_LIMIT);
export const paymentBodyLimit = () => limit(PAYMENT_BODY_LIMIT);
