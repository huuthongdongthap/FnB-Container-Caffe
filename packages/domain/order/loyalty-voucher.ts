import type { D1Database } from '@cloudflare/workers-types';

export interface LoyaltyVoucherRecord {
  source: 'user_rewards' | 'loyalty_redemptions';
  id: string;
  code: string;
  customer_id: string;
  reward_id: string;
  status: string;
  expires_at: string | null;
  tenant_id: string;
  title: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order: number;
  max_discount: number;
}

export interface LoyaltyVoucherValidationResult {
  valid: boolean;
  reason?: string;
  voucher?: LoyaltyVoucherRecord;
  discountAmount?: number;
}

function normalizeTenant(tenantId: string | null | undefined): string {
  const trimmed = String(tenantId ?? '').trim();
  return trimmed && trimmed !== '*' ? trimmed : 'default';
}

function normalizeDiscountType(raw: unknown): 'percent' | 'fixed' {
  const val = String(raw ?? '').trim().toLowerCase();
  if (val === 'percent' || val === 'percentage') return 'percent';
  return 'fixed';
}

export function computeLoyaltyVoucherDiscount(
  voucher: LoyaltyVoucherRecord,
  orderTotal: number,
): number {
  if (orderTotal <= 0) return 0;
  let rawDiscount = 0;
  if (voucher.discount_type === 'percent') {
    rawDiscount = Math.round((orderTotal * voucher.discount_value) / 100);
  } else {
    rawDiscount = Math.round(voucher.discount_value);
  }
  const capped = voucher.max_discount > 0 ? Math.min(rawDiscount, voucher.max_discount) : rawDiscount;
  return Math.min(orderTotal, Math.max(0, capped));
}

export async function findLoyaltyVoucherByCode(
  db: D1Database,
  rawCode: string,
  tenantId: string,
): Promise<LoyaltyVoucherRecord | null> {
  const upperCode = rawCode.trim().toUpperCase();
  if (!upperCode) return null;
  const scopedTenant = normalizeTenant(tenantId);

  type RawRow = {
    id: string;
    code?: string | null;
    voucher_code?: string | null;
    customer_id: string;
    reward_id: string;
    status?: string | null;
    expires_at?: string | null;
    tenant_id?: string | null;
    title?: string | null;
    discount_type?: string | null;
    discount_value?: number | null;
    min_order?: number | null;
    max_discount?: number | null;
  };

  // 1. Check user_rewards first (primary customer voucher wallet table)
  const urRow = await db.prepare(
    `SELECT ur.id, ur.code, ur.customer_id, ur.reward_id, ur.status, ur.expires_at, ur.tenant_id,
            COALESCE(r.title, lr.name, ur.code) AS title,
            COALESCE(r.discount_type, lr.type, 'fixed') AS discount_type,
            COALESCE(r.discount_value, lr.value, 0) AS discount_value,
            COALESCE(r.min_order, 0) AS min_order,
            0 AS max_discount
     FROM user_rewards ur
     LEFT JOIN rewards r ON ur.reward_id = r.id
       AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(ur.tenant_id), ''), 'default')
     LEFT JOIN loyalty_rewards lr ON ur.reward_id = lr.id
       AND COALESCE(NULLIF(TRIM(lr.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(ur.tenant_id), ''), 'default')
     WHERE UPPER(ur.code) = ?
       AND COALESCE(NULLIF(TRIM(ur.tenant_id), ''), 'default') = ?
     LIMIT 1`
  ).bind(upperCode, scopedTenant).first<RawRow>().catch(() => null);

  if (urRow) {
    return {
      source: 'user_rewards',
      id: String(urRow.id),
      code: String(urRow.code ?? upperCode).toUpperCase(),
      customer_id: String(urRow.customer_id ?? ''),
      reward_id: String(urRow.reward_id ?? ''),
      status: String(urRow.status ?? 'active').toLowerCase(),
      expires_at: urRow.expires_at ?? null,
      tenant_id: normalizeTenant(urRow.tenant_id),
      title: String(urRow.title ?? upperCode),
      discount_type: normalizeDiscountType(urRow.discount_type),
      discount_value: Math.max(0, Number(urRow.discount_value ?? 0)),
      min_order: Math.max(0, Number(urRow.min_order ?? 0)),
      max_discount: Math.max(0, Number(urRow.max_discount ?? 0)),
    };
  }

  // 2. Fallback to loyalty_redemptions (OpenAPI reward redemption table)
  const lrRow = await db.prepare(
    `SELECT red.id, COALESCE(red.voucher_code, red.code) AS code, red.customer_id, red.reward_id,
            red.status, red.expires_at, red.tenant_id,
            COALESCE(r.title, lr.name, red.voucher_code, red.code) AS title,
            COALESCE(r.discount_type, lr.type, 'fixed') AS discount_type,
            COALESCE(r.discount_value, lr.value, 0) AS discount_value,
            COALESCE(r.min_order, 0) AS min_order,
            0 AS max_discount
     FROM loyalty_redemptions red
     LEFT JOIN rewards r ON red.reward_id = r.id
       AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(red.tenant_id), ''), 'default')
     LEFT JOIN loyalty_rewards lr ON red.reward_id = lr.id
       AND COALESCE(NULLIF(TRIM(lr.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(red.tenant_id), ''), 'default')
     WHERE (UPPER(red.voucher_code) = ? OR UPPER(red.code) = ?)
       AND COALESCE(NULLIF(TRIM(red.tenant_id), ''), 'default') = ?
     LIMIT 1`
  ).bind(upperCode, upperCode, scopedTenant).first<RawRow>().catch(() => null);

  if (!lrRow) return null;

  return {
    source: 'loyalty_redemptions',
    id: String(lrRow.id),
    code: String(lrRow.code ?? lrRow.voucher_code ?? upperCode).toUpperCase(),
    customer_id: String(lrRow.customer_id ?? ''),
    reward_id: String(lrRow.reward_id ?? ''),
    status: String(lrRow.status ?? 'active').toLowerCase(),
    expires_at: lrRow.expires_at ?? null,
    tenant_id: normalizeTenant(lrRow.tenant_id),
    title: String(lrRow.title ?? upperCode),
    discount_type: normalizeDiscountType(lrRow.discount_type),
    discount_value: Math.max(0, Number(lrRow.discount_value ?? 0)),
    min_order: Math.max(0, Number(lrRow.min_order ?? 0)),
    max_discount: Math.max(0, Number(lrRow.max_discount ?? 0)),
  };
}

