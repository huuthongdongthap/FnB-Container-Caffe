---
title: "Phase 2: Operational Route Tests"
description: "Tests for 12 operational routes: shifts, tables, cron, reports, contact, payments, version, webhooks, zalo, erpnext, erpnext-invoices, erpnext-pos"
status: completed
priority: P2
effort: 5h
phase: 2
depends_on: [phase-01]
---

# Phase 2: Operational Route Tests

## Overview

12 routes covering staff operations, cron jobs, external integrations, and system health. These impact staff workflow and backend reliability.

## Route-to-Test Mapping

| # | Route File | Test File | Handler Type | Key Endpoints |
|---|-----------|-----------|--------------|---------------|
| 1 | `worker/src/routes/shifts.ts` | `tests/shifts.test.ts` | Hono Router | POST /clock-in, POST /clock-out, GET / |
| 2 | `worker/src/routes/tables.ts` | `tests/tables.test.ts` | Hono Router | GET /, GET /:id, PATCH /:id/status |
| 3 | `worker/src/routes/cron.ts` | `tests/cron.test.ts` | Plain functions | checkOverdueOrders, sendCashbackExpiryWarnings, processErpnextRetryQueue, processErpnextProductSync, syncMauticContacts, detectWinbackCandidates, detectBirthdayCandidates |
| 4 | `worker/src/routes/reports.ts` | `tests/reports.test.ts` | Hono Router | GET /daily, GET /summary, GET /orders |
| 5 | `worker/src/routes/contact.ts` | `tests/contact.test.ts` | Plain handler + fetch | submitContact (POST handler) |
| 6 | `worker/src/routes/payments.ts` | `tests/payments.test.ts` | Hono Router | POST /create-link, GET /status, POST /webhook |
| 7 | `worker/src/routes/version.ts` | `tests/version.test.ts` | Plain function | getVersion |
| 8 | `worker/src/routes/webhooks.ts` | `tests/webhooks.test.ts` | Hono Router | PayOS webhook handling |
| 9 | `worker/src/routes/zalo.ts` | `tests/zalo.test.ts` | Plain handler | sendZNS, handleZaloRequest |
| 10 | `worker/src/routes/erpnext.ts` | `tests/erpnext.test.ts` | Plain handler | handleErpnextRequest |
| 11 | `worker/src/routes/erpnext-invoices.ts` | `tests/erpnext-invoices.test.ts` | Plain handler | handleErpnextInvoicesRequest |
| 12 | `worker/src/routes/erpnext-pos.ts` | `tests/erpnext-pos.test.ts` | Plain handler | handleErpnextPosRequest |

## Test Matrix Per Route

### shifts.test.ts (98 lines)
```
describe('Shifts Routes', () => {
  describe('POST /clock-in', () => {
    test('clocks in staff and returns 201')
    test('returns 400 on missing staff_id')
    test('returns 400 on already clocked in today')
  })
  describe('POST /clock-out', () => {
    test('clocks out and calculates hours_worked')
    test('returns 400 on missing staff_id')
    test('returns 404 when no active shift')
  })
  describe('GET /', () => {
    test('returns shifts list')
    test('filters by date range')
    test('filters by staff_id')
  })
})
```

### tables.test.ts (78 lines)
```
describe('Tables Routes', () => {
  describe('GET /', () => {
    test('returns all tables')
    test('filters by zone')
    test('filters by status')
  })
  describe('GET /:id', () => {
    test('returns single table')
    test('returns 404 when not found')
  })
  describe('PATCH /:id/status', () => {
    test('updates table status to Occupied')  // mock requireAuth
    test('returns 400 on invalid status')
  })
})
```

### cron.test.ts (101 lines, 7 exported functions)
Each cron function is independently exported. Test each as a plain function:
```
describe('Cron Functions', () => {
  describe('checkOverdueOrders', () => {
    test('marks overdue orders')             // seed orders with status=pending + old timestamp
    test('skips when no overdue orders')
    test('updates table status to Overdue')
  })
  describe('sendCashbackExpiryWarnings', () => {
    test('sends ZNS for expiring cashback')
    test('skips when no expiring cashback')
  })
  describe('detectBirthdayCandidates', () => {
    test('detects customers with birthday today')
    test('skips when no birthdays')
  })
  // ... similar for remaining cron functions
})
```

### reports.test.ts (149 lines)
```
describe('Reports Routes', () => {
  describe('GET /daily', () => {
    test('returns daily report data for date range')
    test('uses default 30-day range when no params')
  })
  describe('GET /summary', () => {
    test('returns KPI summary')
    test('handles empty database gracefully')
  })
  describe('GET /orders', () => {
    test('returns order metrics by status')
  })
})
```

