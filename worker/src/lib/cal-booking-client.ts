/**
 * Cal.com Booking API Client — HTTP API wrapper for Cal.com v2 bookings
 *
 * Handles GET/PATCH booking, cancel booking with Cal.com API key auth.
 * Follows same patterns as pretix-client.ts for factory-style client creation.
 *
 * Usage:
 *   import { createCalBookingClient } from '../lib/cal-booking-client';
 *   const client = createCalBookingClient('cal_live_xxx');
 *   const booking = await client.getBooking('abc-def-ghi');
 *   await client.cancelBooking('abc-def-ghi', 'Table no longer available');
 */

// ---------------------------------------------------------------------------
// Error Classes
// ---------------------------------------------------------------------------

export class CalBookingError extends Error {
  status: number;
  body: string;
  endpoint: string;

  constructor(status: number, body: string, endpoint: string) {
    super(`Cal.com API error: ${status} on ${endpoint}`);
    this.name = 'CalBookingError';
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalBookingClient {
  getBooking(uid: string): Promise<Record<string, unknown>>;
  updateBooking(uid: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
  cancelBooking(uid: string, reason?: string): Promise<Record<string, unknown>>;
}

export interface CalBookingEnv {
  CAL_API_KEY?: string;
  CAL_API_URL?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_API_URL = 'https://api.cal.com/v2';

// ---------------------------------------------------------------------------
// Client Factory
// ---------------------------------------------------------------------------

async function request(
  apiKey: string,
  baseUrl: string,
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `${baseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const opts: RequestInit & { headers: Record<string, string> } = {
    method,
    headers,
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);

  if (res.status === 401) {
    const text = await res.text();
    throw new CalBookingError(401, text, endpoint);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new CalBookingError(res.status, text, endpoint);
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new CalBookingError(res.status, text, endpoint);
  }
}

export function createCalBookingClient(
  apiKey: string,
  apiUrl?: string,
): CalBookingClient {
  const baseUrl = (apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');

  return {
    async getBooking(uid: string): Promise<Record<string, unknown>> {
      return request(apiKey, baseUrl, 'GET', `/bookings/${encodeURIComponent(uid)}`);
    },

    async updateBooking(
      uid: string,
      data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
      return request(apiKey, baseUrl, 'PATCH', `/bookings/${encodeURIComponent(uid)}`, data);
    },

    async cancelBooking(
      uid: string,
      reason?: string,
    ): Promise<Record<string, unknown>> {
      const payload = reason !== undefined ? { reason } : {};
      return request(apiKey, baseUrl, 'POST', `/bookings/${encodeURIComponent(uid)}/cancel`, payload);
    },
  };
}

/**
 * createCalBookingClientFromEnv — factory using env vars
 * Returns null when CAL_API_KEY is missing.
 */
export function createCalBookingClientFromEnv(env: CalBookingEnv): CalBookingClient | null {
  if (!env.CAL_API_KEY) {
    return null;
  }
  return createCalBookingClient(env.CAL_API_KEY, env.CAL_API_URL);
}
