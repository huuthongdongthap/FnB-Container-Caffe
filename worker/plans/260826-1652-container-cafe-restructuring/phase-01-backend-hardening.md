# Phase 1: Backend Hardening & API Contract

**Duration:** Week 1  
**Owner:** Backend Team  
**Dependencies:** None (can start immediately)

---

## 1.1 OpenAPI Spec Generation

### Tasks
- [ ] Install `@hono/zod-openapi` and `openapi-zod-client` packages
- [ ] Define Zod schemas for all request/response bodies in `worker/src/schemas/`
- [ ] Annotate Hono routes with OpenAPI metadata using `openapi` middleware
- [ ] Generate `openapi.json` at build time via `scripts/generate-openapi.ts`
- [ ] Serve spec at `GET /api/openapi.json`
- [ ] Add Scalar UI at `GET /api/docs` (or Redoc)
- [ ] Add CI step: `npm run openapi:validate` in GitHub Actions

### Files to Create/Modify
```
worker/
├── src/
│   ├── schemas/
│   │   ├── index.ts              # Barrel export
│   │   ├── auth.ts               # Login, register, refresh, verify
│   │   ├── orders.ts             # Order CRUD, status transitions
│   │   ├── menu.ts               # Categories, items, modifiers
│   │   ├── payments.ts           # PayOS webhook, refunds
│   │   ├── loyalty.ts            # Tiers, points, rewards, referrals
│   │   ├── admin.ts              # Dashboard, staff, inventory, finance
│   │   └── common.ts             # Pagination, errors, success wrappers
│   ├── lib/
│   │   └── openapi.ts            # OpenAPI config, security schemes
│   └── middleware/
│       └── openapi.ts            # Request validation middleware
├── scripts/
│   └── generate-openapi.ts       # Build-time generation
└── package.json                  # Add openapi scripts
```

### Acceptance Criteria
- [ ] `GET /api/openapi.json` returns valid OpenAPI 3.1 spec
- [ ] `/api/docs` renders interactive API documentation
- [ ] All 50+ routes have request/response schemas
- [ ] CI fails on schema validation errors

---

## 1.2 Database Locality Extensions

### Migrations to Create
```sql
-- 20260826_01_sa_dec_locality.sql
-- Sa Đéc location & localization fields

-- Orders: locale + location context
ALTER TABLE orders ADD COLUMN locale TEXT DEFAULT 'vi-VN';
ALTER TABLE orders ADD COLUMN location_id TEXT DEFAULT 'sa-dec-main';
CREATE INDEX IF NOT EXISTS idx_orders_location ON orders(location_id);

-- Categories: bilingual display names
ALTER TABLE categories ADD COLUMN display_name_vi TEXT;
ALTER TABLE categories ADD COLUMN display_name_en TEXT;
UPDATE categories SET display_name_vi = name, display_name_en = name;

-- Menu Items: local sourcing flags
ALTER TABLE menu_items ADD COLUMN is_local_specialty INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN ingredient_source TEXT CHECK (ingredient_source IN ('local', 'imported', 'mixed')) DEFAULT 'mixed';
ALTER TABLE menu_items ADD COLUMN story_vi TEXT;
ALTER TABLE menu_items ADD COLUMN story_en TEXT;

-- Locations table (for multi-site future)
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name_vi TEXT NOT NULL,
    name_en TEXT NOT NULL,
    address_vi TEXT,
    address_en TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO locations (id, name_vi, name_en, address_vi, address_en, phone)
VALUES ('sa-dec-main', 'AURA CAFE Sa Đéc', 'AURA CAFE Sa Dec', '39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp', '39 Nguyen Tat Thanh, Sa Dec, Dong Thap', '+84 277 382 XXXX');
```

### Files to Modify
```
worker/
├── db/
│   └── migrations/
│       └── 20260826_01_sa_dec_locality.sql
├── src/
│   ├── routes/
│   │   ├── orders-hono.ts        # Add locale/location_id to order create
│   │   ├── categories.ts         # Return bilingual names
│   │   └── products.ts           # Return local_specialty, ingredient_source, stories
│   └── lib/
│       └── db.ts                 # Add location_id to query context
```

