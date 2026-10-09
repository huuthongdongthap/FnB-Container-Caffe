# Pre-Flight Deployment Checklist

**Project**: AURA CAFE — FnB Container Caffe (`aura-space-sadec`)  
**Timestamp**: 2026-10-09T08:46:00Z  
**Target Environments**:
- Cloudflare Pages: `fnb-caffe-container` (Production SPA)
- Cloudflare Workers: `aura-space-worker` (Edge API Gateway)
- Cloudflare D1: `fnb-caffe-db` (Edge Distributed SQL)

---

## Pre-Flight Verification Gate

| Check Item | Command | Result | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Typecheck** | `tsc --noEmit` | 0 errors | PASS |
| **Worker Typecheck** | `tsc --project worker/tsconfig.json --noEmit` | 0 errors | PASS |
| **ESLint Static Analysis** | `eslint worker/src/ --ext .ts` | 0 errors, 0 warnings | PASS |
| **Frontend Production Build** | `npx vite build --mode production` | `dist/` bundle generated | PASS |
| **Domain Contracts Test Suite** | `npx vitest run worker/src/__tests__/integrations/` | 33/33 files, 272/272 tests | PASS |
| **Full Regression Suite** | `npm test` | All unit/integration passed | PASS |

---

## Contract Compliance & Architecture Gate

- [x] **Canonical Catalog SOT**: `products` & `categories` canonical, TEXT IDs preserved.
- [x] **Table & Reservation Contract**: Locked in `@aura/domain-table` & `@aura/domain-reservation`.
- [x] **Authorization & Scope Contract**: Role guards & operating unit isolation enforced.
- [x] **Audit Trail Contract**: Immutable append-only logging in `@aura/domain-audit`.
- [x] **Notification Contract**: Locked in `@aura/domain-notification`.
- [x] **Integration Boundary Contract**: Locked in `@aura/domain-integration`.

**Pre-Flight Status**: APPROVED FOR DEPLOYMENT.
