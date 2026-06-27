# Ship Journal: Odoo Phase 2+3 — POS & CRM

**Date:** 2026-06-27
**Branch:** feature/phase-04-completion-20260625
**Commits:** 48f3abc (Phase 2), d139adb (Phase 3)
**Version:** 2.1.1

## Context

Continuing Odoo integration after Phase 1 (E-Invoicing) shipped. Phase 2 adds POS sales order sync + product availability. Phase 3 adds CRM lead creation + loyalty tag sync.

## What Happened

- Phase 2: Implemented OdooProductClient with KV caching, odoo-sales-mapper, odoo-pos.js routes
- Phase 3: Implemented OdooCrmClient with lead/partner/tag operations, extended odoo.js routes
- Route file overwrite incident: Phase 2 agent overwrote odoo.js — restored from git, created separate odoo-pos.js
- Duplicate function declarations in odoo.js: agent wrote section twice — truncated and re-appended clean
- Dynamic import shadowing: removed 3x `const { createOdooCrmClient } = await import()` conflicts
- Lint errors fixed: double quotes → single quotes, indentation mismatch, unused constant removed

## Decisions

- Separate route files per phase (odoo-pos.js for Phase 2) to prevent overwrites
- Static imports only — no dynamic imports inside functions
- Factory functions sync (not async) since OdooClient is statically imported
- Fire-and-forget pattern for order → Odoo sync (non-blocking)

## Files Changed

- `worker/src/clients/odoo-product-client.js` (NEW, 422 lines)
- `worker/src/lib/odoo-sales-mapper.js` (NEW, 151 lines)
- `worker/src/routes/odoo-pos.js` (NEW, 257 lines)
- `worker/src/clients/odoo-crm-client.js` (NEW, 319 lines)
- `worker/src/lib/odoo-crm-mapper.js` (NEW, 42 lines)
- `worker/src/routes/odoo.js` (extended with Phase 3 endpoints)
- `worker/src/index.js` (added Phase 2+3 imports and routes)
- `scripts/migrations/002-odoo-pos-tables.sql` (NEW)
- `scripts/migrations/003-odoo-crm-tables.sql` (NEW)

## Verification

- Tests: 144 passed, 29 skipped, 0 failed
- Lint: 0 errors
- CI: passing on main

## Next Steps

- Configure Odoo secrets in production: `wrangler secret put ODOO_URL ODOO_DB ODOO_USERNAME ODOO_API_KEY`
- Run migrations on production D1: `wrangler d1 execute fnb-caffe-db --file scripts/migrations/002-odoo-pos-tables.sql` and `003-odoo-crm-tables.sql`
- Write unit tests for Phase 2/3 clients and mappers
