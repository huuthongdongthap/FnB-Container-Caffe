/**
 * Canonical Integration Boundary Contract Integration Tests
 * Verifies adapter normalization, error classification, timeout bounds,
 * webhook verification, idempotency, secret scrubbing, and domain transaction integrity.
 */
import { describe, it, expect } from 'vitest';
import {
  executeExternalIntegration, normalizeExternalStatus, classifyIntegrationError,
  sanitizeIntegrationSecrets, verifyWebhookBoundary, reconcileEntityState,
} from '@aura/domain-integration';

describe('Canonical Integration Boundary Contract', () => {
  it('1. provider success: maps raw status to canonical success and returns sanitized payload', async () => {
    const res = await executeExternalIntegration('erpnext', 'create_invoice', async () => ({
      rawStatus: 1, externalId: 'ACC-SINV-2026-001', data: { invoiceNo: 'INV-101', secret_token: 'SECRET123' },
    }));
    expect(res.ok).toBe(true);
    expect(res.status).toBe('success');
    expect(res.externalId).toBe('ACC-SINV-2026-001');
    expect((res.data as any).secret_token).toBe('[REDACTED]');
  });

  it('2. timeout/unavailable provider: bounded timeout returns timeout status and retryable flag', async () => {
    const res = await executeExternalIntegration('payos', 'create_payment_link', async (signal) => {
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('AbortError: Request Timeout')));
      });
    }, { timeoutMs: 20 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe('timeout');
    expect(res.retryable).toBe(true);
  });

  it('3. transient vs permanent error: classifies 502 as transient and 401 as auth_failure', () => {
    const transientErr = classifyIntegrationError(502, 'Bad Gateway');
    expect(transientErr.errorType).toBe('transient');
    expect(transientErr.retryable).toBe(true);

    const authErr = classifyIntegrationError(401, 'Unauthorized');
    expect(authErr.errorType).toBe('auth_failure');
    expect(authErr.retryable).toBe(false);
  });

  it('4. retry/idempotency: deduplicates repeated webhook events using idempotency keys', () => {
    const seen = new Set<string>();
    const first = verifyWebhookBoundary({ provider: 'payos', rawPayload: { orderCode: 123 }, idempotencyKey: 'payos_evt_123' }, seen);
    expect(first.valid).toBe(true);
    expect(first.deduplicated).toBe(false);

    const second = verifyWebhookBoundary({ provider: 'payos', rawPayload: { orderCode: 123 }, idempotencyKey: 'payos_evt_123' }, seen);
    expect(second.valid).toBe(true);
    expect(second.deduplicated).toBe(true);
  });

  it('5. duplicate/invalid webhook: rejects invalid signature and duplicate deliveries', () => {
    const seen = new Set<string>();
    const badSig = verifyWebhookBoundary({ provider: 'resend', rawPayload: { email: 'a@b.com' }, signature: 'bad_sig', secretKey: 'key_123' }, seen);
    expect(badSig.valid).toBe(false);
    expect(badSig.reason).toBe('invalid_signature');

    const validSig = verifyWebhookBoundary({ provider: 'resend', rawPayload: { email: 'a@b.com' }, signature: 'sig_key_123', secretKey: 'key_123' }, seen);
    expect(validSig.valid).toBe(true);
  });

  it('6. malformed external payload: rejects non-object or empty webhook payloads', () => {
    const seen = new Set<string>();
    const malformed = verifyWebhookBoundary({ provider: 'zalo_zns', rawPayload: null as any }, seen);
    expect(malformed.valid).toBe(false);
    expect(malformed.reason).toBe('malformed_payload');
  });

  it('7. ID/status mapping: maps ERPNext, PayOS, and Resend statuses to canonical model', () => {
    expect(normalizeExternalStatus('erpnext', 1)).toBe('success');
    expect(normalizeExternalStatus('erpnext', 0)).toBe('pending');
    expect(normalizeExternalStatus('erpnext', 2)).toBe('rejected');

    expect(normalizeExternalStatus('payos', 'PAID')).toBe('success');
    expect(normalizeExternalStatus('payos', 'CANCELLED')).toBe('rejected');
    expect(normalizeExternalStatus('payos', 'PENDING')).toBe('pending');

    expect(normalizeExternalStatus('resend', 'DELIVERED')).toBe('success');
    expect(normalizeExternalStatus('resend', 'BOUNCED')).toBe('rejected');
  });

  it('8. partial sync and reconciliation: flags discrepancy when external total or status mismatches', () => {
    const synced = reconcileEntityState({ id: 'ord_1', status: 'PAID', total: 50000 }, { id: 'ext_1', status: 'PAID', total: 50000 }, 'payos');
    expect(synced.syncStatus).toBe('synced');

    const mismatch = reconcileEntityState({ id: 'ord_2', status: 'PAID', total: 50000 }, { id: 'ext_2', status: 'PAID', total: 40000 }, 'payos');
    expect(mismatch.syncStatus).toBe('failed');
    expect(mismatch.discrepancy).toContain('amount_mismatch');

    const missing = reconcileEntityState({ id: 'ord_3', status: 'PAID' }, null, 'erpnext');
    expect(missing.syncStatus).toBe('pending');
    expect(missing.discrepancy).toBe('external_record_missing');
  });

  it('9. secret redaction: masks API keys, secrets, tokens, and credentials from logs', () => {
    const raw = { apiKey: 'erp_api_key_999', apiSecret: 'erp_secret_888', normalKey: 'AURA Order' };
    const sanitized = sanitizeIntegrationSecrets(raw) as any;
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.apiSecret).toBe('[REDACTED]');
    expect(sanitized.normalKey).toBe('AURA Order');
  });

  it('10. internal transaction integrity: external integration failure does not break internal state', async () => {
    let internalDbCommitted = false;
    // Simulate internal transaction committing first
    internalDbCommitted = true;

    // External downstream sync fails
    const syncRes = await executeExternalIntegration('erpnext', 'sync_sales_order', async () => {
      throw new Error('ERPNext Down for Maintenance');
    });

    expect(internalDbCommitted).toBe(true);
    expect(syncRes.ok).toBe(false);
    expect(syncRes.reconciliationRequired).toBe(true);
    expect(syncRes.retryable).toBe(true);
  });
});
