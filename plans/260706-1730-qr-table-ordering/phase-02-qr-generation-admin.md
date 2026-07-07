# Phase 2: QR Code Generation + Admin QR Page

## Context

Phase 1 delivered the HMAC-signed QR endpoint (`GET /api/qr/:slug?ts=&sig=`). This phase adds:
1. Bulk QR code generation (auto-create slugs + QR images for all tables)
2. Admin page to view, print, and download QR codes per table/zone

## Requirements

- Admin page at `/admin/qr-codes` (owner/staff only)
- Auto-generate QR codes for all tables on first visit (idempotent)
- Display QR codes grouped by zone with table slug → deep link
- Download individual QR PNGs or bulk ZIP
- Regenerate/reprint capability
- Bilingual UI (Vietnamese + English)

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `worker/src/tree/qr/generator.ts` | CREATE | Bulk slug generation + QR PNG buffer creation helper |
| `worker/src/routes/admin-qr.ts` | CREATE | Admin endpoints: GET list, POST bulk-generate, GET single PNG |
| `worker/src/index.ts` | MODIFY | Mount `adminQRRouter` at `/api/admin/qr` |
| `worker/src/types/env.ts` | MODIFY | Add `Env` for admin-qr router (no new bindings needed) |
| `src/pages/admin/QRManagement.tsx` | CREATE | Admin QR management page |
| `worker/src/__tests__/routes/admin-qr.test.ts` | CREATE | TDD: admin QR endpoints |
| `worker/src/__tests__/tree/qr/generator.test.ts` | CREATE | TDD: bulk generation, slug uniqueness |

## Architecture Notes

- **QR generator tree module**: Uses `qrcode` library's `toBuffer()` (already in worker)
  - `generateSlug(tableNumber: number, zone: string): string` → `t01-indoor` format
  - `bulkGenerateSlugs(tables: CafeTable[]): Map<number, string>` → upsert into `table_qr_codes`
  - `generatePNG(slug: string, baseUrl: string): Promise<Buffer>` → QR payload = `${host}?table=${slug}`

- **Admin API**: Behind `requireAuth(['owner', 'staff'])`
  - `GET /api/admin/qr/tables` → list all tables with QR slug + image data URL
  - `POST /api/admin/qr/regenerate` → clear old slugs, regenerate for all tables
  - `GET /api/admin/qr/:slug/download` → direct PNG download (content-disposition)

- **Frontend (admin page)**
  - Zone tabs (indoor / outdoor / private)
  - QR card per table with print button (window.print() CSS @media print)
  - Bulk download button → zip all zone QR codes

## Tests

- Admin QR endpoints: 401 without auth, 403 for customer role, 200 with staff/owner
- Bulk generation: existing slugs preserved, new tables get slugs
- Slug uniqueness: concurrent calls don't get duplicate slugs
- QR PNG download: correct content-type, valid QR data

## Dependencies

- Phase 1 ✅ (DB schema, signer, `/api/qr/:slug` endpoint)
- `qrcode` npm package already in worker package.json

## Effort: 2h
