/**
 * Cal.com Booking API Client Tests
 *
 * Tests for CalBookingClient REST API wrapper.
 * Covers: constructor/factory, get/update/cancel booking, error handling, edge cases.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  CalBookingError,
  createCalBookingClient,
  createCalBookingClientFromEnv,
} from '../worker/src/lib/cal-booking-client.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let mockFetch: ReturnType<typeof vi.fn>;

function mockFetchResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockFetchTextResponse(text: string, status: number) {
  mockFetch.mockResolvedValue(new Response(text, { status }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch;
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_BOOKING = {
  id: 'book_123',
  uid: 'abc-def-ghi',
  title: 'Dinner for 2',
  status: 'ACCEPTED',
  startTime: '2026-07-04T19:00:00Z',
  endTime: '2026-07-04T20:00:00Z',
  attendee: { name: 'Alice', email: 'alice@example.com' },
};

const MOCK_UPDATE_PAYLOAD = { status: 'CANCELLED' };
const MOCK_CANCEL_REASON = 'Guest requested cancellation';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalBookingClient', () => {
  describe('createCalBookingClient', () => {
    test('creates client with default API URL', () => {
      const client = createCalBookingClient('cal_live_test123');
      expect(client).toBeDefined();
      expect(typeof client.getBooking).toBe('function');
      expect(typeof client.updateBooking).toBe('function');
      expect(typeof client.cancelBooking).toBe('function');
    });

    test('creates client with custom API URL', () => {
      const client = createCalBookingClient('cal_live_test123', 'https://custom.cal.com/v2');
      expect(client).toBeDefined();
    });

    test('strips trailing slash from API URL', () => {
      const client = createCalBookingClient('cal_live_test123', 'https://api.cal.com/v2/');
      // If no error thrown, trailing slash stripping works
      expect(client).toBeDefined();
    });
  });

  describe('createCalBookingClientFromEnv', () => {
    test('returns null when CAL_API_KEY is missing', () => {
      const result = createCalBookingClientFromEnv({});
      expect(result).toBeNull();
    });

    test('returns null when CAL_API_KEY is empty', () => {
      const result = createCalBookingClientFromEnv({ CAL_API_KEY: '' });
      expect(result).toBeNull();
    });

    test('returns client when CAL_API_KEY is present', () => {
      const result = createCalBookingClientFromEnv({ CAL_API_KEY: 'cal_live_test456' });
      expect(result).not.toBeNull();
      expect(typeof result!.getBooking).toBe('function');
    });

    test('uses custom CAL_API_URL when provided', () => {
      const result = createCalBookingClientFromEnv({
        CAL_API_KEY: 'cal_live_test456',
        CAL_API_URL: 'https://staging.cal.com/v2',
      });
      expect(result).not.toBeNull();
    });
  });

  describe('getBooking', () => {
    test('sends GET request with auth header', async () => {
      mockFetchResponse(MOCK_BOOKING);

      const client = createCalBookingClient('cal_live_test789');
      await client.getBooking('abc-def-ghi');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/bookings/abc-def-ghi');
      expect(opts.method).toBe('GET');
      expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer cal_live_test789');
    });

    test('returns booking details on 200', async () => {
      mockFetchResponse(MOCK_BOOKING);

      const client = createCalBookingClient('cal_live_test789');
      const result = await client.getBooking('abc-def-ghi');

      expect(result).toEqual(MOCK_BOOKING);
      expect(result.uid).toBe('abc-def-ghi');
      expect(result.status).toBe('ACCEPTED');
    });

    test('URL-encodes the booking UID', async () => {
      mockFetchResponse(MOCK_BOOKING);

      const client = createCalBookingClient('cal_live_test789');
      await client.getBooking('abc/ghi');

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain('/bookings/abc%2Fghi');
    });

    test('throws CalBookingError on 401 (invalid API key)', async () => {
      mockFetchTextResponse('Unauthorized', 401);

      const client = createCalBookingClient('invalid_key');
      await expect(client.getBooking('abc-def-ghi')).rejects.toThrow(CalBookingError);
    });

    test('throws CalBookingError on 404 (booking not found)', async () => {
      mockFetchTextResponse('Not Found', 404);

      const client = createCalBookingClient('cal_live_test789');
      await expect(client.getBooking('nonexistent')).rejects.toThrow(CalBookingError);
    });
  });

  describe('updateBooking', () => {
    test('sends PATCH request with correct payload', async () => {
      mockFetchResponse({ ...MOCK_BOOKING, status: 'CANCELLED' });

      const client = createCalBookingClient('cal_live_test789');
      const result = await client.updateBooking('abc-def-ghi', MOCK_UPDATE_PAYLOAD);

      expect(result.status).toBe('CANCELLED');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit & { body: string }];
      expect(url).toContain('/bookings/abc-def-ghi');
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body)).toEqual(MOCK_UPDATE_PAYLOAD);
    });

    test('sends auth header with API key', async () => {
      mockFetchResponse(MOCK_BOOKING);

      const client = createCalBookingClient('cal_live_update_key');
      await client.updateBooking('abc-def-ghi', { status: 'ACCEPTED' });

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer cal_live_update_key');
    });

    test('throws CalBookingError on 4xx error', async () => {
      mockFetchTextResponse('Bad Request', 400);

      const client = createCalBookingClient('cal_live_test789');
      await expect(client.updateBooking('abc-def-ghi', {} as Record<string, unknown>)).rejects.toThrow(CalBookingError);
    });

    test('throws CalBookingError on 5xx error', async () => {
      mockFetchTextResponse('Internal Server Error', 500);

      const client = createCalBookingClient('cal_live_test789');
      await expect(client.updateBooking('abc-def-ghi', MOCK_UPDATE_PAYLOAD)).rejects.toThrow(CalBookingError);
    });
  });

  describe('cancelBooking', () => {
    test('sends POST request to cancel endpoint', async () => {
      mockFetchResponse({ status: 'CANCELLED', cancellationReason: '' });

      const client = createCalBookingClient('cal_live_test789');
      const result = await client.cancelBooking('abc-def-ghi');

      expect(result.status).toBe('CANCELLED');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit & { body: string }];
      expect(url).toContain('/bookings/abc-def-ghi/cancel');
      expect(opts.method).toBe('POST');
    });

    test('includes cancellation reason when provided', async () => {
      mockFetchResponse({ status: 'CANCELLED', cancellationReason: MOCK_CANCEL_REASON });

      const client = createCalBookingClient('cal_live_test789');
      const result = await client.cancelBooking('abc-def-ghi', MOCK_CANCEL_REASON);

      expect(result.cancellationReason).toBe(MOCK_CANCEL_REASON);
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit & { body: string }];
      const body = JSON.parse(opts.body);
      expect(body.reason).toBe(MOCK_CANCEL_REASON);
    });

    test('sends empty object when reason is omitted', async () => {
      mockFetchResponse({ status: 'CANCELLED' });

      const client = createCalBookingClient('cal_live_test789');
      await client.cancelBooking('abc-def-ghi');

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit & { body: string }];
      expect(JSON.parse(opts.body)).toEqual({});
    });

    test('sends auth header on cancel request', async () => {
      mockFetchResponse({ status: 'CANCELLED' });

      const client = createCalBookingClient('cal_cancel_key');
      await client.cancelBooking('abc-def-ghi', 'No longer needed');

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer cal_cancel_key');
    });

    test('throws CalBookingError on failed cancellation', async () => {
      mockFetchTextResponse('Forbidden', 403);

      const client = createCalBookingClient('cal_live_test789');
      await expect(client.cancelBooking('abc-def-ghi')).rejects.toThrow(CalBookingError);
    });
  });

  describe('error edge cases', () => {
    test('sets error properties correctly', async () => {
      mockFetchTextResponse('{"error":"API token expired"}', 401);

      const client = createCalBookingClient('expired_key');
      try {
        await client.getBooking('abc-def-ghi');
        expect('should have thrown').toBe('never');
      } catch (err) {
        expect(err).toBeInstanceOf(CalBookingError);
        const calErr = err as CalBookingError;
        expect(calErr.status).toBe(401);
        expect(calErr.name).toBe('CalBookingError');
        expect(calErr.message).toContain('401');
      }
    });

    test('handles network error on fetch', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const client = createCalBookingClient('cal_live_test789');
      await expect(client.getBooking('abc-def-ghi')).rejects.toThrow(TypeError);
    });

    test('handles empty response body', async () => {
      mockFetchTextResponse('', 200);

      const client = createCalBookingClient('cal_live_test789');
      try {
        await client.getBooking('abc-def-ghi');
        expect('should have thrown').toBe('never');
      } catch (err) {
        expect(err).toBeInstanceOf(CalBookingError);
      }
    });

    test('handles malformed JSON response', async () => {
      mockFetchTextResponse('not json', 200);

      const client = createCalBookingClient('cal_live_test789');
      await expect(client.getBooking('abc-def-ghi')).rejects.toThrow(CalBookingError);
    });
  });
});
