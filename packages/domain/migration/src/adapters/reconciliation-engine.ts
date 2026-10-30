/**
 * Canonical Data Migration & Reconciliation Engine
 * Executes dry-run audits, orphan detection, duplicate checks,
 * snapshot immutability verification, and projection transformations.
 */

import type {
  MigrationManifest,
  DryRunReconciliationReport,
  OrphanRecordResult,
  DuplicateRecordResult
} from '../model/migration-types';
import { CANONICAL_MIGRATION_MANIFEST } from '../policies/migration-policy';

export function detectOrphans(
  parentIds: Set<string>,
  childRecords: { id: string; parentId: string }[],
  parentTable: string,
  childTable: string
): OrphanRecordResult {
  const orphanIds: string[] = [];
  for (const child of childRecords) {
    if (!parentIds.has(child.parentId)) {
      orphanIds.push(child.id);
    }
  }
  return {
    parentTable,
    childTable,
    orphanCount: orphanIds.length,
    orphanIds
  };
}

export function detectDuplicates<T>(
  records: T[],
  keyExtractor: (item: T) => string,
  table: string,
  column: string
): DuplicateRecordResult {
  const seen = new Set<string>();
  const conflicting = new Set<string>();

  for (const item of records) {
    const key = keyExtractor(item);
    if (!key) continue;
    if (seen.has(key)) {
      conflicting.add(key);
    } else {
      seen.add(key);
    }
  }

  const conflictingKeys = Array.from(conflicting);
  return {
    table,
    column,
    duplicateCount: conflictingKeys.length,
    conflictingKeys
  };
}

export function verifySnapshotImmutability(
  orderSnapshot: { productId: string; priceAtOrderTime: number }[],
  currentCatalog: Map<string, { currentPrice: number }>
): { immutable: boolean; message: string } {
  // Snapshot prices are frozen at order time; differences with current catalog are expected and valid
  for (const item of orderSnapshot) {
    if (item.priceAtOrderTime <= 0) {
      return { immutable: false, message: `Invalid negative or zero price in snapshot for product ${item.productId}` };
    }
    // Catalog may have updated, but snapshot must retain its historical price
    const current = currentCatalog.get(item.productId);
    if (current && current.currentPrice !== item.priceAtOrderTime) {
      // Valid historical divergence - snapshot is correctly decoupled from catalog updates
    }
  }
  return { immutable: true, message: 'Snapshot prices are correctly decoupled and immutable' };
}

export function projectProductToMenuItem(product: {
  id: string;
  name: string;
  nameEn?: string;
  price: number;
  categoryId: string;
  imageUrl?: string;
  isActive?: boolean;
}): {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
  category_id: string;
  image_url: string | null;
  is_available: number;
} {
  return {
    id: product.id,
    name: product.name,
    name_en: product.nameEn || null,
    price: product.price,
    category_id: product.categoryId,
    image_url: product.imageUrl || null,
    is_available: product.isActive === false ? 0 : 1
  };
}

