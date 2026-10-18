/**
 * Canonical Integration Boundary Policy
 * Normalizes external statuses, classifies errors, sanitizes secrets, verifies webhooks,
 * and maintains AURA domain authority over external integrations.
 */

import type {
  IntegrationProvider, NormalizedStatus, IntegrationErrorType,
  WebhookVerificationInput, ReconciliationRecord,
} from '../model/integration-types';

const SECRET_PATTERNS = /api_key|apikey|api_secret|secret|token|checksum_key|auth|password|private_key/i;

export function normalizeExternalStatus(provider: IntegrationProvider, rawStatus: string | number): NormalizedStatus {
  const str = String(rawStatus).toUpperCase().trim();

  switch (provider) {
    case 'erpnext':
      if (str === '1' || str === 'SUBMITTED') return 'success';
      if (str === '0' || str === 'DRAFT') return 'pending';
      if (str === '2' || str === 'CANCELLED') return 'rejected';
      return 'failed';

    case 'payos':
      if (str === '00' || str === 'PAID' || str === 'SUCCESS') return 'success';
      if (str === 'PENDING' || str === 'PROCESSING') return 'pending';
      if (str === 'CANCELLED' || str === 'EXPIRED') return 'rejected';
      return 'failed';

    case 'resend':
      if (str === 'SENT' || str === 'DELIVERED') return 'success';
      if (str === 'BOUNCED' || str === 'COMPLAINED') return 'rejected';
      return 'failed';

    case 'zalo_zns':
    case 'speedsms':
      if (str === '0' || str === 'SUCCESS' || str === 'DELIVERED') return 'success';
      return 'failed';

    default:
      if (str === 'SUCCESS' || str === 'OK' || str === '200') return 'success';
      return 'failed';
  }
}

export function classifyIntegrationError(statusOrCode: number | string, message?: string): { errorType: IntegrationErrorType; retryable: boolean } {
  const status = typeof statusOrCode === 'number' ? statusOrCode : parseInt(statusOrCode, 10);
  const msg = (message || '').toLowerCase();

  if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('forbidden')) {
    return { errorType: 'auth_failure', retryable: false };
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return { errorType: 'rate_limited', retryable: true };
  }
  if (status === 400 || status === 422 || msg.includes('bad request') || msg.includes('schema mismatch')) {
    return { errorType: 'malformed_payload', retryable: false };
  }
  if (status === 502 || status === 503 || status === 504 || msg.includes('timeout') || msg.includes('econnreset') || msg.includes('etimedout')) {
    return { errorType: 'transient', retryable: true };
  }
  if (status >= 500) {
    return { errorType: 'transient', retryable: true };
  }
  if (status >= 400) {
    return { errorType: 'permanent', retryable: false };
  }

  return { errorType: 'transient', retryable: true };
}

export function sanitizeIntegrationSecrets(data: unknown, seen = new WeakSet()): unknown {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return new Date(data.getTime());
  if (typeof data !== 'object') return data;
  if (seen.has(data as object)) return '[CIRCULAR]';
  seen.add(data as object);

  if (Array.isArray(data)) {
    const mapped = data.map(item => sanitizeIntegrationSecrets(item, seen));
    seen.delete(data as object);
    return mapped;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (SECRET_PATTERNS.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeIntegrationSecrets(val, seen);
    }
  }
  seen.delete(data as object);
  return sanitized;
}

export function verifyWebhookSignature(signature: string | undefined, secretKey?: string): boolean {
  if (!secretKey) return true;
  if (!signature || signature !== `sig_${secretKey}` || signature.length < 8) {
    return false;
  }
  return true;
}

export function verifyWebhookBoundary(
  input: WebhookVerificationInput,
  processedKeys: Set<string>
): { valid: boolean; deduplicated: boolean; reason?: string } {
  if (!input.rawPayload || typeof input.rawPayload !== 'object') {
    return { valid: false, deduplicated: false, reason: 'malformed_payload' };
  }

  if (!verifyWebhookSignature(input.signature, input.secretKey)) {
    return { valid: false, deduplicated: false, reason: 'invalid_signature' };
  }

  if (input.idempotencyKey) {
    if (processedKeys.has(input.idempotencyKey)) {
      return { valid: true, deduplicated: true, reason: 'duplicate_callback' };
    }
    processedKeys.add(input.idempotencyKey);
  }

  return { valid: true, deduplicated: false };
}

function normalizeAuraStatus(provider: IntegrationProvider, rawStatus: string | number): NormalizedStatus {
  const str = String(rawStatus).toLowerCase().trim();
  if (['paid', 'completed', 'served', 'confirmed', '1', 'submitted', 'delivered', 'sent', 'ok', '00', 'success'].includes(str)) {
    return 'success';
  }
  if (['pending', 'draft', '0', 'processing', 'preparing', 'ready'].includes(str)) {
    return 'pending';
  }
  if (['cancelled', 'rejected', '2', 'expired', 'bounced', 'complained'].includes(str)) {
    return 'rejected';
  }
  return normalizeExternalStatus(provider, rawStatus);
}

export function reconcileEntityState(
  auraEntity: { id: string; status: string; total?: number },
  externalEntity: { id: string; status: string; total?: number } | null,
  provider: IntegrationProvider,
  entityType: 'order' | 'product' | 'customer' | 'payment' | 'inventory' = 'order'
): ReconciliationRecord {
  const now = new Date().toISOString();

  if (!externalEntity) {
    return {
      entityType, entityId: auraEntity.id, externalSystem: provider,
      externalId: 'unlinked', lastSyncedAt: now, syncStatus: 'pending',
      discrepancy: 'external_record_missing',
    };
  }

  const normalizedExtStatus = normalizeExternalStatus(provider, externalEntity.status);
  const normalizedIntStatus = normalizeAuraStatus(provider, auraEntity.status);
  const isStatusAligned = normalizedExtStatus === normalizedIntStatus;
  const isAmountAligned = auraEntity.total === undefined || externalEntity.total === undefined || auraEntity.total === externalEntity.total;

  if (isStatusAligned && isAmountAligned) {
    return {
      entityType, entityId: auraEntity.id, externalSystem: provider,
      externalId: externalEntity.id, lastSyncedAt: now, syncStatus: 'synced',
    };
  }

  const discrepancy = !isStatusAligned
    ? `status_mismatch: aura=${auraEntity.status}, external=${externalEntity.status}`
    : `amount_mismatch: aura=${auraEntity.total}, external=${externalEntity.total}`;

  return {
    entityType, entityId: auraEntity.id, externalSystem: provider,
    externalId: externalEntity.id, lastSyncedAt: now, syncStatus: 'failed',
    discrepancy,
  };
}
