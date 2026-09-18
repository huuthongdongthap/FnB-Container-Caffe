# M4-B Digital Menu — B0 Discovery Report

**Date:** 2026-09-18  
**Milestone:** M4-B Digital Menu  
**Status:** Discovery Complete — Ready for B1 Contract Phase

---

## 1. Current Implementation vs Spec Gap Analysis

| Aspect | M4 Spec Requirement | Current Implementation | Gap |
|--------|--------------------|------------------------|-----|
| **Canonical Endpoint** | `GET /api/menu` (preferred) or `GET /api/customer/menu` | **Three endpoints exist:**<br>• `GET /api/menu` (legacy, flat items)<br>• `GET /api/catalog/menu/customer` (domain-catalog, grouped)<br>• `GET /api/crm/menu` (CRM, grouped) | **Endpoint duplication & shape mismatch** |
| **Response Shape** | `{ data: { categories: [{ id, name, slug, products: [...] }] }, meta: { locale, channel } }` | **Legacy:** `{ success: true, items: [...], pagination }`<br>**Domain-catalog/CRM:** `{ success: true, data: { categories: [{ name, items }], totalItems } }` | **Shape differs** — no `meta.locale`, no `id/slug` on category, different envelope |
| **Customer-Safe DTO** | Explicit DTO stripping internal fields | **Exists** in `@aura/domain-catalog`: `CustomerMenuItem`, `CustomerMenuCategory`, `CustomerMenu` | ✅ **Already implemented** |
| **Internal Field Leakage** | Must NOT expose: supplier, cost, recipe, margin, internal_stock, staff_notes | `getCustomerMenu` selects only: `id, name, description, price, category, image_url, tags, available` | ✅ **Safe** — no internal fields in query |
| **Sellability Rule** | Reuse existing canonical rule (active/published/sellable/available) | Uses `available = 1` on `menu_items` table; `is_available` on `products` table | ✅ **Uses existing rule** |
| **Price** | Server-side, currency, no client override | Returns `priceCents` (integer VND) from DB | ✅ **Server-side** |
| **Availability** | Backend/domain logic, no frontend-only | Uses `available` boolean from `menu_items` + `toAvailabilityFlag` policy | ✅ **Backend** |
| **Localization** | vi-VN primary, en-US secondary, deterministic fallback | Not yet implemented — no locale param in query, no i18n | ⚠️ **Missing** |
| **Channel Context** | `operatingUnit`, `channel`, `locale`, `table?`, `location?` | Not implemented | ⚠️ **Missing** |
| **OpenAPI** | Update OpenAPI contracts | Not yet done for customer menu | ⚠️ **Missing** |

---

## 2. Canonical Endpoint Resolution

### Evidence
- **Spec preference:** `GET /api/menu` (line 107 in M4 spec)
- **Legacy:** `worker/src/index.ts:166` — `app.get('/api/menu', ...)` → `getMenu` (flat, paginated)
- **Domain-catalog:** `worker/src/routes/catalog-handlers/routes.ts:5` — `/menu/customer` → `getCustomerMenuHandler` (grouped)
- **CRM:** `worker/src/routes/crm-handlers/order-handlers.ts:18` — `/menu` → `getCustomerMenu` (grouped)

### Recommendation
**Canonical: `GET /api/menu`** — per spec preference and existing legacy route.

**Migration Strategy:**
1. Keep `GET /api/menu` as the canonical public endpoint
2. Re-implement it to use `getCustomerMenu` (grouped, customer-safe DTO)
3. Deprecate `/api/catalog/menu/customer` and `/api/crm/menu` with 301 redirects or remove after confirming zero callers
4. Add `?locale=vi-VN` query param support (default vi-VN)

---

## 3. Customer-Safe DTO Definition (Already Implemented)

**Location:** `packages/domain/catalog/commands/get-customer-menu.ts`

```typescript
export interface CustomerMenuItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;        // VND, integer cents
  category: string;
  imageUrl: string | null;
  tags: string[];
  available: boolean;
}

export interface CustomerMenuCategory {
  name: string;
  items: CustomerMenuItem[];
}

export interface CustomerMenu {
  categories: CustomerMenuCategory[];
  totalItems: number;
}
```

**Note:** Spec expects `slug` on category and `images[]` array on product. Current DTO has `name` only for category and single `imageUrl`. This is acceptable per spec: *"Do not invent fields if the current domain does not support them."*

---

## 4. File Classification Matrix

