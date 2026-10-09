# Inventory / Recipe (BOM) Contract & Canonical Model

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-08  
**Scope**: Canonical Product → Recipe / BOM → Ingredient → Stock → Consumption → Cost Flow  

---

## 1. Canonical Flow Architecture

```
PRODUCT (products)
   │ (Catalog Master — owns identity, SKU, selling price)
   ▼
RECIPE / BOM (recipes, recipe_items)
   │ (Inventory Domain — specifies ingredient composition per unit)
   ▼
INGREDIENT (ingredients)
   │ (Inventory Domain — owns raw material master & cost_per_unit)
   ▼
STOCK (ingredients.current_stock)
   │ (Warehouse State of Truth — physical available inventory)
   ▼
CONSUMPTION (stock_movements: type='consumption')
   │ (Immutable Ledger Event — triggered server-side on order)
   ▼
COST & MARGIN (cost_per_unit × qty, Gross Margin)
     (Financial Derivation — Realized Revenue − Canonical COGS)
```

---

## 2. Entity Ownership Map

| Domain / Boundary | Tables / Entities | Authoritative Role | Non-Authority Constraints |
| :--- | :--- | :--- | :--- |
| **Catalog** | `products`, `categories` | Product Master, retail pricing, menu definitions | NEVER tracks raw material stock or BOM costs |
| **Inventory (BOM)** | `recipes`, `recipe_items` | Recipe specifications, ingredient ratios, unit conversions | References canonical `products.id` & `ingredients.id` |
| **Inventory (Master)**| `ingredients` | Raw materials, unit cost (`cost_per_unit`), current stock | NEVER modifies product selling prices |
| **Inventory (Ledger)**| `stock_movements` | Append-only historical movements (`consumption`, `adjustment`) | Immutable once written; idempotency keyed on `reference_id` |
| **Order Transaction** | `orders`, `order_items` | Sales transaction source of truth, immutable item snapshots | Never mutates BOM recipes retroactively |

---

## 3. Server-Authoritative Deduction Flow

```
Order Confirmed / Paid
   │
   ▼
[1] Idempotency Guard: Check stock_movements for order_id
   ├── Exists ───────────────▶ Return alreadyDeducted=true (No-Op)
   └── Not Found ────────────▼
[2] Server BOM Resolution: getCanonicalRecipe(product_id)
   ├── No BOM Found ─────────▶ Return 0 depletions (Never invent consumption)
   └── BOM Resolved ─────────▼
[3] Consumption Multiplier: recipe_items.qty × order_items.qty
   ▼
[4] Stock Check (when allowNegative=false):
   ├── available < needed ───▶ Return error: 'insufficient_stock'
   └── available >= needed ──▼
[5] Atomic Batch Execution:
   ├── UPDATE ingredients SET current_stock = current_stock - needed
   └── INSERT INTO stock_movements (id, ingredient_id, 'consumption', -needed, order_id, ...)
```

---

## 4. Kept vs Retired Models & Dual-Model Reconciliation

| Entity / Pathway | Decision | Migration / Reconciliation Strategy |
| :--- | :--- | :--- |
| **`ingredients`** | **KEPT (CANONICAL)** | Authoritative raw material table for BOM, current stock, and cost. |
| **`recipes` / `recipe_items`** | **KEPT (CANONICAL)** | Authoritative Bill of Materials binding products to ingredients. |
| **`stock_movements`** | **KEPT (CANONICAL)** | Authoritative immutable ledger for consumption, adjustments, and receipts. |
| **`inventory_items`** | **LEGACY (PRESERVED)** | Preserved for non-BOM retail merchandise; prioritized after BOM check. |
| **Client-Supplied BOM** | **REJECTED / RETIRED** | Never trust client quantities or unit costs; computed strictly server-side. |

---

## 5. Architectural Invariants

1. **Catalog Sovereignty**: `products` is the sole Catalog master. Inventory consumes `products.id` via foreign key reference.
2. **Server-Side BOM Resolution**: Order consumption derives strictly from server-side `recipes` + `recipe_items` joined to `ingredients`.
3. **Idempotent Stock Deduction**: Deductions verify prior entries in `stock_movements WHERE reference_id = order_id AND reference_type = 'order'`.
4. **Historical Immutability**: Historical `stock_movements` rows are append-only and remain unaltered if a recipe is subsequently modified.
5. **No Invented Depletions**: Products without recipes emit 0 consumption and 0 recipe cost.
6. **Cost / Margin Separation**: Selling price is derived from Catalog; inventory policy computes gross margin = `realized_revenue − total_recipe_cost`.

---

## 6. Verification Suite

All contract invariants verified in `worker/src/__tests__/integrations/inventory-recipe-contract.test.ts`:
- `1. product with multi-ingredient BOM`: PASS
- `2. product without BOM`: PASS
- `3. insufficient stock`: PASS
- `4. repeated order & duplicate deduction (idempotency)`: PASS
- `5. recipe change after historical order (immutability)`: PASS
- `6. cost & margin calculation`: PASS
- `7. foreign key integrity`: PASS
- `8. stock adjustment`: PASS
