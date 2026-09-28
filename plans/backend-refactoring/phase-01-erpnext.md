# Phase 1 — ERPNext Integration Refactoring

## Overview

**Target files:**
- `worker/src/lib/erpnext-mapper.ts` (~702 LOC)
- `worker/src/clients/erpnext-client.ts` (~440 LOC)

**Goal:** Modularize into domain-focused submodules with compatibility barrels, preserving all public exports and behavior.

## Current State Analysis

### `worker/src/lib/erpnext-mapper.ts` (702 LOC)
**Exported Types:**
- `AccountConfig`, `CustomerRecord`, `OrderItem`, `OrderRecord`, `InvoiceLineItem`, `TaxLineItem`, `SalesInvoice`, `CustomerInvoiceFields`, `VatInvoicePayload`, `MappingResult`

**Exported Functions:**
- `getDefaultAccountConfig()` — Account config defaults
- `mapCustomerForInvoice(customer)` — Customer mapping for invoices
- `mapInvoiceLine(item, companyConfig?)` — Line item mapping
- `mapTaxLine(order, companyConfig?)` — Tax line mapping
- `mapOrderToInvoice(order, items, customer, companyConfig?)` — Full invoice mapping
- `mapInvoiceForVAT(erpnextInvoice, companyConfig?)` — VAT e-invoicing payload
- `validateInvoiceData(invoice)` — Invoice validation
- `isMappingSuccess(result)` — Success check
- `getMappingStatus(result)` — Status string extraction

**Domain Groups:**
1. **Items/Menu** — `mapInvoiceLine`, `mapTaxLine` (order line → ERPNext invoice line + tax)
2. **Orders/Sales Invoices** — `mapOrderToInvoice`, `generateInvoiceName` (internal), `mapInvoiceForVAT`, `validateInvoiceData`
3. **Customers/CRM** — `mapCustomerForInvoice`, `getDefaultAccountConfig`, `isMappingSuccess`, `getMappingStatus`

**Consumers:**
- `worker/src/clients/erpnext-accounting-client.ts` imports `mapOrderToInvoice`, `mapCustomerForInvoice`

### `worker/src/clients/erpnext-client.ts` (440 LOC)
**Exported:**
- `ErpnextError`, `NetworkError`, `MalformedResponseError` (error classes)
- `ErpnextClientConfig`, `ErpnextApiResponse`, `LeadPayload` (types)
- `ErpnextClient` class with:
  - Core: `_request`, `_isRetryableError`, `_calculateDelay`, `_sleep`
  - CRUD: `create`, `read`, `update`, `put`, `delete`
  - Search: `search`, `searchByField`
  - Doctype-specific: `createCustomer`, `createSalesOrder`, `createLead`, `getItem`, `getCustomer`, `getSalesOrder`
- Factory: `createErpnextClient`, `createErpnextClientWithKv`

**Domain Groups:**
1. **Core Transport** — error classes, config types, `ErpnextClient` base (auth, retry, HTTP)
2. **Items** — `getItem`
3. **Sales Invoices/Orders** — `createSalesOrder`, `getSalesOrder`
4. **Customers/CRM** — `createCustomer`, `getCustomer`, `createLead`

**Consumers:**
- `erpnext-accounting-client.ts` (uses `ErpnextClient`, errors)
- `erpnext-crm-client.ts` (uses `ErpnextClient`, errors)
- `erpnext-product-client.ts` (uses `ErpnextClient`, errors)
- Routes: `erpnext-pos.ts`, `erpnext-sync.ts`, `erpnext.ts`, `erpnext/customers.ts`, `erpnext/expenses.ts`, `erpnext/vendors.ts`

## Proposed Modular Structure

```
worker/src/erpnext/
├── mapper/
│   ├── types.ts              # All shared types
│   ├── items-menu.ts         # mapInvoiceLine, mapTaxLine
│   ├── orders-sales-invoices.ts  # mapOrderToInvoice, mapInvoiceForVAT, validateInvoiceData, generateInvoiceName
│   ├── customers-crm.ts      # mapCustomerForInvoice, getDefaultAccountConfig, isMappingSuccess, getMappingStatus
│   └── index.ts              # Barrel: re-export all
├── client/
│   ├── core.ts               # ErpnextClient base (auth, retry, HTTP, errors)
│   ├── items.ts              # getItem
│   ├── sales-invoices.ts     # createSalesOrder, getSalesOrder
│   ├── customers.ts          # createCustomer, getCustomer, createLead
│   └── index.ts              # Barrel: re-export all
├── index.ts                  # Root barrel: re-export mapper + client
```

## Compatibility Strategy

**Barrel files to maintain:**
- `worker/src/lib/erpnext-mapper.ts` → re-exports from `worker/src/erpnext/mapper/index.ts`
- `worker/src/clients/erpnext-client.ts` → re-exports from `worker/src/erpnext/client/index.ts`

This ensures zero consumer disruption.

## Dependency Constraints

1. **Mapper is domain-logic only** — no HTTP, no `ErpnextClient` dependency
2. **Client is transport-only** — no mapping logic, uses mapper only if needed (currently accounting-client does this)
3. **Types shared** — both mapper and client may import from `worker/src/erpnext/mapper/types.ts`

## Test Coverage

**Targeted tests to run after each step:**
- `tests/erpnext-client.test.ts`
- `tests/erpnext-invoices.test.ts`
- `tests/erpnext-pos.test.ts`
- `tests/erpnext.test.ts`
- `worker/src/__tests__/clients/erpnext-client.test.ts`
- `worker/src/__tests__/clients/erpnext-accounting-client.test.ts`
- `worker/src/__tests__/clients/erpnext-crm-client.test.ts`
- `worker/src/__tests__/clients/erpnext-product-client.test.ts`
- `worker/src/__tests__/routes/erpnext-customers.test.ts`
- `worker/src/__tests__/routes/erpnext-vendors.test.ts`
- `worker/src/__tests__/routes/erpnext-expenses.test.ts`

## Implementation Steps

1. Create directory structure
2. Extract `types.ts` (shared types)
3. Extract `items-menu.ts` (line/tax mapping)
4. Extract `orders-sales-invoices.ts` (invoice + VAT mapping)
5. Extract `customers-crm.ts` (customer mapping + helpers)
6. Create `mapper/index.ts` barrel
7. Update `worker/src/lib/erpnext-mapper.ts` as compatibility barrel
8. Run typecheck + targeted tests
9. Extract `client/core.ts` (base client + errors)
10. Extract `client/items.ts`
11. Extract `client/sales-invoices.ts`
12. Extract `client/customers.ts`
13. Create `client/index.ts` barrel
14. Update `worker/src/clients/erpnext-client.ts` as compatibility barrel
15. Run typecheck + targeted tests
16. Full test suite + build verification

## Verification Gates

After each major step:
- `npx tsc --noEmit` = 0 errors
- Targeted ERPNext tests PASS
- No import resolution errors

Final verification:
- Full Vitest suite (375 files / 3,475 tests PASS)
- `npm run build` OK