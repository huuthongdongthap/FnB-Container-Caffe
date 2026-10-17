/**
 * Canonical Data Migration & Reconciliation Policies
 * Enforces authoritative source of truth, transformation invariants,
 * execution dependency ordering, and snapshot immutability.
 */

import type { MigrationManifest, EntityMappingRule } from '../model/migration-types';

export const CANONICAL_ENTITY_MAPPINGS: Record<string, EntityMappingRule> = {
  products_to_menu_items: {
    entityName: 'Product-to-Menu-Projection',
    sourceTable: 'products',
    targetTable: 'menu_items',
    canonicalOwner: 'catalog_products',
    keyType: 'TEXT_CANONICAL',
    transformStrategy: 'projection_sync',
    validationRules: [
      'Target menu_item.id MUST equal source product.id',
      'Price and category_id must match product master',
      'menu_items changes must NEVER overwrite products directly'
    ],
    supportsDryRun: true,
    rollbackStrategy: 'reverse_projection'
  },
  categories_and_modifiers: {
    entityName: 'Categories-and-Modifiers',
    sourceTable: 'categories',
    targetTable: 'categories',
    canonicalOwner: 'catalog_categories',
    keyType: 'TEXT_CANONICAL',
    transformStrategy: 'direct_copy',
    validationRules: [
      'Category IDs must be preserved as TEXT slugs/identifiers',
      'Modifier choices must link to valid modifier groups'
    ],
    supportsDryRun: true,
    rollbackStrategy: 'down_migration_sql'
  },
  orders_and_snapshots: {
    entityName: 'Orders-and-Snapshots',
    sourceTable: 'orders',
    targetTable: 'order_items',
    canonicalOwner: 'order_master',
    keyType: 'TEXT_CANONICAL',
    transformStrategy: 'immutable_snapshot',
    validationRules: [
      'Order line items must match orders.items JSON snapshot at creation time',
      'Future catalog price changes must NEVER alter historical order snapshots',
      'Every order_item.order_id must reference an existing order'
    ],
    supportsDryRun: true,
    rollbackStrategy: 'checkpoint_restore'
  },
  customers_visits_orders: {
    entityName: 'Customers-Visits-Orders',
    sourceTable: 'customers',
    targetTable: 'checkins',
    canonicalOwner: 'customer_master',
    keyType: 'TEXT_CANONICAL',
    transformStrategy: 'normalized_split',
    validationRules: [
      'Customer phone number must be normalized E.164 format',
      'Linking guest orders to customer must not alter snapshot order totals',
      'Visits/checkins must reference valid customer IDs or remain anonymous'
    ],
    supportsDryRun: true,
    rollbackStrategy: 'down_migration_sql'
  },
  payment_ledger: {
    entityName: 'Payment-Ledger-Reconciliation',
    sourceTable: 'payments',
    targetTable: 'payments',
    canonicalOwner: 'payment_ledger',
    keyType: 'TEXT_CANONICAL',
    transformStrategy: 'direct_copy',
    validationRules: [
      'Payment transaction_id must be unique across all records',
      'Total settled payments must match or reconcile with order total_amount',
      'Replayed payments must be rejected idempotently'
    ],
    supportsDryRun: true,
    rollbackStrategy: 'checkpoint_restore'
  },
  inventory_recipes_consumption: {
    entityName: 'Inventory-Recipes-Consumption',
    sourceTable: 'ingredients',
    targetTable: 'stock_movements',
    canonicalOwner: 'inventory_master',
    keyType: 'TEXT_CANONICAL',
    transformStrategy: 'normalized_split',
    validationRules: [
      'Stock movements are append-only; never overwrite past movements',
      'Recipe ingredient references must link to valid ingredient IDs',
      'Current stock must equal opening stock plus net movements'
    ],
    supportsDryRun: true,
    rollbackStrategy: 'down_migration_sql'
  },
  tenant_operating_unit_assignment: {
    entityName: 'Tenant-Operating-Unit-Assignment',
    sourceTable: 'orders',
    targetTable: 'orders',
    canonicalOwner: 'order_master',
    keyType: 'TEXT_CANONICAL',
    transformStrategy: 'direct_copy',
    validationRules: [
      'All records must have a valid tenant_id (default fallback to "default")',
      'Operating unit IDs must conform to franchise boundary rules'
    ],
    supportsDryRun: true,
    rollbackStrategy: 'down_migration_sql'
  }
};

export const CANONICAL_MIGRATION_EXECUTION_ORDER = [
  'categories',
  'modifier_groups',
  'modifier_choices',
  'products',
  'menu_items',
  'customers',
  'staff_shifts',
  'orders',
  'order_items',
  'payments',
  'ingredients',
  'stock_movements'
];

export const CANONICAL_MIGRATION_MANIFEST: MigrationManifest = {
  manifestId: 'manifest_20261009_canonical_reconciliation',
  version: '20261009_04',
  timestamp: '2026-10-09T13:00:00Z',
  description: 'Authoritative data migration and multi-domain reconciliation manifest for AURA OS',
  executionOrder: CANONICAL_MIGRATION_EXECUTION_ORDER,
  mappings: CANONICAL_ENTITY_MAPPINGS,
  preMigrationChecklist: [
    'Verify isolated staging database is online',
    'Execute pre-migration D1 backup export checkpoint',
    'Run Dry-Run reconciliation audit across all 7 domain mappings',
    'Assert 0 duplicate transaction_ids and 0 orphan order_items'
  ],
  reconciliationCriteria: {
    enforceForeignKeyIntegrity: true,
    requireZeroOrphanRecords: true,
    requireZeroDuplicateKeys: true,
    preserveHistoricalOrderSnapshots: true,
    reconcilePaymentAmounts: true
  }
};
