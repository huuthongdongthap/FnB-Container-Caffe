/**
 * Canonical Data Migration & Reconciliation Contract Test Suite
 * Verifies core migration and reconciliation invariants:
 * 1. Product -> Menu Item projection consistency
 * 2. Order -> Order Items and historical snapshot immutability
 * 3. Referential integrity and orphan record detection
 * 4. Duplicate transaction key detection
 * 5. Tenant/operating-unit isolation assignment
 * 6. Dry-run versus applied reconciliation reporting
 * 7. Repeatable / idempotent migration execution
 */

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_MIGRATION_MANIFEST,
  CANONICAL_ENTITY_MAPPINGS,
  detectOrphans,
  detectDuplicates,
  verifySnapshotImmutability,
  projectProductToMenuItem,
  runReconciliationDryRun
} from '@aura/domain-migration';

describe('Data Migration & Reconciliation — Canonical Contract Invariants', () => {
  // ── 1. Migration Manifest & Mapping Topology ──────────────────────────────
  it('enforces canonical entity ownership and execution order in manifest', () => {
    expect(CANONICAL_MIGRATION_MANIFEST.manifestId).toBeDefined();
    expect(CANONICAL_MIGRATION_MANIFEST.executionOrder.length).toBeGreaterThan(5);

    // Verify prioritized entity mappings
    expect(CANONICAL_ENTITY_MAPPINGS.products_to_menu_items!.canonicalOwner).toBe('catalog_products');
    expect(CANONICAL_ENTITY_MAPPINGS.orders_and_snapshots!.canonicalOwner).toBe('order_master');
    expect(CANONICAL_ENTITY_MAPPINGS.payment_ledger!.canonicalOwner).toBe('payment_ledger');
    expect(CANONICAL_ENTITY_MAPPINGS.customers_visits_orders!.canonicalOwner).toBe('customer_master');
    expect(CANONICAL_ENTITY_MAPPINGS.inventory_recipes_consumption!.canonicalOwner).toBe('inventory_master');
  });

  // ── 2. Product -> Menu Item Projection Transformation ─────────────────────
  it('projects canonical products to legacy menu items accurately and idempotently', () => {
    const canonicalProduct = {
      id: 'prod_cafe_sua_da',
      name: 'Cà Phê Sữa Đá Sa Đéc',
      nameEn: 'Sa Dec Iced Milk Coffee',
      price: 29000,
      categoryId: 'cat_coffee',
      imageUrl: 'https://images.auraspace.cafe/coffee.webp',
      isActive: true
    };

    const projection1 = projectProductToMenuItem(canonicalProduct);
    const projection2 = projectProductToMenuItem(canonicalProduct);

    expect(projection1).toEqual(projection2);
    expect(projection1.id).toBe('prod_cafe_sua_da');
    expect(projection1.name).toBe('Cà Phê Sữa Đá Sa Đéc');
    expect(projection1.price).toBe(29000);
    expect(projection1.category_id).toBe('cat_coffee');
    expect(projection1.is_available).toBe(1);
  });

  // ── 3. Historical Order Snapshot Immutability ─────────────────────────────
  it('preserves historical order snapshots regardless of catalog price changes', () => {
    const historicalSnapshot = [
      { productId: 'prod_matcha_latte', priceAtOrderTime: 35000 }
    ];

    // Current catalog has increased price to 42000
    const currentCatalog = new Map([
      ['prod_matcha_latte', { currentPrice: 42000 }]
    ]);

    const verification = verifySnapshotImmutability(historicalSnapshot, currentCatalog);
    expect(verification.immutable).toBe(true);
    expect(verification.message).toContain('decoupled and immutable');
  });

  // ── 4. Referential Integrity & Orphan Detection ───────────────────────────
  it('detects orphan child records during dataset inspection', () => {
    const parentOrderIds = new Set(['ord_1', 'ord_2']);
    const childItems = [
      { id: 'item_1', parentId: 'ord_1' },
      { id: 'item_2', parentId: 'ord_2' },
      { id: 'item_3', parentId: 'ord_999_missing' } // Orphan
    ];

    const orphanCheck = detectOrphans(parentOrderIds, childItems, 'orders', 'order_items');
    expect(orphanCheck.orphanCount).toBe(1);
    expect(orphanCheck.orphanIds).toEqual(['item_3']);
  });

  // ── 5. Duplicate Detection ────────────────────────────────────────────────
  it('detects duplicate payment transaction hashes to prevent fiscal collisions', () => {
    const payments = [
      { id: 'pay_1', transactionId: 'TXN_001' },
      { id: 'pay_2', transactionId: 'TXN_002' },
      { id: 'pay_3', transactionId: 'TXN_001' } // Duplicate
    ];

    const dupes = detectDuplicates(payments, p => p.transactionId, 'payments', 'transaction_id');
    expect(dupes.duplicateCount).toBe(1);
    expect(dupes.conflictingKeys).toContain('TXN_001');
  });

  // ── 6. Dry-Run Reconciliation Reporting ───────────────────────────────────
  it('generates comprehensive dry-run reconciliation report', () => {
    const cleanDataset = {
      orders: [{ id: 'ord_1', totalAmount: 50000, tenantId: 'default' }],
      orderItems: [{ id: 'item_1', orderId: 'ord_1', totalPrice: 50000 }],
      payments: [{ id: 'pay_1', orderId: 'ord_1', amount: 50000, transactionId: 'TXN_OK_1' }],
      products: [{ id: 'prod_1', price: 50000 }],
      menuItems: [{ id: 'prod_1', price: 50000 }]
    };

    const cleanReport = runReconciliationDryRun(cleanDataset);
    expect(cleanReport.overallStatus).toBe('PASSED');
    expect(cleanReport.foreignKeyIntegrityPassed).toBe(true);
    expect(cleanReport.tenantIsolationPassed).toBe(true);
    expect(cleanReport.errors.length).toBe(0);

    // Corrupted dataset
    const corruptedDataset = {
      orders: [{ id: 'ord_1', totalAmount: 50000, tenantId: '' }], // Missing tenant
      orderItems: [{ id: 'item_1', orderId: 'ord_999', totalPrice: 50000 }], // Orphan item
      payments: [
        { id: 'pay_1', orderId: 'ord_1', amount: 50000, transactionId: 'TXN_DUP' },
        { id: 'pay_2', orderId: 'ord_1', amount: 50000, transactionId: 'TXN_DUP' }
      ],
      products: [{ id: 'prod_1', price: 50000 }],
      menuItems: [{ id: 'prod_unlinked', price: 20000 }]
    };

    const errorReport = runReconciliationDryRun(corruptedDataset);
    expect(errorReport.overallStatus).toBe('FAILED');
    expect(errorReport.orphansDetected.length).toBeGreaterThan(0);
    expect(errorReport.duplicatesDetected.length).toBeGreaterThan(0);
    expect(errorReport.tenantIsolationPassed).toBe(false);

    // Orphan payments, non-positive snapshot price, blank transactionId, and catalog price drift
    const snapshotAndPriceDriftDataset = {
      orders: [{ id: 'ord_1', totalAmount: 50000, tenantId: 'default' }],
      orderItems: [{ id: 'item_1', orderId: 'ord_1', totalPrice: 0 }],
      payments: [
        { id: 'pay_orphan', orderId: 'ord_missing', amount: 50000, transactionId: 'TXN_ORPHAN' },
        { id: 'pay_blank', orderId: 'ord_1', amount: 0, transactionId: '   ' }
      ],
      products: [{ id: 'prod_1', price: 50000 }],
      menuItems: [{ id: 'prod_1', price: 45000 }]
    };

    const driftReport = runReconciliationDryRun(snapshotAndPriceDriftDataset);
    expect(driftReport.overallStatus).toBe('FAILED');
    expect(driftReport.snapshotIntegrityPreserved).toBe(false);
    expect(driftReport.foreignKeyIntegrityPassed).toBe(false);
    expect(driftReport.orphansDetected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentTable: 'orders',
          childTable: 'payments',
          orphanCount: 1,
          orphanIds: ['pay_orphan']
        })
      ])
    );
    expect(driftReport.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('non-positive or invalid snapshot totalPrice'),
        expect.stringContaining('orphan payments missing valid orders'),
        expect.stringContaining('missing transaction_id or non-positive amount'),
        expect.stringContaining('price drift against canonical products')
      ])
    );
  });
});
