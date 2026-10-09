/**
 * Canonical Integration Boundary Types
 * Defines ports, adapters, normalized results, error classifications, and reconciliation models.
 */

export type IntegrationProvider =
  | 'erpnext'
  | 'payos'
  | 'zalo_zns'
  | 'speedsms'
  | 'resend'
  | 'web_push'
  | 'meta_pixel'
  | 'google_analytics';

export type NormalizedStatus = 'success' | 'pending' | 'failed' | 'rejected' | 'timeout';

export type IntegrationErrorType =
  | 'transient'
  | 'permanent'
  | 'auth_failure'
  | 'rate_limited'
  | 'signature_mismatch'
  | 'malformed_payload';

export type IntegrationSyncStatus = 'synced' | 'pending' | 'failed' | 'reconciled' | 'skipped';

export interface NormalizedIntegrationResult<T = unknown> {
  ok: boolean;
  provider: IntegrationProvider;
  externalId?: string | null;
  status: NormalizedStatus;
  errorType?: IntegrationErrorType | null;
  errorMessage?: string | null;
  data?: T | null;
  retryable: boolean;
  correlationId?: string | null;
  reconciliationRequired?: boolean;
}

export interface WebhookVerificationInput {
  provider: IntegrationProvider;
  rawPayload: unknown;
  signature?: string | null;
  secretKey?: string | null;
  idempotencyKey?: string | null;
}

export interface ReconciliationRecord {
  entityType: 'order' | 'product' | 'customer' | 'payment' | 'inventory';
  entityId: string;
  externalSystem: IntegrationProvider;
  externalId: string;
  lastSyncedAt: string;
  syncStatus: IntegrationSyncStatus;
  discrepancy?: string | null;
}

export interface IntegrationExecutionOptions {
  timeoutMs?: number;
  maxRetries?: number;
  correlationId?: string | null;
  tenantId?: string | null;
  operatingUnitId?: string | null;
}