### contact.test.ts (73 lines)
Plain handler pattern — no Hono router, test `submitContact` directly:
```typescript
import { submitContact } from '../worker/src/routes/contact';

describe('submitContact', () => {
  test('creates contact message and returns 201', async () => {
    const env = { AURA_DB: createMockD1() };
    const req = new Request('https://test/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', phone: '0901234567', content: 'Help' }),
    });
    const res = await submitContact(req, env);
    expect(res.status).toBe(201);
  });

  test('returns 400 on missing required fields', async () => {
    const res = await submitContact(new Request('https://test/api/contact', {
      method: 'POST', body: JSON.stringify({}),
    }), { AURA_DB: createMockD1() });
    expect(res.status).toBe(400);
  });
});
```

### payments.test.ts (204 lines)
```
describe('Payment Routes', () => {
  describe('POST /create-link', () => {
    test('creates PayOS payment link')         // mock fetch to PayOS API, mock crypto.subtle
    test('returns 400 on missing order_id')
    test('returns 404 when order not found')
    test('returns 400 when order already paid')
  })
  describe('POST /webhook', () => {
    test('verifies PayOS signature and updates order')
    test('returns 400 on invalid signature')
  })
})
```

### version.test.ts (21 lines — simplest route)
```typescript
import { getVersion } from '../worker/src/routes/version';

describe('getVersion', () => {
  test('returns SHA from env.GIT_COMMIT_SHA', () => {
    const result = getVersion({ GIT_COMMIT_SHA: 'abc123def456', ENVIRONMENT: 'production' } as any);
    expect(result.shortSha).toBe('abc123de');
    expect(result.fullSha).toBe('abc123def456');
    expect(result.environment).toBe('production');
  });

  test('returns unknown when no SHA configured', () => {
    const result = getVersion({} as any);
    expect(result.shortSha).toBe('unknown');
  });

  test('falls back to CF_PAGES_COMMIT_SHA', () => {
    const result = getVersion({ CF_PAGES_COMMIT_SHA: 'fedcba987654' } as any);
    expect(result.fullSha).toBe('fedcba987654');
  });
});
```

### webhooks.test.ts (202 lines)
PayOS IPN webhook processing. Requires mock of crypto.subtle for HMAC-SHA256 verification (same pattern as pretix webhook tests).

### zalo.test.ts (229 lines)
```
describe('Zalo Routes', () => {
  describe('sendZNS', () => {
    test('sends ZNS message via Zalo API')     // mock fetch
    test('returns error when ZALO_ACCESS_TOKEN missing')
  })
  describe('handleZaloRequest', () => {
    test('proxies requests to Zalo API')
    test('handles sendMessage action')
  })
})
```

### erpnext*.test.ts (3 files)
ERPNext handlers proxy requests to external ERPNext API. Test each handler by mocking fetch:
```typescript
import { handleErpnextRequest } from '../worker/src/routes/erpnext';

describe('handleErpnextRequest', () => {
  test('proxies GET to ERPNext API with auth headers')
  test('proxies POST with body')
  test('returns error when ERPNext API fails')
  test('handles missing ERPNext config gracefully')
})
```

## Shared Mock Utilities

For Phase 2, a shared test helper is recommended:

```typescript
// tests/helpers/mock-d1.ts — reusable D1 mock factory
export function createMockD1(seedData: Record<string, any[]> = {}) {
  // ... same pattern as Phase 1
}

// tests/helpers/mock-env.ts — reusable env factory
export function createMockEnv(overrides: Record<string, unknown> = {}) {
  return {
    AURA_DB: createMockD1(),
    JWT_SECRET: 'test-secret',
    CRON_SECRET: 'test-cron-secret',
    TELEGRAM_BOT_TOKEN: 'test-tg-token',
    TELEGRAM_CHAT_ID: '-100test',
    PAYOS_CLIENT_ID: 'test-client-id',
    PAYOS_API_KEY: 'test-api-key',
    PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    ERPEXT_API_URL: 'https://erpnext.test',
    ERPEXT_API_KEY: 'test-erp-api-key',
    ERPEXT_API_SECRET: 'test-erp-secret',
    ...overrides,
  };
}
```

## Crypto Mock (PayOS/Zalo/ERPNext)

Routes using `crypto.subtle` for HMAC-SHA256 signatures need the same mock as pretix tests:
```typescript
delete (globalThis as any).crypto;
(globalThis as any).crypto = {
  subtle: {
    importKey: vi.fn(async () => ({ type: 'secret', algorithm: { name: 'HMAC', hash: 'SHA-256' } })),
    sign: vi.fn(async () => new Uint8Array(32).fill(97)),
  },
};
```

## Success Criteria

- [x] 12 test files created in `tests/`
- [x] Minimum 3 tests per route file
- [x] Cron functions tested individually
- [x] Crypto mock working for signature-based routes
- [x] All existing 770+ tests pass
