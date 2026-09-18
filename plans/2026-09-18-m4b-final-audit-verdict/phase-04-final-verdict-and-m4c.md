# Phase 4: Final Acceptance Matrix & M4-C Readiness

## Overview
- **Goal:** Consolidate all audit gates into final acceptance matrix, document non-blocking gaps, and establish M4-C reuse contract.
- **Status:** COMPLETED
- **Verified Date:** 2026-09-18

## Final Acceptance Matrix

| Criterion | Met? | Evidence |
|-----------|------|----------|
| Canonical API resolves to single contract | ✅ | `worker/src/index.ts:166-190` |
| No internal field leakage in customer response | ✅ | 15-field FORBIDDEN assertion in tests |
| Sellability policy: available-only by default | ✅ | `includeUnavailable` opt-in verified |
| Price: server-side integer VND cents | ✅ | `priceCents: number` in DTO + tests |
| Availability: backend-derived, no internal exposure | ✅ | `parseAvailabilityFilter` / `toAvailabilityFlag` |
| Locale: vi-VN default, en-US supported, deterministic collation | ✅ | `localeCompare(..., 'vi')` + `meta.locale` |
| OpenAPI contract matches runtime | ✅ | `MenuRoutes` registered in `openapi.ts` |
| Tests cover acceptance criteria | ✅ | 15 contract tests + 9 legacy tests |
| E2E journey verified or justified | ✅ (justified) | Mock E2E complete; live E2E documented as gap |
| UI consumes only canonical API | ✅ | `useCustomerMenu` → `apiClient` → `/api/menu` |
| Three shells isolated | ✅ | No cross-contamination in M4-B scope |
| Design system consistent | ✅ | MD3 tokens, no raw values in menu page |
| No legacy deletion without evidence | ✅ | CRM route deleted after zero-caller verification |
| Build clean | ✅ | `tsc=0`, `vitest=3395 PASS` |
| Git hygiene | ✅ | Focused diff, no temp files |
| State documented | ✅ | `.ai/state/*` created |

## Non-Blocking Gaps (YELLOW)

| ID | Area | Description | Resolution |
|----|------|-------------|------------|
| Y-01 | ESLint (#15) | 53 pre-existing errors in `worker/src/tree/*` legacy handlers. Zero M4-B file errors. | Deferred — dedicated lint sweep |
| Y-02 | Live E2E (#10) | In-process mock only; no live Workers + real D1. | M4-C deployment milestone |
| Y-03 | Channel Pricing (#05) | No channel pricing engine; single `priceCents` for all channels. | Documented as M4-C extension point |

## M4-C Reuse Contract

**Foundation Components (VERIFIED — MUST REUSE):**

| Component | Reuse In M4-C |
|-----------|---------------|
| `@aura/domain-catalog` Product/Category/Modifier/HappyHour models | ✅ Required |
| `getCustomerMenu` / `getCustomerMenuItem` projection functions | ✅ Required |
| Customer-Safe DTO (FORBIDDEN_FIELDS contract) | ✅ Required |
| Integer VND cents price (`priceCents`) | ✅ Required |
| Backend-derived availability (`toAvailabilityFlag`) | ✅ Required |
| `useCustomerMenu` hook + `apiClient.getCustomerMenu()` | ✅ Required |
| CRM Order domain (`@aura/domain-orders`) | ✅ Required |

**M4-C Must NOT Build (Anti-Duplication):**
- ❌ `OnlineProduct` — reuse `Product`
- ❌ `OnlineMenuProduct` — reuse `CustomerMenuItem`
- ❌ Second Catalog — reuse `@aura/domain-catalog`
- ❌ Second Order model — reuse CRM Order
- ❌ Second pricing engine — single `priceCents` is canonical

**M4-C Extension Points (GREENFIELD):**
- Channel-specific pricing (e.g., delivery vs dine-in vs takeaway)
- Live Cloudflare Workers E2E against real D1
- Real-time availability via WebSocket (KDS integration)
- Multi-locale content management (beyond vi-VN/en-US)

## Final Decision

```
M4-B VERIFIED WITH NON-BLOCKING GAPS
```

**Rationale:**
- No RED audit gates
- All 18 gates: 15 GREEN, 3 YELLOW (all non-blocking, pre-existing or justified)
- All critical acceptance criteria verified with evidence
- 3,395 tests PASS, 0 TypeScript errors
- Canonical API, customer-safe DTO, price/availability policy, OpenAPI contract, test coverage — all verified
- State documentation complete

**M4-C may proceed.** The reusable foundation is solid and verified.