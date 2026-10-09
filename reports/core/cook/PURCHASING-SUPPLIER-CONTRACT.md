# Purchasing / Supplier Contract & Canonical Invariants

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-08  
**Scope**: Canonical Supplier → Purchase Order → Receiving → Stock → Recipe Consumption → Cost Flow  

---

## 1. Canonical Flow Architecture

```
SUPPLIER (suppliers)
   │ (Purchasing Domain — owns vendor identities, terms, contacts)
   ▼
PURCHASE ORDER (purchase_orders, purchase_order_items)
   │ (Purchasing Domain — contractual procurement commitment, status='ordered')
   ▼
RECEIVING / GRN (receivePurchaseOrder gateway)
   │ (Purchasing/Inventory Gateway — verified physical stock delivery & inspection)
   ▼
STOCK (ingredients.current_stock)
   │ (Inventory Domain — available raw material units increased ONLY here)
   ▼
RECIPE CONSUMPTION (recipes, recipe_items → stock_movements: consumption)
   │ (Inventory Transaction — order fulfillment consumes ingredients)
   ▼
COST & MARGIN (ingredients.cost_per_unit updated to PO price; COGS derived)
     (Financial Derivation — Realized Revenue − Canonical COGS)
```

---

## 2. Entity & Ownership Map

| Domain / Boundary | Tables / Entities | Authoritative Role | Non-Authority Constraints |
| :--- | :--- | :--- | :--- |
| **Purchasing** | `suppliers` | Supplier Master, tax IDs, vendor relationships | Never owns customer or product catalog records |
| **Purchasing** | `purchase_orders`, `purchase_order_items` | Purchase contracts, PO status, unit purchase prices | NEVER mutates `ingredients.current_stock` upon creation |
| **Purchasing Gateway** | `receivePurchaseOrder()` | Physical intake verification, partial receipts, GRN | Sole authorized mutation gateway for purchase stock-in |
| **Inventory** | `ingredients` | Raw materials, authoritative stock level & unit cost | Master raw material warehouse; does not set sales price |
| **Inventory (Ledger)** | `stock_movements` | Append-only ledger (`purchase_receipt`, `adjustment`) | Immutable once written; idempotency keyed on `receiptId` |
| **External ERP** | `mapSupplierToErpnext()` | ERPNext export projection | Integration payload only; zero domain authority |

---

## 3. Authoritative Receiving → Stock Flow

```
Receive Request (poId, items, receiptId)
   │
   ▼
[1] Order Verification:
   ├── PO not found ──────────────▶ Return error: 'purchase_order_not_found'
   └── Status == 'cancelled' ─────▶ Return error: 'cancelled_purchase_order' (Strict Block)
   ▼
[2] Idempotency Guard:
   ├── stock_movements WHERE reference_id = receiptId exists ──▶ Return alreadyReceived=true (No-Op)
   └── Not found ─────────────────▼
[3] Validation Guard:
   ├── Item not in PO ────────────▶ Return error: 'supplier_item_mismatch'
   └── Qty <= 0 ──────────────────▶ Return error: 'invalid_received_quantity'
   ▼
[4] Atomic Stock Intake & Ledger Record:
   ├── UPDATE purchase_order_items: increment received_quantity
   ├── UPDATE ingredients: current_stock += qty, cost_per_unit = po.unit_price
   └── INSERT stock_movements: type='purchase_receipt', reference_id=receiptId
   ▼
[5] PO Status Transition:
   ├── All items fully received ──▶ status = 'received'
   └── Otherwise ─────────────────▶ status = 'partially_received'
```

---

## 4. Architectural Invariants

1. **Receiving as Sole Stock Gateway**: PO creation generates procurement documents without touching physical stock (`current_stock` remains untouched). Direct purchase $\rightarrow$ stock mutations bypassing receiving are strictly eliminated.
2. **Canonical Incoming Cost**: The unit purchase price recorded on the PO item is the canonical incoming cost, updating `ingredients.cost_per_unit` and immutably stamped onto `stock_movements`.
3. **Never Trust Client Totals**: Line total prices, subtotals, and document grand totals are computed server-side from canonical unit costs and quantities.
4. **Idempotent Receiving**: All receipts accept an optional unique `receiptId` (GRN key); retrying an identical receipt returns `alreadyReceived: true` without duplicating stock.
5. **Partial Receiving Support**: Tracks incremental item deliveries via `received_quantity`; PO transitions dynamically between `ordered`, `partially_received`, and `received`.
6. **Cancelled PO Integrity**: Cancelled purchase orders strictly prohibit receiving attempts (`cancelled_purchase_order`).
7. **Supplier/Item Guard**: Receiving rejects items that were not declared in the approved PO (`supplier_item_mismatch`).
8. **Adjustment Separation**: Manual inventory adjustments (`type: 'adjustment'`) remain completely decoupled from procurement and cannot reference purchase orders.
9. **ERPNext Decoupling**: ERPNext mappings are pure outward export projections and hold zero authority over internal domain states.

---

## 5. Verification Suite

All contract invariants verified in `worker/src/__tests__/integrations/purchasing-supplier-contract.test.ts`:
- `1. create PO: calculates server totals and leaves stock untouched`: PASS
- `2. partial receiving: increments stock and marks status partially_received`: PASS
- `3. full receiving: remaining quantity received transitions status to received`: PASS
- `4. duplicate receiving: idempotent receipt key prevents duplicate stock addition`: PASS
- `5. cancelled PO: strictly blocks stock receiving attempts`: PASS
- `6. supplier/item mismatch: rejects items not declared in PO`: PASS
- `7. incoming cost: incoming unit price updates master and records immutable ledger`: PASS
- `8. stock adjustment separation: adjustments do not conflict with PO receipts`: PASS
- `9. ERPNext mapping: exports canonical supplier to external ERP format`: PASS

---

## 6. Changed Files & Migration Status

- `packages/domain/inventory/src/policies/purchasing-receiving-policy.ts`: Authoritative purchasing, partial receiving, cancellation, and ERPNext projection policy.
- `packages/domain/inventory/src/routes/purchasing.ts`: Removed direct stock bypass on PO creation; routed through canonical policy.
- `packages/domain/inventory/index.ts`: Exported canonical purchasing functions and types.
- `worker/src/__tests__/integrations/purchasing-supplier-contract.test.ts`: Complete 9/9 verification test suite.
- **Migration Requirements**: None. Existing D1 schema (`suppliers`, `purchase_orders`, `purchase_order_items`, `ingredients`, `stock_movements`) is fully compatible and authoritative.
- **Blockers**: None.
