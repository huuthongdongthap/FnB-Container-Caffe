/**
 * ERPNext Client Factory
 * Functions to create client instances from environment variables or KV
 */

import { ErpnextClient, type ErpnextEnv } from './core';

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
  env: ErpnextEnv & { AUTH_KV?: import('@cloudflare/workers-types').KVNamespace }
): Promise<ErpnextClient | null> {
  // Try KV first (BYOK override)
  let url = env.ERPNEXT_URL;
  let apiKey = env.ERPNEXT_API_KEY;
  let apiSecret = env.ERPNEXT_API_SECRET;

  if (env.AUTH_KV) {
    try {
      const kvUrl = await env.AUTH_KV.get('erpnext:api_url');
      const kvKey = await env.AUTH_KV.get('erpnext:api_key');
      const kvSecret = await env.AUTH_KV.get('erpnext:api_secret');
      if (kvUrl && kvKey && kvSecret) {
        url = kvUrl;
        apiKey = kvKey;
        apiSecret = kvSecret;
      }
    } catch {
      // KV unavailable — fallback to env
    }
  }

  const syncEnabled = env.ERPNEXT_SYNC_ENABLED === 'true';

  if (!url || !apiKey || !apiSecret) {
    return null;
  }
  return new ErpnextClient({ url, apiKey, apiSecret, isMock: !syncEnabled });
}
