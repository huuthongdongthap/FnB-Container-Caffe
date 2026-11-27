/**
 * ERPNext Client Factory
 * Functions to create client instances from environment variables or KV
 */

import { ErpnextClient, type ErpnextEnv } from './core';
import { decryptTenantSecretOrPlaintext } from '../../lib/tenant-secrets';

export function createErpnextClient(env: ErpnextEnv): ErpnextClient | null {
  if (!env.ERPNEXT_URL || !env.ERPNEXT_API_KEY || !env.ERPNEXT_API_SECRET) {
    return null;
  }
  return new ErpnextClient({
    url: env.ERPNEXT_URL,
    apiKey: env.ERPNEXT_API_KEY,
    apiSecret: env.ERPNEXT_API_SECRET,
    isMock: env.ERPNEXT_SYNC_ENABLED !== 'true'
  });
}

export async function createErpnextClientWithKv(
  env: ErpnextEnv & {
    AUTH_KV?: import('@cloudflare/workers-types').KVNamespace;
    TENANT_SECRETS_KEY?: string;
    JWT_SECRET?: string;
  },
  tenantId?: string,
): Promise<ErpnextClient | null> {
  const effectiveTenant = tenantId && tenantId.trim() && tenantId.trim() !== '*' ? tenantId.trim() : 'default';
  let url = env.ERPNEXT_URL;
  let apiKey = env.ERPNEXT_API_KEY;
  let apiSecret = env.ERPNEXT_API_SECRET;

  if (env.AUTH_KV) {
    let kvUrl: string | null = null;
    let kvKey: string | null = null;
    let kvSecret: string | null = null;
    let kvReadFailed = false;
    try {
      const prefix = effectiveTenant === 'default' ? 'erpnext' : `erpnext:${effectiveTenant}`;
      kvUrl = await env.AUTH_KV.get(`${prefix}:api_url`);
      kvKey = await env.AUTH_KV.get(`${prefix}:api_key`);
      kvSecret = await env.AUTH_KV.get(`${prefix}:api_secret`);
      if (!(kvUrl && kvKey && kvSecret) && effectiveTenant !== 'default') {
        const defaultKvUrl = await env.AUTH_KV.get('erpnext:api_url');
        if (defaultKvUrl) {
          return null;
        }
      }
    } catch {
      kvReadFailed = true;
      // KV unavailable — fallback to env
    }

    if (!kvReadFailed && kvUrl && kvKey && kvSecret) {
      const masterKey = env.TENANT_SECRETS_KEY || env.JWT_SECRET;
      try {
        const [plainKey, plainSecret] = await Promise.all([
          decryptTenantSecretOrPlaintext(kvKey, masterKey, effectiveTenant),
          decryptTenantSecretOrPlaintext(kvSecret, masterKey, effectiveTenant),
        ]);
        url = kvUrl;
        apiKey = plainKey;
        apiSecret = plainSecret;
      } catch {
        // Fail closed when stored KV credentials cannot be decrypted.
        return null;
      }
    }
  }

  const syncEnabled = env.ERPNEXT_SYNC_ENABLED === 'true';

  if (!url || !apiKey || !apiSecret) {
    return null;
  }
  return new ErpnextClient({ url, apiKey, apiSecret, isMock: !syncEnabled });
}
