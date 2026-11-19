/**
 * Per-Tenant Merchant Payment Configuration Loader & Direct PayOS/VietQR Settlement.
 *
 * SECURITY RULE:
 * - Beverage money flows DIRECTLY to the merchant's own PayOS or VietQR account.
 * - Non-default tenants NEVER fall back to global `env.PAYOS_*` credentials!
 * - Only the flagship `'default'` tenant may fall back to legacy `env.PAYOS_*`.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import { decryptTenantSecret } from './tenant-secrets';

export interface TenantPaymentConfigRow {
  tenant_id: string;
  provider: 'vietqr' | 'payos' | string;
  payos_client_id_enc: string | null;
  payos_api_key_enc: string | null;
  payos_checksum_key_enc: string | null;
  key_version: number;
  bank_bin: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  is_active: number;
  updated_at: string | null;
}

export interface ResolvedMerchantPaymentConfig {
  tenantId: string;
  provider: 'payos' | 'vietqr' | 'unconfigured';
  payos?: {
    clientId: string;
    apiKey: string;
    checksumKey: string;
  };
  vietqr?: {
    bankBin: string;
    bankAccountNo: string;
    bankAccountName: string;
    bankName: string;
  };
}

export async function resolveMerchantPaymentConfig(
  db: D1Database,
  env: Env,
  tenantId: string
): Promise<ResolvedMerchantPaymentConfig> {
  const cleanTenant = String(tenantId || 'default').trim() || 'default';

  const row = await db
    .prepare(
      `SELECT tenant_id, provider, payos_client_id_enc, payos_api_key_enc, payos_checksum_key_enc,
              key_version, bank_bin, bank_account_no, bank_account_name, bank_name, is_active, updated_at
       FROM tenant_payment_configs
       WHERE tenant_id = ? AND COALESCE(is_active, 1) = 1
       LIMIT 1`
    )
    .bind(cleanTenant)
    .first<TenantPaymentConfigRow>()
    .catch(() => null);

  if (row) {
    if (
      row.provider === 'payos' &&
      row.payos_client_id_enc &&
      row.payos_api_key_enc &&
      row.payos_checksum_key_enc
    ) {
      const [clientId, apiKey, checksumKey] = await Promise.all([
        decryptTenantSecret(row.payos_client_id_enc, env.TENANT_SECRETS_KEY),
        decryptTenantSecret(row.payos_api_key_enc, env.TENANT_SECRETS_KEY),
        decryptTenantSecret(row.payos_checksum_key_enc, env.TENANT_SECRETS_KEY),
      ]);
      return {
        tenantId: cleanTenant,
        provider: 'payos',
        payos: { clientId, apiKey, checksumKey },
        ...(row.bank_bin && row.bank_account_no
          ? {
              vietqr: {
                bankBin: row.bank_bin,
                bankAccountNo: row.bank_account_no,
                bankAccountName: row.bank_account_name || '',
                bankName: row.bank_name || '',
              },
            }
          : {}),
      };
    }

    if (row.bank_bin && row.bank_account_no) {
      return {
        tenantId: cleanTenant,
        provider: 'vietqr',
        vietqr: {
          bankBin: row.bank_bin,
          bankAccountNo: row.bank_account_no,
          bankAccountName: row.bank_account_name || '',
          bankName: row.bank_name || '',
        },
      };
    }
  }

  // STRICT ISOLATION: Only flagship 'default' tenant may fall back to legacy global env.PAYOS_*
  if (cleanTenant === 'default') {
    if (env.PAYOS_CLIENT_ID && env.PAYOS_API_KEY && env.PAYOS_CHECKSUM_KEY) {
      return {
        tenantId: 'default',
        provider: 'payos',
        payos: {
          clientId: env.PAYOS_CLIENT_ID,
          apiKey: env.PAYOS_API_KEY,
          checksumKey: env.PAYOS_CHECKSUM_KEY,
        },
      };
    }
  }

  return {
    tenantId: cleanTenant,
    provider: 'unconfigured',
  };
}

export function buildVietQrImageUrl(params: {
  bankBin: string;
  bankAccountNo: string;
  bankAccountName: string;
  amountVnd: number;
  description: string;
}): string {
  const bank = encodeURIComponent(params.bankBin.trim());
  const acc = encodeURIComponent(params.bankAccountNo.trim());
  const amount = Math.max(0, Math.round(params.amountVnd));
  const addInfo = encodeURIComponent(params.description.slice(0, 50));
  const accountName = encodeURIComponent(params.bankAccountName.trim());
  return `https://img.vietqr.io/image/${bank}-${acc}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
}
