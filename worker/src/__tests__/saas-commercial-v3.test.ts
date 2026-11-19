/**
 * SaaS Commercial v3 Verification Suite
 *
 * Covers:
 * 1. Canonical plans & server-side pricing (Starter/Pro/Chain, annual 20% off)
 * 2. Lifecycle state machine (trial -> grace -> readonly -> suspended, flagship immunity)
 * 3. AES-256-GCM encryption/decryption & PayOS HMAC-SHA256 verification
 * 4. Strict merchant payment isolation (non-default tenants NEVER fall back to flagship PayOS keys)
 * 5. Self-serve slug normalization & reserved slug protection
 */

import { describe, expect, it } from 'vitest';
import {
  SAAS_PLANS,
  calculatePlanAmountVnd,
  normalizeBillingCycle,
  normalizeSaasPlanId,
} from '../lib/saas-plans';
import { resolveTenantLifecycle } from '../lib/saas-entitlement';
import {
  computeHmacSha256Hex,
  decryptTenantSecret,
  encryptTenantSecret,
  maskSecretValue,
  verifyPayosSignature,
} from '../lib/tenant-secrets';
import { buildVietQrImageUrl, resolveMerchantPaymentConfig } from '../lib/merchant-payment';
import { sanitizeSlug, validateSlug } from '../lib/saas-provisioning';
import { SAAS_TEMPLATE_LIST } from '../lib/saas-templates';

