# Phase 1: DB Schema + Backend Endpoints

## Requirements

- D1 migration: create `table_qr_codes` table + (orders already has `table_id`, just needs Zod validator)
- `GET /api/tables` — public read (no auth), returns tables with status + qr_code_url
- `GET /api/qr/:slug` — serve QR image PNG, validates HMAC signature
- HMAC signing utility for QR URL generation

## Files to Create

1. `worker/db/migrations/<next-ts>_qr_table_ordering.sql`
2. `worker/src/tree/qr/signer.ts` — HMAC signing/verification
3. `worker/src/__tests__/routes/tables.test.ts`

## Files to Modify

1. `worker/src/routes/tables.ts` — QR endpoints, augment GET / to include qr_code_url
2. `worker/src/lib/validators.ts` — add guest order input schema with table_id
3. `worker/src/index.ts` — register `/api/qr` sub-route under tablesRouter
4. `worker/src/types/env.ts` — add `QR_SIGNING_SECRET` to Env bindings

## SQL Migration

```sql
-- table_qr_codes: maps each table to a short slug for QR URLs
CREATE TABLE IF NOT EXISTS table_qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL UNIQUE REFERENCES cafe_tables(id),
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for slug lookups (primary query path)
CREATE INDEX IF NOT EXISTS idx_table_qr_codes_slug ON table_qr_codes(slug);
```

Notes:
- `orders` already has `table_id` column from prior schema. No ALTER needed.
- Slug generation: use slugify of table name (e.g. `b01`, `b02`, `tbt01`) — generated server-side on first QR request.

## Security Model

QR URL pattern: `/api/qr/:slug?ts=<unix_ts>&sig=<hmac_hex>`

Server verifies:
1. `ts` within 5-minute window of current time
2. `sig === HMAC-SHA256(ts | '|' | slug, QR_SIGNING_SECRET)` (pipe separator avoids ambiguity)
3. Slug exists in `table_qr_codes`

No session/cookie needed for guest ordering. Staff endpoints use existing `requireAuth` middleware.

## API Contract

### GET /api/tables (existing, enhanced)

Response already returns `CafeTable[]`. Add `qr_code_url` field computed server-side:

```
{
  "success": true,
  "data": [
    {
      "id": "...",
      "table_number": 1,
      "zone": "Indoor",
      "status": "Available",
      "qr_code_url": "https://<domain>/api/qr/b01?ts=1234567890&sig=abc123..."
    }
  ]
}
```

### GET /api/qr/:slug?ts=&sig=

- Valid HMAC → 200 with `image/png` (QR code generated with `qrcode` package)
- Expired ts / invalid sig → 401 JSON error
- Unknown slug → 404 JSON error

### PATCH /api/tables/:id/status (existing, extended)

Existing enum: `Available | Occupied | Reserved | Overdue`. No `paid` state needed — these are table statuses, not order statuses.

## HMAC Signer (`worker/src/tree/qr/signer.ts`)

```typescript
// Functions:
// signQRUrl(slug: string, secret: string, ttlSeconds = 300): string
//   → returns `/api/qr/${slug}?ts=${ts}&sig=${sig}`
// verifyQRSignature(slug: string, ts: number, sig: string, secret: string): boolean
```

## Tests (TDD First!) — Write BEFORE implementation

Wire: `worker/src/__tests__/routes/tables.test.ts`

1. **GET /api/tables returns array** with `status` and `qr_code_url` fields for each table
2. **GET /api/tables empty DB** returns `{ success: true, data: [] }`
3. **PATCH /api/tables/:id/status** with valid staff token transitions status (free → occupied)
4. **PATCH /api/tables/:id/status rejects non-staff** returns 401
5. **GET /api/qr/:slug with valid HMAC** returns 200 with PNG content-type
6. **GET /api/qr/:slug with expired ts** (>5 min old) returns 401
7. **GET /api/qr/:slug with invalid sig** returns 401
8. **HMAC signer roundtrip** — sign → verify succeeds; tampered sig fails

Test utility: use existing `createMockEnv` / `createMockDB` from `worker/src/__tests__/test-utils.ts`. Mock `c.env.AURA_DB` with stubbed `.prepare()`, `.bind()`, `.first()`, `.all()`.

## Implementation Steps

1. Write 8 tests (red → fail)
2. Create D1 migration, apply locally (`wrangler d1 migrations apply`)
3. Create HMAC signer utility
4. Enhance `tables.ts` with QR routes
5. Add `QR_SIGNING_SECRET` to Env type
6. Register `/api/qr` route in `index.ts`
7. Add `guestOrderSchema` to validators
8. Run tests → all 8 PASS
9. Run `npm run type-check` → 0 errors

## Rules

- Follow existing pattern: routes in `worker/src/routes/tables.ts` (thin handler); domain logic in `worker/src/tree/qr/signer.ts`
- Types: Zod validation on all inputs, `Env` interface extension
- Tests: Vitest with existing `createMockEnv` / `createMockDB` helpers
- DB: use `c.env.AURA_DB`.prepare() chain, do NOT await the client
- Imports: use `.js` extensions for internal imports in `worker/src/`
- NO `console.log`, NO `:any` types
- `status` enum stays exactly: `Available | Occupied | Reserved | Overdue`
