/**
 * Canonical Data Migration & Reconciliation Domain Models
 * Defines types for entity source-of-truth mappings, migration manifests,
 * dry-run audit reports, and integrity reconciliation rules.
 */

export type CanonicalOwnerType =
  | 'catalog_products'
  | 'catalog_categories'
  | 'catalog_modifiers'
  | 'order_master'
  | 'payment_ledger'
  | 'customer_master'
  | 'inventory_master'
  | 'shift_pos'
  | 'table_reservation';

export interface EntityMappingRule {
  entityName: string;
  sourceTable: string;
  targetTable: string;
  canonicalOwner: CanonicalOwnerType;
  keyType: 'TEXT_CANONICAL' | 'TEXT_UUID' | 'NUMERIC_DEPRECATED';
  transformStrategy: 'direct_copy' | 'projection_sync' | 'normalized_split' | 'immutable_snapshot';
  validationRules: string[];
  supportsDryRun: boolean;
  rollbackStrategy: 'down_migration_sql' | 'reverse_projection' | 'checkpoint_restore';
}

export interface MigrationManifest {
  manifestId: string;
  version: string;
  timestamp: string;
  description: string;
  executionOrder: string[];
  mappings: Record<string, EntityMappingRule>;
  preMigrationChecklist: string[];
  reconciliationCriteria: {
    enforceForeignKeyIntegrity: boolean;
    requireZeroOrphanRecords: boolean;
    requireZeroDuplicateKeys: boolean;
    preserveHistoricalOrderSnapshots: boolean;
    reconcilePaymentAmounts: boolean;
  };
}

export interface OrphanRecordResult {
  parentTable: string;
  childTable: string;
  orphanCount: number;
  orphanIds: string[];
}

export interface DuplicateRecordResult {
  table: string;
  column: string;
  duplicateCount: number;
  conflictingKeys: string[];
}

export interface DryRunReconciliationReport {
  manifestId: string;
  mode: 'dry_run' | 'applied';
  timestamp: string;
  inspectedEntities: {
    entityName: string;
    sourceCount: number;
    targetCount: number;
    validCount: number;
    invalidCount: number;
    status: 'ALIGNED' | 'REQUIRES_MIGRATION' | 'CORRUPTED';
  }[];
  orphansDetected: OrphanRecordResult[];
  duplicatesDetected: DuplicateRecordResult[];
  snapshotIntegrityPreserved: boolean;
  foreignKeyIntegrityPassed: boolean;
  tenantIsolationPassed: boolean;
  overallStatus: 'PASSED' | 'WARNING' | 'FAILED';
  errors: string[];
}