describe('SaaS Commercial v3 — Plans & Pricing', () => {
  it('computes exact server-side monthly and 20%-off annual pricing', () => {
    expect(calculatePlanAmountVnd('starter', 'monthly')).toBe(199_000);
    expect(calculatePlanAmountVnd('pro', 'monthly')).toBe(499_000);
    expect(calculatePlanAmountVnd('chain', 'monthly')).toBe(1_290_000);

    expect(calculatePlanAmountVnd('starter', 'annual')).toBe(SAAS_PLANS.starter.annualPriceVnd);
    expect(calculatePlanAmountVnd('pro', 'annual')).toBe(SAAS_PLANS.pro.annualPriceVnd);
    expect(calculatePlanAmountVnd('chain', 'annual')).toBe(SAAS_PLANS.chain.annualPriceVnd);
  });

  it('maps legacy tier aliases to canonical plan IDs', () => {
    expect(normalizeSaasPlanId('basic')).toBe('starter');
    expect(normalizeSaasPlanId('premium')).toBe('pro');
    expect(normalizeSaasPlanId('enterprise')).toBe('chain');
    expect(normalizeBillingCycle('yearly')).toBe('annual');
  });

  it('ships 4 complete F&B storefront templates', () => {
    expect(SAAS_TEMPLATE_LIST).toHaveLength(4);
    for (const tpl of SAAS_TEMPLATE_LIST) {
      expect(tpl.categories.length).toBeGreaterThanOrEqual(2);
      expect(tpl.products.length).toBeGreaterThanOrEqual(4);
      expect(tpl.tables.length).toBeGreaterThanOrEqual(3);
      expect(tpl.shifts.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('SaaS Commercial v3 — Lifecycle State Machine', () => {
  const now = new Date('2026-11-20T00:00:00.000Z');

  it('keeps flagship default tenant immune to expiry', () => {
    const ent = resolveTenantLifecycle(
      {
        tenant_id: 'default',
        tier: 'starter',
        status: 'expired',
        trial_ends_at: '2020-01-01T00:00:00.000Z',
      },
      now
    );
    expect(ent.lifecycleState).toBe('active');
    expect(ent.isReadOnly).toBe(false);
    expect(ent.maxTables).toBeNull();
  });

  it('grants full Pro access during active 14-day trial', () => {
    const ent = resolveTenantLifecycle(
      {
        tenant_id: 'ten_cafe_1',
        tier: 'starter',
        status: 'trial',
        trial_ends_at: '2026-11-30T00:00:00.000Z',
        grace_ends_at: '2026-12-03T00:00:00.000Z',
      },
      now
    );
    expect(ent.lifecycleState).toBe('trial');
    expect(ent.fullAccessTrial).toBe(true);
    expect(ent.isReadOnly).toBe(false);
  });

  it('transitions expired trial into 3-day grace window, then readonly', () => {
    const inGrace = resolveTenantLifecycle(
      {
        tenant_id: 'ten_cafe_1',
        tier: 'starter',
        status: 'trial',
        trial_ends_at: '2026-11-19T00:00:00.000Z',
        grace_ends_at: '2026-11-22T00:00:00.000Z',
      },
      now
    );
    expect(inGrace.lifecycleState).toBe('grace');
    expect(inGrace.isReadOnly).toBe(false);

    const readOnly = resolveTenantLifecycle(
      {
        tenant_id: 'ten_cafe_1',
        tier: 'starter',
        status: 'trial',
        trial_ends_at: '2026-11-10T00:00:00.000Z',
        grace_ends_at: '2026-11-13T00:00:00.000Z',
      },
      now
    );
    expect(readOnly.lifecycleState).toBe('readonly');
    expect(readOnly.isReadOnly).toBe(true);
  });
});

describe('SaaS Commercial v3 — AES-256-GCM Secrets & Merchant Payment Isolation', () => {
  const masterKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('round-trips encrypted merchant PayOS secrets with unique IVs', async () => {
    const enc1 = await encryptTenantSecret('payos-secret-value-12345', masterKey);
    const enc2 = await encryptTenantSecret('payos-secret-value-12345', masterKey);
    expect(enc1).not.toBe(enc2);
    expect(enc1.startsWith('v1:')).toBe(true);
    expect(await decryptTenantSecret(enc1, masterKey)).toBe('payos-secret-value-12345');
    expect(maskSecretValue('payos-secret-value-12345')).toBe('pay••••345');
  });

  it('verifies PayOS HMAC-SHA256 signatures accurately', async () => {
    const checksumKey = 'test-checksum-key';
    const data = { orderCode: 123456, amount: 499000, code: '00' };
    const canonical = 'amount=499000&code=00&orderCode=123456';
    const sig = await computeHmacSha256Hex(checksumKey, canonical);
    expect(await verifyPayosSignature(data, sig, checksumKey)).toBe(true);
    expect(await verifyPayosSignature(data, '0'.repeat(64), checksumKey)).toBe(false);
  });

  it('NEVER falls back to flagship PAYOS env secrets for non-default tenants', async () => {
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
        }),
      }),
    } as unknown as D1Database;

    const envWithFlagshipPayos = {
      PAYOS_CLIENT_ID: 'flagship-client',
      PAYOS_API_KEY: 'flagship-api',
      PAYOS_CHECKSUM_KEY: 'flagship-checksum',
      TENANT_SECRETS_KEY: masterKey,
    } as any;

    const thirdParty = await resolveMerchantPaymentConfig(mockDb, envWithFlagshipPayos, 'ten_other_shop');
    expect(thirdParty.provider).toBe('unconfigured');
    expect(thirdParty.payos).toBeUndefined();

    const flagship = await resolveMerchantPaymentConfig(mockDb, envWithFlagshipPayos, 'default');
    expect(flagship.provider).toBe('payos');
    expect(flagship.payos?.clientId).toBe('flagship-client');
  });

  it('builds valid VietQR direct-to-merchant URLs', () => {
    const url = buildVietQrImageUrl({
      bankBin: 'MB',
      bankAccountNo: '0901234567',
      bankAccountName: 'NGUYEN VAN A',
      amountVnd: 55000,
      description: 'ORDER 101',
    });
    expect(url).toContain('https://img.vietqr.io/image/MB-0901234567-compact2.png');
    expect(url).toContain('amount=55000');
  });
});

describe('SaaS Commercial v3 — Slug Validation', () => {
  it('normalizes Vietnamese shop names and blocks reserved slugs', () => {
    expect(sanitizeSlug('Cà Phê Vườn Nắng!')).toBe('ca-phe-vuon-nang');
    expect(validateSlug('ca-phe-vuon-nang').valid).toBe(true);
    expect(validateSlug('admin').valid).toBe(false);
    expect(validateSlug('default').valid).toBe(false);
    expect(validateSlug('ab').valid).toBe(false);
  });
});