### Acceptance Criteria
- [ ] Migration applies cleanly to local/staging/prod D1
- [ ] Orders carry `locale` and `location_id`
- [ ] Menu API returns bilingual category/item names
- [ ] Local specialty flag filters correctly in menu queries

---

## 1.3 Device Trust & Session Hardening

### Tasks
- [ ] Add `device_fingerprint`, `trusted_until`, `last_seen_at` to `sessions` table
- [ ] Implement device fingerprinting on login (user-agent + IP subnet + canvas hash)
- [ ] Add "Trust this device for 30 days" checkbox on login
- [ ] Trusted devices skip 2FA/magic link on subsequent logins
- [ ] Add suspicious login detection (new device, new geo, impossible travel)
- [ ] Email + push notification on suspicious login
- [ ] Rotate refresh tokens when role/permissions change
- [ ] Add session revocation API (user can revoke all other sessions)

### Files to Create/Modify
```
worker/
├── db/
│   └── migrations/
│       └── 20260826_02_device_trust.sql
├── src/
│   ├── routes/
│   │   ├── auth.ts               # Enhanced login with device fingerprint
│   │   ├── auth-session.ts       # Session management, revocation
│   │   └── auth-devices.ts       # List/revoke trusted devices
│   ├── lib/
│   │   ├── device-fingerprint.ts # Fingerprint generation + validation
│   │   ├── session-store.ts      # KV-backed session with device metadata
│   │   └── notifications.ts      # Email/push for security alerts
│   └── middleware/
│       └── auth.ts               # Check device trust status
```

### Acceptance Criteria
- [ ] Login returns `device_trusted: boolean` + `trusted_until` timestamp
- [ ] Trusted device bypasses 2FA for 30 days
- [ ] Suspicious login triggers email within 60 seconds
- [ ] User can view/revoke all active sessions from account page
- [ ] Refresh token rotation on role change verified in tests

---

## 1.4 Payment Resilience

### Tasks
- [ ] Enforce PayOS webhook idempotency key (`x-webhook-idempotency-key` header)
- [ ] Store processed webhook IDs in KV with 90-day TTL
- [ ] Implement payment retry with exponential backoff (max 3 retries)
- [ ] Add payment method tokenization (save card for returning customers)
- [ ] Add PayOS refund API integration
- [ ] Implement payment reconciliation job (daily batch)

### Files to Create/Modify
```
worker/
├── src/
│   ├── routes/
│   │   ├── webhooks.ts           # Idempotency enforcement
│   │   ├── payments.ts           # Tokenization, refunds
│   │   └── cron.ts               # Reconciliation job
│   ├── lib/
│   │   ├── payos-client.ts       # Enhanced with retry + idempotency
│   │   ├── payment-store.ts      # KV for webhook deduplication
│   │   └── reconciliation.ts     # Daily payment vs order matching
│   └── types/
│       └── payments.ts           # Tokenized payment method types
```

### Acceptance Criteria
- [ ] Duplicate PayOS webhooks rejected (idempotency key check)
- [ ] Failed payment retries 3x with backoff (1m, 5m, 15m)
- [ ] Returning customers can select saved payment method
- [ ] Refund API works end-to-end (test with PayOS sandbox)
- [ ] Reconciliation job reports discrepancies < 0.1%

---

## Testing Requirements

| Test | Target |
|------|--------|
| OpenAPI spec validation | 100% routes covered |
| Migration rollback/forward | Clean on fresh D1 |
| Device trust flow | 5 scenarios (new, trusted, expired, revoked, suspicious) |
| Payment idempotency | 100 duplicate webhooks → 1 processed |
| Payment retry | Simulated failures → success on retry |

---

## Rollback Plan
- Migration rollback scripts in `worker/db/rollbacks/`
- Feature flags for device trust (`ENABLE_DEVICE_TRUST`)
- OpenAPI generation behind flag (`ENABLE_OPENAPI_DOCS`)

---

## Next Phase Dependency
Phase 2 (Frontend Component Library) can start in parallel after 1.1 completes (OpenAPI types needed for frontend API client).