/**
 * Canonical Integration Boundary Adapter
 * Wraps external calls with bounded timeouts, error classification, retry checks,
 * correlation tracking, and non-interference with internal transactions.
 */

import type {
  IntegrationProvider, NormalizedIntegrationResult, IntegrationExecutionOptions,
} from '../model/integration-types';
import {
  classifyIntegrationError, normalizeExternalStatus, sanitizeIntegrationSecrets,
} from '../policies/integration-boundary-policy';

export interface ExternalCallerFn<T = unknown> {
  (signal?: AbortSignal): Promise<{ rawStatus: string | number; externalId?: string; data?: T }>;
}

export async function executeExternalIntegration<T = unknown>(
  provider: IntegrationProvider,
  action: string,
  caller: ExternalCallerFn<T>,
  options?: IntegrationExecutionOptions
): Promise<NormalizedIntegrationResult<T>> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const correlationId = options?.correlationId || `corr_ext_${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await caller(controller.signal);
    clearTimeout(timer);

    const normStatus = normalizeExternalStatus(provider, res.rawStatus);
    const ok = normStatus === 'success';

    return {
      ok,
      provider,
      externalId: res.externalId || null,
      status: normStatus,
      data: res.data ? (sanitizeIntegrationSecrets(res.data) as T) : null,
      retryable: !ok && normStatus !== 'rejected',
      correlationId,
      reconciliationRequired: !ok,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const isTimeout = err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('timeout');
    const classification = classifyIntegrationError(isTimeout ? 504 : 500, err?.message);

    return {
      ok: false,
      provider,
      status: isTimeout ? 'timeout' : 'failed',
      errorType: classification.errorType,
      errorMessage: `external_${provider}_${action}_failed: ${err?.message || 'unknown_error'}`,
      retryable: classification.retryable,
      correlationId,
      reconciliationRequired: true,
    };
  }
}