export function validateLoyaltyVoucher(
  voucher: LoyaltyVoucherRecord,
  options: {
    customerId?: string | null;
    allowStaffOverride?: boolean;
    orderTotal?: number;
    now?: Date;
  },
): LoyaltyVoucherValidationResult {
  const now = options.now ?? new Date();
  if (voucher.status === 'used') {
    return { valid: false, reason: 'Mã voucher đã được sử dụng' };
  }
  if (voucher.status !== 'active') {
    return { valid: false, reason: 'Mã voucher không còn hiệu lực' };
  }
  if (voucher.expires_at && new Date(voucher.expires_at) < now) {
    return { valid: false, reason: 'Mã voucher đã hết hạn' };
  }
  if (voucher.customer_id && !options.allowStaffOverride) {
    if (!options.customerId || String(options.customerId).trim() !== voucher.customer_id) {
      return { valid: false, reason: 'Mã voucher không thuộc tài khoản của bạn' };
    }
  }
  if (options.orderTotal !== undefined && voucher.min_order > 0 && options.orderTotal < voucher.min_order) {
    return {
      valid: false,
      reason: `Đơn hàng tối thiểu ${voucher.min_order.toLocaleString('vi-VN')}đ`,
    };
  }
  const discountAmount = options.orderTotal !== undefined
    ? computeLoyaltyVoucherDiscount(voucher, options.orderTotal)
    : undefined;
  return { valid: true, voucher, discountAmount };
}

export async function reserveLoyaltyVoucherAtomically(
  db: D1Database,
  voucher: LoyaltyVoucherRecord,
  orderId: string,
  nowIso: string,
): Promise<boolean> {
  const scopedTenant = normalizeTenant(voucher.tenant_id);
  let reserved = false;

  if (voucher.source === 'user_rewards') {
    const res = await db.prepare(
      `UPDATE user_rewards
       SET status = 'used'
       WHERE id = ? AND UPPER(code) = ? AND status = 'active'
         AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(voucher.id, voucher.code, scopedTenant).run().catch(() => null) as { meta?: { changes?: number } } | null;
    reserved = Number(res?.meta?.changes ?? 0) >= 1;
    if (reserved) {
      await db.prepare(
        `UPDATE loyalty_redemptions
         SET status = 'used', order_id = COALESCE(order_id, ?), used_at = ?
         WHERE (UPPER(voucher_code) = ? OR UPPER(code) = ?) AND status = 'active'
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      ).bind(orderId, nowIso, voucher.code, voucher.code, scopedTenant).run().catch(() => {});
    }
    return reserved;
  }

  const res = await db.prepare(
    `UPDATE loyalty_redemptions
     SET status = 'used', order_id = COALESCE(order_id, ?), used_at = ?
     WHERE id = ? AND (UPPER(voucher_code) = ? OR UPPER(code) = ?) AND status = 'active'
       AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
  ).bind(orderId, nowIso, voucher.id, voucher.code, voucher.code, scopedTenant).run().catch(() => null) as { meta?: { changes?: number } } | null;
  reserved = Number(res?.meta?.changes ?? 0) >= 1;
  if (reserved) {
    await db.prepare(
      `UPDATE user_rewards
       SET status = 'used'
       WHERE UPPER(code) = ? AND status = 'active'
         AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(voucher.code, scopedTenant).run().catch(() => {});
  }
  return reserved;
}

export async function rollbackLoyaltyVoucherReservation(
  db: D1Database,
  voucher: LoyaltyVoucherRecord,
  orderId?: string | null,
): Promise<void> {
  const scopedTenant = normalizeTenant(voucher.tenant_id);
  await db.prepare(
    `UPDATE user_rewards
     SET status = 'active'
     WHERE UPPER(code) = ? AND status = 'used'
       AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
  ).bind(voucher.code, scopedTenant).run().catch(() => {});
  if (orderId) {
    await db.prepare(
      `UPDATE loyalty_redemptions
       SET status = 'active', order_id = NULL, used_at = NULL
       WHERE order_id = ? AND status = 'used'
         AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(orderId, scopedTenant).run().catch(() => {});
  } else if (voucher.id) {
    await db.prepare(
      `UPDATE loyalty_redemptions
       SET status = 'active', order_id = NULL, used_at = NULL
       WHERE id = ? AND status = 'used'
         AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(voucher.id, scopedTenant).run().catch(() => {});
  } else {
    await db.prepare(
      `UPDATE loyalty_redemptions
       SET status = 'active', order_id = NULL, used_at = NULL
       WHERE (UPPER(voucher_code) = ? OR UPPER(code) = ?) AND status = 'used'
         AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(voucher.code, voucher.code, scopedTenant).run().catch(() => {});
  }
}
