# Audit Stage 3: Resource Allocation (Allocate-Resources) — AURA CAFE Post-Rearchitecture

**Pipeline Stage:** Stage 3 / Allocate Resources (`--team-capacity`)
**Date:** 2026-09-28
**Selected Audits:** A1, A2, A3, A4
**Output Directory:** `reports/audit/plan/`

---

## 1. Agent Team Composition & Role Matrix

To maximize audit thoroughness while eliminating file contention, the audit team is structured according to Mekong Agent Team guidelines:

| Teammate Name | Agent Persona | Assigned Audit | Exclusive File Ownership Domain |
|---|---|---|---|
| **Lead / Architect** | `suntzu` | Synthesis & Verdicts | `reports/audit/plan/*`, `.ai/state/*` |
| **SecAuditor** | `security-scan` | **Audit A1**: Security & IDOR | `worker/src/routes/openapi-*-handlers/*`, `worker/src/middleware/*`, `packages/domain/payment/*` |
| **DataFinAuditor**| `database-expert` | **Audit A2 & A3**: Pricing & KDS Stream | `packages/domain/order/*`, `worker/src/routes/order-stream.ts`, `worker/src/routes/orders-hono-handlers/*` |
| **UIAuditor** | `ui-ux-designer` | **Audit A4**: Mobile PWA & WCAG | `src/components/md3/*`, `src/components/cart/*`, `src/styles/*`, `src/locales/*` |

---

## 2. Multi-Session Wave Orchestration

```
┌─────────────────────────────────────────────────────────────┐
│ WAVE 1: Parallel Domain Audits                              │
│ ├── SecAuditor     ──▶ Audit A1: IDOR, CORS & Webhooks      │
│ ├── DataFinAuditor ──▶ Audit A2: Pricing & Idempotency      │
│ └── UIAuditor      ──▶ Audit A4: Shells, Touch & WCAG       │
└──────────────────────────────┬──────────────────────────────┘
                               │ (All Wave 1 reports complete)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ WAVE 2: Operational Stream & End-to-End Edge Audit           │
│ └── DataFinAuditor + UIAuditor ──▶ Audit A3: KDS & SSE Stream│
└──────────────────────────────┬──────────────────────────────┘
                               │ (Edge & Stream verified)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ WAVE 3: Lead Synthesis & Final Sign-Off Gate                │
│ └── Lead (suntzu) ──▶ Full Verification (tsc + vitest + PR) │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Work Breakdown by Teammate

### Teammate 1: SecAuditor (`security-scan`)
- **Focus:** Audit A1 (Security, IDOR Boundary & Webhook Cryptography)
- **Work Package:**
  1. Inspect `resolveCustomerScope()` in `order-read-handlers.ts` and `order-mutation-handlers.ts`.
  2. Verify that PayOS payment link generation (`payos-create-link.ts`) validates HMAC signatures using `crypto.subtle.timingSafeEqual`.
  3. Validate that `getCorsOrigin()` strictly matches authorized domains and rejects wildcard credentials.
  4. Run targeted security tests:
     ```bash
     npx vitest run tests/m4d-customer-order-projection.test.ts
     npx vitest run tests/m4d-order-history.test.ts
     npx vitest run worker/src/middleware/__tests__/cors.test.ts
     ```
  5. Output: `reports/audit/plan/findings-a1-security.md`.

### Teammate 2: DataFinAuditor (`database-expert` & `testing-expert`)
- **Focus:** Audit A2 (Server-Authoritative Pricing) & Audit A3 (KDS SSE Stream)
- **Work Package:**
  1. Audit `calculateOrderSnapshot()` against client payload tampering (custom discounts, modified unit prices).
  2. Verify KV idempotency key caching with 120s TTL on order creation requests.
  3. Test SSE reconnection with `Last-Event-ID` in `worker/src/routes/order-stream.ts`.
  4. Run targeted domain and stream tests:
     ```bash
     npx vitest run packages/domain/order/__tests__/
     npx vitest run worker/src/__tests__/routes/openapi-orders.test.ts
     npx vitest run worker/src/__tests__/routes/order-stream.test.ts
     ```
  5. Output: `reports/audit/plan/findings-a2-a3-financial-stream.md`.

### Teammate 3: UIAuditor (`ui-ux-designer`)
- **Focus:** Audit A4 (Mobile PWA Ergonomics, WCAG 2.1 AA & Shell Governance)
- **Work Package:**
  1. Verify zero `CartBottomBar` leakage into `OpsShell` and `AdminShell`.
  2. Audit mobile touch targets across `MenuPage`, `CartBottomBar`, and `TableOrder` (≥44×44px hit areas).
  3. Execute automated contrast check:
     ```bash
     node scripts/contrast-check.mjs
     ```
  4. Verify natural Vietnamese copy in `src/locales/vi.json` and Master Logo SVG / WebP rendering.
  5. Output: `reports/audit/plan/findings-a4-uiux-accessibility.md`.

---

## 4. Resource Allocation & Verification Gates

| Wave | Expected Duration | Concurrency | Gate to Next Wave |
|---|:---:|:---:|---|
| **Wave 1** | 6 min | 3 agents | Zero P0/P1 security or pricing findings open. |
| **Wave 2** | 4 min | 2 agents | KDS reconnect and order stream 100% test pass. |
| **Wave 3** | 3 min | 1 agent | `tsc --noEmit` = 0 errors · 3,519 tests PASS · Clean build. |

---

## 5. Risk & Conflict Prevention
1. **Zero File Overlap**: Each agent works strictly within their assigned file directory.
2. **Read-Only Audit Phase**: Agents audit and generate reports without mutating existing code.
3. **Escalation Trigger**: If any agent discovers a critical vulnerability, they report directly to Lead via `SendMessage`.
