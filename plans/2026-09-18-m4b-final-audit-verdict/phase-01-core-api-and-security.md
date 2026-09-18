# Phase 1: Core API & Domain Security (Audits #01 - #06)

## Overview
- **Goal:** Unify customer menu endpoints, enforce domain boundaries, project customer-safe DTOs, and verify product visibility, price integrity, and availability logic.
- **Status:** COMPLETED (ALL GREEN)
- **Verified Date:** 2026-09-18

## Audit Results

### Audit #01: Canonical API Resolution
- **Requirement:** Resolve three-way endpoint duplication into a single customer contract.
- **Implementation:** Canonical endpoints wired at `worker/src/index.ts:166-190`:
  - `GET /api/menu`: Returns `{ success: true, data: CustomerMenu, meta: { locale } }`
  - `GET /api/menu/:id`: Returns `{ success: true, data: CustomerMenuItem }` (or 404)
  - `GET /api/catalog/menu/customer`: Aliased in `worker/src/routes/catalog-handlers/routes.ts`
  - `/api/crm/menu`: Safely deleted from `worker/src/routes/crm-handlers/order-handlers.ts` after zero callers verified.
- **Status:** GREEN

### Audit #02: Domain Boundary
- **Requirement:** Single domain source `@aura/domain-catalog`. No duplicate Product or Category models.
- **Implementation:** `packages/domain/catalog/commands/get-customer-menu.ts` acts as the domain projection boundary.
- **Status:** GREEN

### Audit #03: Customer-Safe DTO Projection
- **Requirement:** Stripping of 14 internal/procurement fields (`cost`, `supplier`, `supplier_id`, `supplier_price`, `purchase_price`, `ingredient_cost`, `recipe`, `margin`, `profit`, `internal_stock`, `staff_notes`, `internal_metadata`, `procurement_data`, `ingredient_source`).
- **Implementation:** SQL SELECT explicitly specifies safe columns. Verified in `tests/m4b-digital-menu-contract.test.ts` Section 2.
- **Status:** GREEN

### Audit #04: Product Visibility
- **Requirement:** Available-only by default (`available = 1`); opt-in `include_unavailable=true` exposes unavailable items marked `available: false`.
- **Implementation:** Filter logic in `get-customer-menu.ts`. Verified in contract tests.
- **Status:** GREEN

### Audit #05: Price Integrity
- **Requirement:** Integer VND cents, server-side authoritative, zero frontend override.
- **Implementation:** `priceCents: number` computed and cast server-side. Read-only client.
- **Status:** GREEN

### Audit #06: Availability Logic
- **Requirement:** Derived status computed via `parseAvailabilityFilter` / `toAvailabilityFlag`. Zero internal inventory count exposure.
- **Implementation:** Normalized boolean `available: boolean` returned in DTO.
- **Status:** GREEN
