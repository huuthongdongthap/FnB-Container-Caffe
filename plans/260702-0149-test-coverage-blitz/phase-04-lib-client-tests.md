---
title: "Phase 4: Lib Client Tests"
description: "Tests for 1 untested lib client: cal-booking-client"
status: completed
priority: P2
effort: 1.5h
phase: 4
depends_on: []
---

# Phase 4: Lib Client Tests

## Current Lib Coverage

| Lib File | Tested In | Status |
|----------|-----------|--------|
| `erpnext-client.ts` | `tests/erpnext-client.test.ts` | Covered |
| `mautic-client.ts` | `tests/mautic-client.test.ts` | Covered |
| `resend-client.ts` | `tests/resend-client.test.ts` | Covered |
| `speedsms-client.ts` | `tests/speedsms-client.test.ts` | Covered |
| `mixpost-client.ts` | `tests/mixpost-bridge.test.ts` | Covered (inline) |
| `pretix-client.ts` | `tests/pretix-bridge.test.ts` | Covered (inline) |
| `parser.ts` | `tests/parser.test.ts` | Covered |
| `email.ts` | `tests/email.test.ts` | Covered |
| `campaign-templates.ts` | `tests/campaign-triggers.test.ts` | Covered |
| **`cal-booking-client.ts`** | **None** | **UNCOVERED** |

Only `cal-booking-client.ts` lacks dedicated tests.

## cal-booking-client.test.ts

### What it does
The cal-booking client handles Cal.com API interactions for booking management. The `cal-booking-webhook.ts` route already has tests for webhook handling; the client tests should focus on API client behavior.

### Test matrix

```
describe('CalBookingClient', () => {
  describe('constructor', () => {
    test('stores API key and base URL')
  })
  describe('getBooking', () => {
    test('fetches booking by UID with auth header')
    test('returns booking details on 200')
    test('throws on 401 (invalid API key)')
    test('throws on 404 (booking not found)')
  })
  describe('updateBooking', () => {
    test('PATCHes booking status with auth header')
    test('sends correct payload')
    test('throws on 4xx errors')
    test('throws on 5xx errors')
  })
  describe('cancelBooking', () => {
    test('sends cancellation request to Cal.com API')
    test('handles cancellation reason field')
  })
})
```

### Mock pattern (same as mixpost/pretix)

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch;
});

function mockFetchResponse(data: any, status = 200) {
  mockFetch.mockResolvedValue(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  }));
}

function mockFetchError(status: number, body: string) {
  mockFetch.mockResolvedValue(new Response(body, { status }));
}

describe('CalBookingClient', () => {
  test('getBooking sends GET with Cal.com API key', async () => {
    const calResponse = { id: 'book_123', uid: 'abc-def-ghi', status: 'ACCEPTED', title: 'Table 5' };
    mockFetchResponse(calResponse);

    const { createCalBookingClient } = await import('../worker/src/lib/cal-booking-client.ts');
    const client = createCalBookingClient('cal_live_test123');

    const result = await client.getBooking('abc-def-ghi');
    expect(result).toEqual(calResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v2/bookings/abc-def-ghi');
  });

  test('getBooking throws on invalid API key', async () => {
    mockFetchError(401, 'Unauthorized');
    const { createCalBookingClient } = await import('../worker/src/lib/cal-booking-client.ts');
    const client = createCalBookingClient('invalid_key');
    await expect(client.getBooking('abc')).rejects.toThrow();
  }, 10000);
});
```

### Verification

Before writing tests, read `worker/src/lib/cal-booking-client.ts` to identify:
1. Exact function signatures and export names
2. API endpoint formats expected
3. Error class names
4. Any retry logic

## Success Criteria

- [x] 1 test file created: `tests/cal-booking-client.test.ts`
- [x] Minimum 10 tests covering all exported functions
- [x] All existing 770+ tests pass
