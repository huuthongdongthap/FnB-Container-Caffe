import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { timingSafeEqualString } from '../../lib/jwt';
import { resolvePilotStore } from '../../lib/pilot-store';
import { sendSMS } from '../../lib/speedsms-client';
import { updateCustomerProfileSchema, zodErrorResponse } from '../../lib/validators';
import { eraseCustomerPii } from '@aura/domain-crm';
import { type CustomerRecord, PROFILE_SQL } from './types';

const PHONE_CHANGE_OTP_TTL_SECONDS = 300;
const PHONE_CHANGE_OTP_MAX_REQUESTS = 5;
const PHONE_CHANGE_OTP_MAX_FAILURES = 5;

function normalizeCustomerPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 10) {
    return `0${digits.slice(2)}`;
  }
  return digits || raw.trim();
}

function getCustomerPhoneVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const normalized = normalizeCustomerPhone(trimmed);
  const intl = normalized.startsWith('0') ? `84${normalized.slice(1)}` : normalized;
  const plusIntl = intl ? `+${intl}` : '';
  return Array.from(new Set([trimmed, normalized, intl, plusIntl].filter(Boolean)));
}

function generateSixDigitOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

function isErasedCustomerRecord(
  row: { name?: unknown; phone?: unknown; anonymized_at?: unknown } | null | undefined,
): boolean {
  if (!row) return false;
  if (typeof row.anonymized_at === 'string' ? row.anonymized_at.trim() !== '' : Boolean(row.anonymized_at)) {
    return true;
  }
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (name === '[ERASED]') return true;
  const phone = typeof row.phone === 'string' ? row.phone.trim().toLowerCase() : '';
  if (phone.startsWith('erased_')) return true;
  return false;
}

async function isCustomerErased(
  db: Env['AURA_DB'] | undefined,
  customerId: string,
  record?: { name?: unknown; phone?: unknown; anonymized_at?: unknown } | null,
): Promise<boolean> {
  if (isErasedCustomerRecord(record)) return true;
  if (!db?.prepare || !customerId) return false;

  const custRow = await db
    .prepare('SELECT id, name, phone, anonymized_at FROM customers WHERE id = ? LIMIT 1')
    .bind(customerId)
    .first<{ id?: string | null; name?: string | null; phone?: string | null; anonymized_at?: string | null }>()
    .catch(() => null);
  if (custRow && (!custRow.id || String(custRow.id) === customerId) && isErasedCustomerRecord(custRow)) {
    return true;
  }

  const eraseEvent = await db
    .prepare("SELECT event_type FROM customer_events WHERE customer_id = ? AND event_type = 'CustomerDataErased' LIMIT 1")
    .bind(customerId)
    .first<{ event_type?: string | null }>()
    .catch(() => null);
  if (eraseEvent?.event_type === 'CustomerDataErased') {
    return true;
  }

  return false;
}

function resolveCustomerTenantScope(c: {
  get: (k: string) => unknown;
  req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
  env: Env;
}): { tenantId: string; forbidden: boolean } {
  const user = c.get('user') as { tenantId?: string; tenant_id?: string } | undefined;
  const tokenTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
  const queryTenant = String(
    c.req.query('tenant_id') ||
    c.req.query('tenantId') ||
    c.req.query('store_id') ||
    c.req.query('storeId') ||
    ''
  ).trim();
  const headerTenant = String(
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-tenant-id') ||
    c.req.header('X-Store-ID') ||
    c.req.header('x-store-id') ||
    ''
  ).trim();
  const reqTenant = queryTenant || headerTenant;
  const ctxTenant = String((c.get('tenantId') as string | undefined) || '').trim();

  let pilotTenant = 'default';
  try {
    pilotTenant = resolvePilotStore(c.env);
  } catch {
    pilotTenant = 'default';
  }

  const boundTenant = tokenTenant || ctxTenant || pilotTenant || 'default';
  if (
    boundTenant === '*' ||
    boundTenant.toLowerCase() === 'hq' ||
    reqTenant === '*' ||
    reqTenant.toLowerCase() === 'hq' ||
    ctxTenant === '*' ||
    ctxTenant.toLowerCase() === 'hq' ||
    (queryTenant && headerTenant && queryTenant !== headerTenant) ||
    (tokenTenant && ctxTenant && ctxTenant !== tokenTenant) ||
    (queryTenant && queryTenant !== boundTenant) ||
    (headerTenant && headerTenant !== boundTenant)
  ) {
    return { tenantId: boundTenant === '*' || boundTenant.toLowerCase() === 'hq' ? 'default' : boundTenant, forbidden: true };
  }

  return { tenantId: boundTenant, forbidden: false };
}

