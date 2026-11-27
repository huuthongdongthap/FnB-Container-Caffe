/**
 * SaaS Tenant Lifecycle, Entitlement & Resource Limit Enforcement.
 *
 * Lifecycle:
 *   - 14-day full trial ('trial')
 *   - 3-day grace window ('grace')
 *   - Read-only mode ('readonly') -> blocks all writes with HTTP 402 subscription_expired_readonly
 *   - Paid active subscription ('active')
 *
 * The flagship 'default' tenant (AURA Sa Đéc at `/`) is always active.
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  GRACE_DAYS,
  SAAS_PLANS,
  TRIAL_DAYS,
  normalizeBillingCycle,
  normalizeSaasPlanId,
  type SaasBillingCycle,
  type SaasFeatureKey,
  type SaasPlanDefinition,
  type SaasPlanId,
} from './saas-plans';

export type TenantLifecycleState = 'active' | 'trial' | 'grace' | 'readonly';

export interface SubscriptionRow {
  id?: string;
  tenant_id: string;
  tier: string;
  billing_cycle?: string | null;
  status: string;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  price_vnd?: number | null;
}

export interface TenantEntitlement {
  tenantId: string;
  planId: SaasPlanId;
  plan: SaasPlanDefinition;
  billingCycle: SaasBillingCycle;
  rawStatus: string;
  lifecycleState: TenantLifecycleState;
  isReadOnly: boolean;
  fullAccessTrial: boolean;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number;
  maxTables: number | null;
  maxStaff: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function addDaysIso(baseDate: Date, days: number): string {
  return new Date(baseDate.getTime() + days * MS_PER_DAY).toISOString();
}

export function resolveTenantLifecycle(
  sub: SubscriptionRow | null,
  now: Date = new Date()
): TenantEntitlement {
  const nowMs = now.getTime();
  const tenantId = sub?.tenant_id || 'default';

  // Flagship tenant ('default') is never locked out by SaaS subscription expiry.
  if (tenantId === 'default' || tenantId === 'hq' || tenantId === '*') {
    const chain = SAAS_PLANS.chain;
    return {
      tenantId,
      planId: 'chain',
      plan: chain,
      billingCycle: 'monthly',
      rawStatus: 'active',
      lifecycleState: 'active',
      isReadOnly: false,
      fullAccessTrial: false,
      trialEndsAt: null,
      graceEndsAt: null,
      currentPeriodEnd: null,
      daysRemaining: 9999,
      maxTables: null,
      maxStaff: null,
    };
  }

  const planId = normalizeSaasPlanId(sub?.tier);
  const plan = SAAS_PLANS[planId];
  const billingCycle = normalizeBillingCycle(sub?.billing_cycle);
  const rawStatus = String(sub?.status || 'trial').trim().toLowerCase();

  // Explicit administrative suspension, cancellation, or read-only lock
  if (rawStatus === 'suspended' || rawStatus === 'readonly' || rawStatus === 'expired' || rawStatus === 'cancelled') {
    return {
      tenantId,
      planId,
      plan,
      billingCycle,
      rawStatus,
      lifecycleState: 'readonly',
      isReadOnly: true,
      fullAccessTrial: false,
      trialEndsAt: sub?.trial_ends_at ?? null,
      graceEndsAt: sub?.grace_ends_at ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      daysRemaining: 0,
      maxTables: plan.maxTables,
      maxStaff: plan.maxStaff,
    };
  }

  // Paid active subscription
  if (rawStatus === 'active') {
    const periodEndMs = parseIsoMs(sub?.current_period_end);
    if (periodEndMs === null || nowMs <= periodEndMs) {
      const daysRemaining =
        periodEndMs === null ? 30 : Math.max(0, Math.ceil((periodEndMs - nowMs) / MS_PER_DAY));
      return {
        tenantId,
        planId,
        plan,
        billingCycle,
        rawStatus,
        lifecycleState: 'active',
        isReadOnly: false,
        fullAccessTrial: false,
        trialEndsAt: sub?.trial_ends_at ?? null,
        graceEndsAt: sub?.grace_ends_at ?? null,
        currentPeriodEnd: sub?.current_period_end ?? null,
        daysRemaining,
        maxTables: plan.maxTables,
        maxStaff: plan.maxStaff,
      };
    }

    const graceEndMs = parseIsoMs(sub?.grace_ends_at) ?? periodEndMs + GRACE_DAYS * MS_PER_DAY;
    if (nowMs <= graceEndMs) {
      return {
        tenantId,
        planId,
        plan,
        billingCycle,
        rawStatus,
        lifecycleState: 'grace',
        isReadOnly: false,
        fullAccessTrial: false,
        trialEndsAt: sub?.trial_ends_at ?? null,
        graceEndsAt: new Date(graceEndMs).toISOString(),
        currentPeriodEnd: sub?.current_period_end ?? null,
        daysRemaining: Math.max(0, Math.ceil((graceEndMs - nowMs) / MS_PER_DAY)),
        maxTables: plan.maxTables,
        maxStaff: plan.maxStaff,
      };
    }

    return {
      tenantId,
      planId,
      plan,
      billingCycle,
      rawStatus,
      lifecycleState: 'readonly',
      isReadOnly: true,
      fullAccessTrial: false,
      trialEndsAt: sub?.trial_ends_at ?? null,
      graceEndsAt: new Date(graceEndMs).toISOString(),
      currentPeriodEnd: sub?.current_period_end ?? null,
      daysRemaining: 0,
      maxTables: plan.maxTables,
      maxStaff: plan.maxStaff,
    };
  }

  // Trial lifecycle: 14-day full trial -> 3-day grace -> readonly
  const trialEndMs = parseIsoMs(sub?.trial_ends_at) ?? nowMs + TRIAL_DAYS * MS_PER_DAY;
  const graceEndMs = parseIsoMs(sub?.grace_ends_at) ?? trialEndMs + GRACE_DAYS * MS_PER_DAY;

  if (nowMs <= trialEndMs) {
    return {
      tenantId,
      planId,
      plan,
      billingCycle,
      rawStatus,
      lifecycleState: 'trial',
      isReadOnly: false,
      fullAccessTrial: true,
      trialEndsAt: new Date(trialEndMs).toISOString(),
      graceEndsAt: new Date(graceEndMs).toISOString(),
      currentPeriodEnd: sub?.current_period_end ?? null,
      daysRemaining: Math.max(0, Math.ceil((trialEndMs - nowMs) / MS_PER_DAY)),
      maxTables: null, // Full-feature 14-day trial
      maxStaff: null,
    };
  }

  if (nowMs <= graceEndMs) {
    return {
      tenantId,
      planId,
      plan,
      billingCycle,
      rawStatus,
      lifecycleState: 'grace',
      isReadOnly: false,
      fullAccessTrial: true,
      trialEndsAt: new Date(trialEndMs).toISOString(),
      graceEndsAt: new Date(graceEndMs).toISOString(),
      currentPeriodEnd: sub?.current_period_end ?? null,
      daysRemaining: Math.max(0, Math.ceil((graceEndMs - nowMs) / MS_PER_DAY)),
      maxTables: null,
      maxStaff: null,
    };
  }

  return {
    tenantId,
    planId,
    plan,
    billingCycle,
    rawStatus,
    lifecycleState: 'readonly',
    isReadOnly: true,
    fullAccessTrial: false,
    trialEndsAt: new Date(trialEndMs).toISOString(),
    graceEndsAt: new Date(graceEndMs).toISOString(),
    currentPeriodEnd: sub?.current_period_end ?? null,
    daysRemaining: 0,
    maxTables: plan.maxTables,
    maxStaff: plan.maxStaff,
  };
}

export async function getTenantEntitlement(
  db: D1Database,
  tenantId: string,
  now: Date = new Date()
): Promise<TenantEntitlement> {
  const cleanId = String(tenantId || 'default').trim();
  if (!cleanId || cleanId === 'default' || cleanId === 'hq' || cleanId === '*') {
    return resolveTenantLifecycle({ tenant_id: cleanId || 'default', tier: 'chain', status: 'active' }, now);
  }

  const subRow = await db
    .prepare(
      `SELECT id, tenant_id, tier, billing_cycle, status, trial_ends_at, grace_ends_at, current_period_start, current_period_end, price_vnd
       FROM tenant_subscriptions
       WHERE tenant_id = ?
       LIMIT 1`
    )
    .bind(cleanId)
    .first<SubscriptionRow>()
    .catch(() => null);

  if (subRow) {
    return resolveTenantLifecycle(subRow, now);
  }

  const tenantRow = await db
    .prepare(
      `SELECT id AS tenant_id, tier, status, trial_ends_at, current_period_end
       FROM saas_tenants
       WHERE id = ? OR slug = ?
       LIMIT 1`
    )
    .bind(cleanId, cleanId)
    .first<SubscriptionRow>()
    .catch(() => null);

  if (tenantRow) {
    return resolveTenantLifecycle(tenantRow, now);
  }

  // Legacy / un-enrolled non-default store (no SaaS subscription or saas_tenants row):
  // treat as an active internal store so existing franchise/branch tests and pre-SaaS stores
  // continue working seamlessly, while any enrolled SaaS tenant is strictly governed by its row.
  return resolveTenantLifecycle(
    { tenant_id: cleanId, tier: 'chain', status: 'active' },
    now
  );
}

export interface EntitlementCheckResult {
  allowed: boolean;
  status?: 402 | 403;
  code?: 'subscription_expired_readonly' | 'plan_limit_reached' | 'plan_feature_required';
  message?: string;
  entitlement: TenantEntitlement;
  currentUsage?: number;
  limit?: number | null;
}

export async function assertTenantWritable(
  db: D1Database,
  tenantId: string,
  now: Date = new Date()
): Promise<EntitlementCheckResult> {
  const entitlement = await getTenantEntitlement(db, tenantId, now);
  if (entitlement.isReadOnly) {
    return {
      allowed: false,
      status: 402,
      code: 'subscription_expired_readonly',
      message:
        'Gói SaaS của quán đã hết hạn và đang ở chế độ chỉ đọc. Vui lòng thanh toán gia hạn để tiếp tục thao tác ghi.',
      entitlement,
    };
  }
  return { allowed: true, entitlement };
}

export async function assertTenantFeature(
  db: D1Database,
  tenantId: string,
  feature: SaasFeatureKey,
  now: Date = new Date()
): Promise<EntitlementCheckResult> {
  const writeCheck = await assertTenantWritable(db, tenantId, now);
  if (!writeCheck.allowed) return writeCheck;

  const { entitlement } = writeCheck;
  if (entitlement.fullAccessTrial) {
    return { allowed: true, entitlement };
  }

  if (!entitlement.plan.features.includes(feature)) {
    return {
      allowed: false,
      status: 403,
      code: 'plan_feature_required',
      message: `Tính năng "${feature}" không có trong gói ${entitlement.plan.name}. Vui lòng nâng cấp gói để sử dụng.`,
      entitlement,
    };
  }

  return { allowed: true, entitlement };
}

export async function assertTenantResourceLimit(
  db: D1Database,
  tenantId: string,
  resource: 'tables' | 'staff',
  now: Date = new Date()
): Promise<EntitlementCheckResult> {
  const writeCheck = await assertTenantWritable(db, tenantId, now);
  if (!writeCheck.allowed) return writeCheck;

  const { entitlement } = writeCheck;
  const limit = resource === 'tables' ? entitlement.maxTables : entitlement.maxStaff;
  if (limit === null) {
    return { allowed: true, entitlement, limit: null };
  }

  const query =
    resource === 'tables'
      ? 'SELECT COUNT(*) AS cnt FROM cafe_tables WHERE tenant_id = ? AND COALESCE(is_active, 1) = 1'
      : 'SELECT COUNT(*) AS cnt FROM users WHERE tenant_id = ? AND COALESCE(is_active, 1) = 1';

  const row = await db.prepare(query).bind(tenantId).first<{ cnt: number }>();
  const currentUsage = Number(row?.cnt ?? 0);

  if (currentUsage >= limit) {
    const label = resource === 'tables' ? 'bàn' : 'nhân viên';
    return {
      allowed: false,
      status: 402,
      code: 'plan_limit_reached',
      message: `Gói ${entitlement.plan.name} giới hạn tối đa ${limit} ${label} (hiện có ${currentUsage}). Vui lòng nâng cấp gói để mở rộng.`,
      entitlement,
      currentUsage,
      limit,
    };
  }

  return { allowed: true, entitlement, currentUsage, limit };
}
