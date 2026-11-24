import { createLogger } from '../../utils/logger.js';
import type { MixpostEnv } from './types';

const log = createLogger({ route: 'mixpost:account-policy' });

export function parseAccountIdList(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => Number(item))
      .filter((n) => Number.isInteger(n) && n > 0);
  }
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? [raw] : [];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        return parseAccountIdList(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }
    return trimmed
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
  }
  return [];
}

export interface TenantMixpostAccountPolicy {
  isAccountAllowed: (accountId: number) => boolean;
}

export async function resolveTenantMixpostAccountPolicy(
  env: MixpostEnv,
  rawTenantId: string
): Promise<TenantMixpostAccountPolicy> {
  const trimmedTenant = rawTenantId.trim();
  const tenantId =
    trimmedTenant.toLowerCase() === 'hq' ? '*' : trimmedTenant || 'default';

  if (tenantId === '*') {
    return { isAccountAllowed: (id) => Number.isInteger(id) && id > 0 };
  }

  const tenantMap = new Map<string, Set<number>>();
  const rawEnvJson =
    typeof env.MIXPOST_TENANT_ACCOUNTS_JSON === 'string'
      ? env.MIXPOST_TENANT_ACCOUNTS_JSON.trim()
      : '';
  if (rawEnvJson) {
    try {
      const parsed = JSON.parse(rawEnvJson) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        log.warn('mixpost_invalid_tenant_accounts_json');
        return { isAccountAllowed: () => false };
      }
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const normKey = k.trim();
        if (!normKey) continue;
        tenantMap.set(normKey, new Set(parseAccountIdList(v)));
      }
    } catch {
      log.warn('mixpost_invalid_tenant_accounts_json');
      return { isAccountAllowed: () => false };
    }
  }

  if (env.AURA_DB) {
    for (const table of ['settings', 'tenant_settings'] as const) {
      try {
        const res = await env.AURA_DB
          .prepare(
            `SELECT tenant_id, key, value FROM ${table} WHERE key = 'mixpost_account_ids'`
          )
          .bind()
          .all<{ tenant_id?: string | null; key?: unknown; value?: unknown }>();
        for (const row of res?.results ?? []) {
          if (row && 'key' in row && row.key !== undefined && String(row.key) !== 'mixpost_account_ids') {
            continue;
          }
          const rowTenant = String(row?.tenant_id ?? '').trim() || 'default';
          if (row?.value !== undefined && row?.value !== null) {
            tenantMap.set(rowTenant, new Set(parseAccountIdList(row.value)));
          }
        }
      } catch {
        // Table absent or query unsupported in mock
      }
      if (!tenantMap.has(tenantId)) {
        try {
          const single = await env.AURA_DB
            .prepare(
              `SELECT key, value FROM ${table} WHERE key = 'mixpost_account_ids' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1`
            )
            .bind(tenantId)
            .first<{ key?: unknown; value?: unknown }>();
          if (
            single &&
            (!('key' in single) || single.key === undefined || String(single.key) === 'mixpost_account_ids') &&
            single.value !== undefined &&
            single.value !== null
          ) {
            tenantMap.set(tenantId, new Set(parseAccountIdList(single.value)));
          }
        } catch {
          // Table absent or first() unsupported
        }
      }
    }
  }

  if (tenantMap.has(tenantId)) {
    const allowed = tenantMap.get(tenantId)!;
    return {
      isAccountAllowed: (id) => Number.isInteger(id) && id > 0 && allowed.has(id)
    };
  }

  // Non-default concrete tenants fail closed when no explicit account ownership mapping exists
  if (tenantId !== 'default') {
    return { isAccountAllowed: () => false };
  }

  // Default tenant excludes any account explicitly owned by another tenant
  if (tenantMap.size > 0) {
    const reservedByOtherTenants = new Set<number>();
    for (const [mappedTenant, ids] of tenantMap.entries()) {
      if (mappedTenant !== 'default') {
        for (const id of ids) {
          reservedByOtherTenants.add(id);
        }
      }
    }
    return {
      isAccountAllowed: (id) =>
        Number.isInteger(id) && id > 0 && !reservedByOtherTenants.has(id)
    };
  }

  return {
    isAccountAllowed: (id) => Number.isInteger(id) && id > 0
  };
}