export function registerProfileHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/customers/me — get current customer by JWT (customer role only)
  router.get('/me', requireAuth(['customer']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user' as any) as { id?: string; sub?: string; customerId?: string; customer_id?: string; role?: string } | undefined;
    if (!user || user.role !== 'customer') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const customerId = user.customerId || user.customer_id || user.id || user.sub;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }
    const scope = resolveCustomerTenantScope(c as unknown as Parameters<typeof resolveCustomerTenantScope>[0]);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const tenantId = scope.tenantId;

    let customer: CustomerRecord | null = null;
    try {
      customer = await db.prepare(
        `${PROFILE_SQL}WHERE c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?`
      ).bind(customerId, tenantId).first<CustomerRecord>();
    } catch {
      if (tenantId === 'default') {
        try {
          customer = await db.prepare(
            `${PROFILE_SQL}WHERE c.id = ?`
          ).bind(customerId).first<CustomerRecord>();
        } catch {
          customer = await db.prepare(
            'SELECT c.* FROM customers c WHERE c.id = ?'
          ).bind(customerId).first<CustomerRecord>();
        }
      } else {
        customer = await db.prepare(
          "SELECT c.* FROM customers c WHERE c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?"
        ).bind(customerId, tenantId).first<CustomerRecord>().catch(() => null);
      }
    }

    if (customer) {
      const rec = customer as unknown as Record<string, unknown>;
      if ('tenant_id' in rec && rec.tenant_id !== undefined) {
        const resolvedRowTenant = typeof rec.tenant_id === 'string' && rec.tenant_id.trim() !== '' ? rec.tenant_id.trim() : 'default';
        if (resolvedRowTenant !== tenantId) {
          customer = null;
        }
      } else if (tenantId !== 'default') {
        customer = null;
      }
    }

    if (!customer || await isCustomerErased(db, customerId, customer)) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    return c.json({ success: true, data: customer });
  });

  // PATCH /api/customers/me — update current customer profile (customer role only)
  router.patch('/me', requireAuth(['customer']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user' as any) as { id?: string; sub?: string; customerId?: string; customer_id?: string; role?: string } | undefined;
    if (!user || user.role !== 'customer') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const customerId = user.customerId || user.customer_id || user.id || user.sub;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }
    const scope = resolveCustomerTenantScope(c as unknown as Parameters<typeof resolveCustomerTenantScope>[0]);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const tenantId = scope.tenantId;

    let body: Record<string, unknown>;
    try {
      const raw = await c.req.json();
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return c.json({ success: false, error: 'Invalid JSON body' }, 400);
      }
      body = raw as Record<string, unknown>;
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }
    const parsed = updateCustomerProfileSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const data = parsed.data;

    if (await isCustomerErased(db, customerId, null)) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    if (data.name !== undefined) {
      updates.push('name = ?'); params.push(data.name);
    }

    let normalizedSubmittedPhone: string | undefined;
    if (data.phone !== undefined) {
      const trimmedPhone = data.phone.trim();
      normalizedSubmittedPhone = trimmedPhone ? normalizeCustomerPhone(trimmedPhone) : '';
      updates.push('phone = ?'); params.push(normalizedSubmittedPhone);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'Không có trường nào để cập nhật' }, 400);
    }

    if (typeof data.phone === 'string' && data.phone.trim() !== '') {
      const trimmedPhone = data.phone.trim();
      const normalizedPhone = normalizedSubmittedPhone || normalizeCustomerPhone(trimmedPhone);
      const currentRow = await db
        .prepare(
          `SELECT phone FROM customers WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1`
        )
        .bind(customerId, tenantId, tenantId)
        .first<{ phone?: string | null }>()
        .catch(() => null);
      const currentPhone = String(currentRow?.phone || '').trim();
      const normalizedCurrentPhone = currentPhone ? normalizeCustomerPhone(currentPhone) : '';
      if (normalizedCurrentPhone !== normalizedPhone) {
        const submittedOtp = String(body.otp || body.phone_otp || '').trim();
        const kv = c.env?.AUTH_KV;
        const failKey = `phone_change_otp_fail:${customerId}:${normalizedPhone}`;
        if (kv && typeof kv.get === 'function') {
          const failCount = Number((await kv.get(failKey).catch(() => null)) || '0');
          if (failCount >= PHONE_CHANGE_OTP_MAX_FAILURES) {
            return c.json(
              {
                success: false,
                error: 'Quá nhiều lần nhập sai mã OTP. Vui lòng yêu cầu mã mới sau ít phút.',
                code: 'PHONE_OTP_RATE_LIMITED',
              },
              429
            );
          }
        }
        let otpValid = false;
        if (submittedOtp && kv && typeof kv.get === 'function') {
          const candidateKeys = Array.from(
            new Set([
              `phone_change_otp:${customerId}:${normalizedPhone}`,
              `phone_change_otp:${customerId}:${trimmedPhone}`,
            ])
          );
          for (const otpKey of candidateKeys) {
            const storedOtp = await kv.get(otpKey).catch(() => null);
            if (storedOtp && timingSafeEqualString(String(storedOtp), submittedOtp)) {
              otpValid = true;
              await kv.delete?.(otpKey)?.catch?.(() => {});
              await kv.delete?.(failKey)?.catch?.(() => {});
              break;
            }
          }
        }
        if (!otpValid) {
          if (submittedOtp && kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
            const prevFails = Number((await kv.get(failKey).catch(() => null)) || '0');
            await kv
              .put(failKey, String(prevFails + 1), { expirationTtl: PHONE_CHANGE_OTP_TTL_SECONDS })
              .catch(() => {});
          }
          return c.json(
            {
              success: false,
              error: 'Cần xác thực OTP để cập nhật số điện thoại',
              code: 'PHONE_OTP_REQUIRED',
            },
            403
          );
        }
      }
      const variants = getCustomerPhoneVariants(trimmedPhone);
      const [v0, v1, v2, v3] = [
        variants[0] || normalizedPhone,
        variants[1] || normalizedPhone,
        variants[2] || normalizedPhone,
        variants[3] || normalizedPhone,
      ];
      let existingPhone: { id?: string; phone?: string | null; tenant_id?: string | null } | null = null;
      try {
        existingPhone = await db
          .prepare(
            `SELECT id, phone, tenant_id FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', '') IN (?, ?, ?, ?) AND id != ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1`
          )
          .bind(v0, v1, v2, v3, customerId, tenantId, tenantId)
          .first<{ id?: string; phone?: string | null; tenant_id?: string | null }>();
      } catch (err) {
        if (tenantId === 'default' && /no such column:\s*tenant_id/i.test(String(err))) {
          existingPhone = await db
            .prepare(
              `SELECT id, phone FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', '') IN (?, ?, ?, ?) AND id != ? LIMIT 1`
            )
            .bind(v0, v1, v2, v3, customerId)
            .first<{ id?: string; phone?: string | null }>()
            .catch(() => null);
        }
      }
      if (
        existingPhone &&
        existingPhone.id &&
        existingPhone.id !== customerId &&
        (existingPhone.phone === undefined ||
          normalizeCustomerPhone(String(existingPhone.phone)) === normalizedPhone)
      ) {
        const existingTenant =
          existingPhone.tenant_id && String(existingPhone.tenant_id).trim() !== ''
            ? String(existingPhone.tenant_id).trim()
            : 'default';
        if (
          tenantId === '*' ||
          !('tenant_id' in existingPhone) ||
          existingPhone.tenant_id === undefined ||
          existingTenant === tenantId
        ) {
          return c.json({ success: false, error: 'Phone number already in use by another customer' }, 409);
        }
      }
    }

    const baseUpdates = [...updates];
    updates.push('updated_at = CURRENT_TIMESTAMP');
    try {
      await db.prepare(
        `UPDATE customers SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      ).bind(...params, customerId, tenantId).run();
    } catch (err) {
      const msg = String(err);
      if (/UNIQUE constraint failed/i.test(msg)) {
        return c.json({ success: false, error: 'Phone number already in use by another customer' }, 409);
      }
      const existing = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(customerId).first<{ id?: string; tenant_id?: string | null }>().catch(() => null);
      const existingTenant = existing?.tenant_id && existing.tenant_id.trim() !== '' ? existing.tenant_id.trim() : 'default';
      if ((!existing && tenantId !== 'default') || existingTenant !== tenantId) {
        return c.json({ success: false, error: 'Customer not found' }, 404);
      }
      if (!/no such column:\s*tenant_id/i.test(msg)) {
        try {
          await db.prepare(
            `UPDATE customers SET ${baseUpdates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(...params, customerId, tenantId).run();
        } catch (innerErr) {
          const innerMsg = String(innerErr);
          if (/UNIQUE constraint failed/i.test(innerMsg)) {
            return c.json({ success: false, error: 'Phone number already in use by another customer' }, 409);
          }
          if (tenantId !== 'default' || !/no such column:\s*tenant_id/i.test(innerMsg)) {
            throw innerErr;
          }
          await db.prepare(
            `UPDATE customers SET ${baseUpdates.join(', ')} WHERE id = ?`
          ).bind(...params, customerId).run();
        }
      } else if (tenantId === 'default') {
        try {
          await db.prepare(
            `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`
          ).bind(...params, customerId).run();
        } catch (fallbackErr) {
          if (/UNIQUE constraint failed/i.test(String(fallbackErr))) {
            return c.json({ success: false, error: 'Phone number already in use by another customer' }, 409);
          }
          await db.prepare(
            `UPDATE customers SET ${baseUpdates.join(', ')} WHERE id = ?`
          ).bind(...params, customerId).run();
        }
      } else {
        return c.json({ success: false, error: 'Customer not found' }, 404);
      }
    }

    let customer: CustomerRecord | null = null;
    try {
      customer = await db.prepare(
        `${PROFILE_SQL}WHERE c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?`
      ).bind(customerId, tenantId).first<CustomerRecord>();
    } catch {
      if (tenantId === 'default') {
        try {
          customer = await db.prepare(
            `${PROFILE_SQL}WHERE c.id = ?`
          ).bind(customerId).first<CustomerRecord>();
        } catch {
          customer = await db.prepare(
            'SELECT c.* FROM customers c WHERE c.id = ?'
          ).bind(customerId).first<CustomerRecord>();
        }
      } else {
        customer = await db.prepare(
          "SELECT c.* FROM customers c WHERE c.id = ? AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?"
        ).bind(customerId, tenantId).first<CustomerRecord>().catch(() => null);
      }
    }

    if (customer) {
      const rec = customer as unknown as Record<string, unknown>;
      if ('tenant_id' in rec && rec.tenant_id !== undefined) {
        const resolvedRowTenant = typeof rec.tenant_id === 'string' && rec.tenant_id.trim() !== '' ? rec.tenant_id.trim() : 'default';
        if (resolvedRowTenant !== tenantId) {
          customer = null;
        }
      } else if (tenantId !== 'default') {
        customer = null;
      }
    }

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    return c.json({ success: true, data: customer });
  });

  // POST /api/customers/me/phone-otp — issue a single-use 6-digit OTP to verify a customer phone change
  router.post('/me/phone-otp', requireAuth(['customer']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user' as any) as { id?: string; sub?: string; customerId?: string; customer_id?: string; role?: string } | undefined;
    if (!user || user.role !== 'customer') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const customerId = user.customerId || user.customer_id || user.id || user.sub;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }
    const scope = resolveCustomerTenantScope(c as unknown as Parameters<typeof resolveCustomerTenantScope>[0]);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const tenantId = scope.tenantId;

    let body: Record<string, unknown>;
    try {
      const raw = await c.req.json();
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return c.json({ success: false, error: 'Invalid JSON body' }, 400);
      }
      body = raw as Record<string, unknown>;
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const parsed = updateCustomerProfileSchema.safeParse({ phone: rawPhone });
    if (!rawPhone || !parsed.success) {
      return c.json({ success: false, error: 'Số điện thoại không hợp lệ' }, 400);
    }
    const normalizedPhone = normalizeCustomerPhone(rawPhone);
    if (!/^\d{9,15}$/.test(normalizedPhone)) {
      return c.json({ success: false, error: 'Số điện thoại không hợp lệ' }, 400);
    }

    if (await isCustomerErased(db, customerId, null)) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    const kv = c.env?.AUTH_KV;
    if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
      return c.json({ success: false, error: 'Dịch vụ OTP tạm thời không khả dụng' }, 503);
    }

    const rlKey = `rl:phone_change_otp:${customerId}`;
    const issuedCount = Number((await kv.get(rlKey).catch(() => null)) || '0');
    if (issuedCount >= PHONE_CHANGE_OTP_MAX_REQUESTS) {
      return c.json({ success: false, error: 'Quá nhiều yêu cầu OTP. Vui lòng thử lại sau ít phút.' }, 429);
    }

    const currentRow = await db
      .prepare(
        `SELECT phone FROM customers WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1`
      )
      .bind(customerId, tenantId, tenantId)
      .first<{ phone?: string | null }>()
      .catch(() => null);
    const currentPhone = String(currentRow?.phone || '').trim();
    if (currentPhone && normalizeCustomerPhone(currentPhone) === normalizedPhone) {
      return c.json({
        success: true,
        requiresOtp: false,
        message: 'Số điện thoại không thay đổi',
      });
    }

    const variants = getCustomerPhoneVariants(rawPhone);
    const [v0, v1, v2, v3] = [
      variants[0] || normalizedPhone,
      variants[1] || normalizedPhone,
      variants[2] || normalizedPhone,
      variants[3] || normalizedPhone,
    ];
    let existingPhone: { id?: string; phone?: string | null; tenant_id?: string | null } | null = null;
    try {
      existingPhone = await db
        .prepare(
          `SELECT id, phone, tenant_id FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', '') IN (?, ?, ?, ?) AND id != ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1`
        )
        .bind(v0, v1, v2, v3, customerId, tenantId, tenantId)
        .first<{ id?: string; phone?: string | null; tenant_id?: string | null }>();
    } catch (err) {
      if (tenantId === 'default' && /no such column:\s*tenant_id/i.test(String(err))) {
        existingPhone = await db
          .prepare(
            `SELECT id, phone FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', '') IN (?, ?, ?, ?) AND id != ? LIMIT 1`
          )
          .bind(v0, v1, v2, v3, customerId)
          .first<{ id?: string; phone?: string | null }>()
          .catch(() => null);
      }
    }
    if (
      existingPhone &&
      existingPhone.id &&
      existingPhone.id !== customerId &&
      (existingPhone.phone === undefined ||
        normalizeCustomerPhone(String(existingPhone.phone)) === normalizedPhone)
    ) {
      const existingTenant =
        existingPhone.tenant_id && String(existingPhone.tenant_id).trim() !== ''
          ? String(existingPhone.tenant_id).trim()
          : 'default';
      if (
        tenantId === '*' ||
        !('tenant_id' in existingPhone) ||
        existingPhone.tenant_id === undefined ||
        existingTenant === tenantId
      ) {
        return c.json({ success: false, error: 'Phone number already in use by another customer' }, 409);
      }
    }

    const code = generateSixDigitOtp();
    const otpKey = `phone_change_otp:${customerId}:${normalizedPhone}`;
    const failKey = `phone_change_otp_fail:${customerId}:${normalizedPhone}`;
    await kv.put(otpKey, code, { expirationTtl: PHONE_CHANGE_OTP_TTL_SECONDS });
    await kv.delete?.(failKey)?.catch?.(() => {});
    await kv
      .put(rlKey, String(issuedCount + 1), { expirationTtl: PHONE_CHANGE_OTP_TTL_SECONDS })
      .catch(() => {});

    let deliveryChannel: 'sms' | 'store_counter' = 'store_counter';
    if (c.env?.SPEEDSMS_API_KEY && c.env?.SPEEDSMS_API_SECRET) {
      deliveryChannel = 'sms';
      const smsPromise = sendSMS(c.env, {
        phone: normalizedPhone,
        message: `Ma OTP xac nhan doi so dien thoai AURA CAFE: ${code}. Hieu luc 5 phut.`,
      }).catch(() => {});
      try {
        c.executionCtx?.waitUntil?.(smsPromise);
      } catch {
        // Ignore in local/test contexts without executionCtx
      }
    }

    return c.json({
      success: true,
      requiresOtp: true,
      expiresInSeconds: PHONE_CHANGE_OTP_TTL_SECONDS,
      deliveryChannel,
      message: 'Mã xác thực OTP đã được gửi đến số điện thoại mới.',
    });
  });

  // DELETE /api/customers/me — self-service ledger-safe PII erasure (customer role only)
  router.delete('/me', requireAuth(['customer']), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user' as any) as { id?: string; sub?: string; customerId?: string; customer_id?: string; role?: string } | undefined;
    if (!user || user.role !== 'customer') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const customerId = user.customerId || user.customer_id || user.id || user.sub;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }
    const scope = resolveCustomerTenantScope(c as unknown as Parameters<typeof resolveCustomerTenantScope>[0]);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }

    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const res = await eraseCustomerPii(db, {
      customerId,
      actorId: customerId,
      actorRole: 'customer',
      tenantId: scope.tenantId,
      kv,
    });
    if (res.notFound) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    return c.json({ success: true, id: customerId, anonymized: true, ledgerPreserved: true });
  });
}
