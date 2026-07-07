# QR Table Ordering — TDD Implementation Plan

**Created:** 2026-07-06 | **Status:** pending | **Effort:** ~20h

## Overview

5-phase TDD implementation of QR code per-table ordering. Customers scan QR → order from phone (no auth) → kitchen sees table → staff marks ready.

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | DB schema + backend endpoints | 4h | pending |
| 2 | QR generation + serving | 2h | pending |
| 3 | Guest ordering frontend | 5h | pending |
| 4 | Admin QR generator page | 3h | pending |
| 5 | Staff table management + E2E | 6h | pending |

## Touchpoints

- `worker/db/migrations/` — new migration for `table_qr_codes` table (orders already has `table_id`)
- `worker/src/routes/tables.ts` — EXTEND existing (add QR endpoint, HMAC validation)
- `worker/src/tree/qr/signer.ts` — NEW HMAC signing/verification utility
- `worker/src/index.ts` — register new `/api/qr` sub-route
- `src/pages/TableOrder.tsx` — NEW (guest ordering page)
- `src/pages/admin/GenerateQR.tsx` — EXTEND (add HMAC-signed URLs, server-side QR)
- `worker/src/__tests__/routes/tables.test.ts` — NEW (test tables + QR endpoints)
- `worker/src/__tests__/routes/guest-order.test.ts` — NEW (test guest order flow)
- `worker/src/lib/validators.ts` — add guest order + QR seed validators

## Key Decisions

- **Security:** HMAC-SHA256 signature on QR URL (slug + timestamp → sig)
- **HMAC secret:** `QR_SIGNING_SECRET` env var in Worker bindings
- **QR lib:** `qrcode` npm package (already in `package.json`)
- **Session:** stateless via signed URL, 5 min expiry window
- **Path pattern:** `/api/qr/:slug?ts=<unix_ts>&sig=<hex>`
- **Table status enum:** `Available | Occupied | Reserved | Overdue` (existing — no paid state needed)
- **Order already supports `table_id`:** present in `OrderInput` interface, need Zod validator + DB insertion
- **Layer placement:** QR signer = `tree/qr/` (domain utility); tables route = `land/routes/` (existing convention)