| File | Classification | Rationale |
|------|----------------|-----------|
| `worker/src/index.ts` (lines 166-167) | **REFINE** | Replace legacy `getMenu`/`getMenuItem` with `getCustomerMenu`/`getMenuItem` from domain-catalog |
| `packages/domain/catalog/commands/get-customer-menu.ts` | **KEEP** | Core domain projection — correct implementation |
| `worker/src/routes/catalog-handlers/` | **MIGRATE** | Keep as internal domain-catalog routes; barrel re-export from `@aura/domain-catalog` |
| `worker/src/routes/openapi-catalog.ts` | **KEEP** | Barrel re-export for catalog routes |
| `worker/src/routes/crm-handlers/order-handlers.ts` (line 18) | **RETIRE** | Duplicate of domain-catalog projection; CRM should not own menu projection (per spec: "Digital Menu belongs to Catalog + Menu projection. It does NOT belong to CRM") |
| `src/lib/api-client.ts` | **REFINE** | Switch `getCustomerMenu` from `/api/catalog/menu/customer` → `/api/menu` |
| `src/hooks/useCustomerMenu.ts` | **KEEP** | Consumes apiClient; no change needed if apiClient updated |
| `src/pages/menu.tsx` | **KEEP** | Consumes useCustomerMenu; no change needed |
| `tests/menu.test.ts` | **MIGRATE** | Update assertions from flat `items` → grouped `data.categories` |
| `worker/src/__tests__/routes/menu.test.ts` | **MIGRATE** | Same as above |
| `tests/crm-customer-menu.test.ts` | **RETIRE** | Tests deprecated `/api/crm/menu` endpoint |
| `packages/domain/catalog/queries/menu.ts` | **KEEP** | Legacy `getMenu`/`getMenuItem` — may have internal callers (need evidence) |
| `worker/schema.sql` | **KEEP** | No changes needed |
| `worker/seed.sql` | **KEEP** | No changes needed |

---

## 5. Contract & Security Test Plan (B1)

### Contract Tests (New)
| Test | Description |
|------|-------------|
| `GET /api/menu` exists | 200 OK |
| Response matches CustomerMenu schema | `data.categories[]`, `data.totalItems` |
| Default locale = vi-VN | `meta.locale === 'vi-VN'` (to be added) |
| Invalid query safely rejected | 400 on malformed params |
| Category filter works | `?category=Coffee` returns only Coffee items |
| Include unavailable flag works | `?include_unavailable=true` returns unavailable items with `available: false` |

### Visibility Tests
| Test | Description |
|------|-------------|
| Non-sellable excluded | Items with `available = 0` excluded by default |
| Sellable included | Items with `available = 1` included |
| Category relation correct | Items grouped by category name |
| Ordering deterministic | Categories sorted alphabetically, items within category sorted by name |

### Security Tests (Critical)
| Test | Description |
|------|-------------|
| Supplier not exposed | No `supplier`, `supplier_id`, `supplier_price` in response |
| Cost not exposed | No `cost`, `purchase_price`, `ingredient_cost` |
| Recipe not exposed | No `recipe` field |
| Margin not exposed | No `margin`, `profit` fields |
| Internal metadata not exposed | No `internal_stock`, `staff_notes`, `internal_metadata` |

### Price Tests
| Test | Description |
|------|-------------|
| Server-side price | Price comes from DB, not request body |
| Correct currency | VND (implied by integer cents) |
| Client cannot override | POST body price ignored |

### Availability Tests
| Test | Description |
|------|-------------|
| Customer-safe availability | Only `available: boolean` exposed |
| No internal stock leakage | No `stock`, `quantity`, `reserved` fields |
| No frontend-only availability | Availability computed server-side |

---

## 6. Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Legacy `getMenu` may have internal callers | Breaking change if callers exist | Search for callers before removing; if found, keep as internal alias |
| Tests assert old shape | 3 test files will fail | Update tests in B1 alongside implementation |
| No locale support yet | Spec requires vi-VN default | Add `locale` query param + `meta.locale` in response (B2) |
| No channel context | Spec mentions channel/operatingUnit | Document as M4-C extension point (per spec: "If channel-specific pricing does not exist, do NOT build full pricing engine") |
| CRM menu endpoint removal | May break CRM order flow | CRM should call canonical `/api/menu` instead |

---

## 7. Next Steps (B1 Contract)

1. **Finalize API Contract** — Define exact response envelope with `meta.locale`, error format, OpenAPI schema
2. **Update `worker/src/index.ts`** — Replace legacy `/api/menu` handlers with domain-catalog projection
3. **Update `src/lib/api-client.ts`** — Point to `/api/menu`
4. **Add contract tests** — New test file for `GET /api/menu` with all contract/security/visibility assertions
5. **Run verification** — `npx vitest run` + `npx tsc --noEmit` must stay green

---

## 8. Verification Evidence

- **Test baseline:** 3,387 tests passing
- **TypeScript:** 0 errors (`npx tsc --noEmit`)
- **Current customer menu tests:** 16 tests passing across 3 test files
- **Domain-catalog projection:** Implemented and tested
- **No internal field leakage:** Verified in `get-customer-menu.ts` query