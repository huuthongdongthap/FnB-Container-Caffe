---
title: "FnB Container Caffe — SaaS Pivot Bootstrap (7-Phase Plan)"
description: "Multi-phase plan to pivot AURA CAFE F&B management system into SaaS for solo F&B CEOs (OPCs), bootstrapping within existing Vite + React + Hono + D1 repo"
status: completed
priority: P1
effort: 7ph
branch: main
tags: [saas-pivot, fnb, hono, d1, multi-tenant, pricing]
created: 2026-08-03
---

# SaaS Pivot Bootstrap — Index

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Codebase Lock & Delivery-Safe Boundary Definition | completed | phase-01-codebase-lock.md |
| 2 | Asset Inventory (Catalog Reusable Features/Components) | completed | phase-02-asset-inventory.md |
| 3 | MVP Workflow Selection (First SaaS-ifiable Feature) | completed | phase-03-mvp-workflow.md |
| 4 | Pricing Page MVP Implementation | completed | phase-04-pricing-page-mvp.md |
| 5 | Tenant Isolation Architecture (Multi-Tenant SaaS) | completed | phase-05-tenant-isolation.md |
| 6 | Auth Tier Gating (BASIC|PREMIUM|ENTERPRISE|MASTER) | completed | phase-06-auth-tier-gating.md |
| 7 | Test & Verification | completed | phase-07-test-verification.md |

**Dependency chain:** 1 → 2 → 3 → 4 → 5 → 6 → 7
**Non-goals:** No full SaaS rebuild; no model retraining; no breaking AURA CAFE ops.
**Defense flow:** Existing (`worker/src/index.ts:17`) mounts 40+ route modules. Phases only ADD routes/components, never REMOVE.
