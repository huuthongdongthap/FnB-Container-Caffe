import { ENVIRONMENTS } from '@aura/domain-deployment';
import type { Env } from '../types/env';

const PAYOS_WEBHOOK_PREFIX = '/api/webhook/payos/';

/** Uses existing deployment configuration, never incoming Host/Origin or a Pages URL. */
export function resolveTrustedWorkerOrigin(env?: Pick<Env, 'ENVIRONMENT'>): string {
  const envName = typeof env?.ENVIRONMENT === 'string' ? env.ENVIRONMENT.trim().toLowerCase() : '';
  if (envName === 'staging') {
    return ENVIRONMENTS.staging.workerUrl;
  }
  if (envName === 'local' || envName === 'development') {
    return ENVIRONMENTS.local.workerUrl;
  }
  if (envName === 'test') {
    return ENVIRONMENTS.test.workerUrl;
  }
  return ENVIRONMENTS.production.workerUrl;
}

export interface MerchantPayosWebhookUrls {
  webhookUrl: string;
  webhookUrlPath: string;
}

/**
 * Builds both the backward-compatible relative path and the direct Worker URL
 * for a tenant's PayOS merchant webhook endpoint, percent-encoding the slug.
 */
export function buildMerchantPayosWebhookUrls(
  env: Partial<Env> | undefined,
  rawSlug: string,
): MerchantPayosWebhookUrls {
  const cleanSlug = String(rawSlug || '').trim() || 'default';
  const encodedSlug = encodeURIComponent(cleanSlug);
  const webhookUrlPath = `${PAYOS_WEBHOOK_PREFIX}${encodedSlug}`;
  const origin = resolveTrustedWorkerOrigin(env);
  return {
    webhookUrl: `${origin}${webhookUrlPath}`,
    webhookUrlPath,
  };
}