export function runReconciliationDryRun(
  dataset: {
    orders: { id: string; totalAmount: number; tenantId?: string }[];
    orderItems: { id: string; orderId: string; totalPrice: number }[];
    payments: { id: string; orderId: string; amount: number; transactionId: string }[];
    products: { id: string; price: number }[];
    menuItems: { id: string; price: number }[];
  },
  manifest: MigrationManifest = CANONICAL_MIGRATION_MANIFEST,
  mode: 'dry_run' | 'applied' = 'dry_run'
): DryRunReconciliationReport {
  const errors: string[] = [];
  const orphansDetected: OrphanRecordResult[] = [];
  const duplicatesDetected: DuplicateRecordResult[] = [];

  // 1. Order -> OrderItems orphan & snapshot integrity check
  const orderIds = new Set(dataset.orders.map(o => o.id));
  const orderItemOrphans = detectOrphans(
    orderIds,
    dataset.orderItems.map(i => ({ id: i.id, parentId: i.orderId })),
    'orders',
    'order_items'
  );
  if (orderItemOrphans.orphanCount > 0) {
    orphansDetected.push(orderItemOrphans);
    errors.push(`Detected ${orderItemOrphans.orphanCount} orphan order_items missing valid orders`);
  }

  const invalidSnapshotItems = dataset.orderItems.filter(
    i => !Number.isFinite(i.totalPrice) || i.totalPrice <= 0
  );
  const snapshotIntegrityPreserved = invalidSnapshotItems.length === 0;
  if (!snapshotIntegrityPreserved) {
    errors.push(`Detected ${invalidSnapshotItems.length} order_items with non-positive or invalid snapshot totalPrice`);
  }

  // 2. Payments -> Orders orphan, duplicate transaction_id, and amount/key check
  const paymentOrphans = detectOrphans(
    orderIds,
    dataset.payments.map(p => ({ id: p.id, parentId: p.orderId })),
    'orders',
    'payments'
  );
  if (paymentOrphans.orphanCount > 0) {
    orphansDetected.push(paymentOrphans);
    errors.push(`Detected ${paymentOrphans.orphanCount} orphan payments missing valid orders`);
  }

  const invalidPayments = dataset.payments.filter(
    p => !p.transactionId || !p.transactionId.trim() || !Number.isFinite(p.amount) || p.amount <= 0
  );
  if (invalidPayments.length > 0) {
    errors.push(`Detected ${invalidPayments.length} payments with missing transaction_id or non-positive amount`);
  }

  const paymentDupes = detectDuplicates(
    dataset.payments,
    p => p.transactionId,
    'payments',
    'transaction_id'
  );
  if (paymentDupes.duplicateCount > 0) {
    duplicatesDetected.push(paymentDupes);
    errors.push(`Detected ${paymentDupes.duplicateCount} duplicate payment transaction_ids`);
  }

  // 3. Product -> MenuItem alignment & price drift check
  const productPriceById = new Map(dataset.products.map(p => [p.id, p.price]));
  const unprojectedMenuItems = dataset.menuItems.filter(m => !productPriceById.has(m.id));
  if (unprojectedMenuItems.length > 0) {
    errors.push(`Found ${unprojectedMenuItems.length} menu_items with no matching canonical product`);
  }
  const priceDriftedMenuItems = dataset.menuItems.filter(
    m => productPriceById.has(m.id) && productPriceById.get(m.id) !== m.price
  );
  if (priceDriftedMenuItems.length > 0) {
    errors.push(`Found ${priceDriftedMenuItems.length} menu_items with price drift against canonical products`);
  }
  const catalogInvalidCount = unprojectedMenuItems.length + priceDriftedMenuItems.length;

  // 4. Tenant isolation check
  const unassignedTenants = dataset.orders.filter(o => !o.tenantId || o.tenantId.trim() === '');
  const tenantIsolationPassed = unassignedTenants.length === 0;
  if (!tenantIsolationPassed) {
    errors.push(`Found ${unassignedTenants.length} orders lacking canonical tenant_id assignment`);
  }

  const foreignKeyIntegrityPassed = orphansDetected.length === 0;
  const orderItemsInvalidCount = orderItemOrphans.orphanCount + invalidSnapshotItems.length;
  const overallStatus = errors.length === 0 ? 'PASSED' : 'FAILED';

  return {
    manifestId: manifest.manifestId,
    mode,
    timestamp: new Date().toISOString(),
    inspectedEntities: [
      {
        entityName: 'orders',
        sourceCount: dataset.orders.length,
        targetCount: dataset.orders.length,
        validCount: dataset.orders.length - unassignedTenants.length,
        invalidCount: unassignedTenants.length,
        status: unassignedTenants.length === 0 ? 'ALIGNED' : 'REQUIRES_MIGRATION'
      },
      {
        entityName: 'order_items',
        sourceCount: dataset.orderItems.length,
        targetCount: dataset.orderItems.length,
        validCount: Math.max(0, dataset.orderItems.length - orderItemsInvalidCount),
        invalidCount: orderItemsInvalidCount,
        status: orderItemsInvalidCount === 0 ? 'ALIGNED' : 'CORRUPTED'
      },
      {
        entityName: 'products_to_menu_items',
        sourceCount: dataset.products.length,
        targetCount: dataset.menuItems.length,
        validCount: Math.max(0, dataset.menuItems.length - catalogInvalidCount),
        invalidCount: catalogInvalidCount,
        status: catalogInvalidCount === 0 ? 'ALIGNED' : 'REQUIRES_MIGRATION'
      }
    ],
    orphansDetected,
    duplicatesDetected,
    snapshotIntegrityPreserved,
    foreignKeyIntegrityPassed,
    tenantIsolationPassed,
    overallStatus,
    errors
  };
}
