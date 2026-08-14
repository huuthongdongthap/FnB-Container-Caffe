# SaaS Bootstrap — Solo OPC F&B CEO

## Brainstorm Contract

### Outcome
A running SaaS product scoped for one F&B CEO running a solo OPC — mobile-first ordering and operations that a single operator can run alone.

### Constraints
- Solo-OPC: no employee-facing workflows, minimal operational overhead
- Cloudflare Workers (Hono + D1 + KV) — existing stack
- Mobile-first, no app store needed (web app + QR)
- Local Vietnam context (VND, phone auth, COD + online)
- Solo operator runs everything from phone

### Non-goals
- Multi-branch/enterprise multi-tenant
- Complex inventory ERP
- Offline-first PWA beyond checkout queue
- Third-party loyalty integrations at launch
- Subscription billing / SaaS tier activation

### Acceptance Criteria
- CEO can create orders (dine-in + takeaway) from phone
- Payment flow works: PayOS QR + COD cash
- Guest check-in with QR table scan
- Owner sees orders + payout summary on one screen
- All tests pass, zero TS errors before deploy

## Phases

| # | Title | Status | Dependencies |
|---|-------|--------|-------------|
| 1 | foundation | completed | 260804-0001 (typescript audit cleanup) |
| 2 | payments-cod | completed | 1 |
| 3 | dinein-qr | completed | 2 |
| 4 | takeaway | completed | 3 |
| 5 | guest-checkin | completed | 2 |
| 6 | admin-payout | completed | 2 |

## Key Risks
- TS compile errors must be resolved in plan 260804-0001 first
- Tier enum mismatch (BASIC vs lowercase) in existing saas_tenants
- PayOS webhook not implemented for tenant activation
- No tenant isolation middleware yet

## Next Steps
1. Complete 260804-0001 audit cleanup
2. Start Phase 2: payments-cod
3. Wire COD flag into existing order flow
