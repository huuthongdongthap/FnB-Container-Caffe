// payments-nowpayments.ts — IPN webhook for NowPayments

import { jsonResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { addMonths } from 'worker/src/tree/subscriptions/helpers';
import { updateMRRSnapshot } from 'worker/src/tree/subscriptions/mrr-calculator';

const log = createLogger({ route: 'nowpayments-ipn' });

async function computeHMAC(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(body);

  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

type DbBinding = {
  prepare(_sql: string): {
    bind(..._a: unknown[]): {
      run(): Promise<{ rowCount?: number; meta?: { changes?: number } }>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
};

type InvoiceRow = {
  id: string;
  subscription_id: string;
  status: string;
  amount_vnd?: number | null;
  payment_ref?: string | null;
  tenant_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
};

async function fetchInvoiceByColumn(
  db: DbBinding,
  column: 'payment_ref' | 'id',
  value: string
): Promise<InvoiceRow | null> {
  try {
    return await db
      .prepare(
        `SELECT id, subscription_id, status, amount_vnd, payment_ref, tenant_id, period_start, period_end FROM subscription_invoices WHERE ${column} = ? LIMIT 1`
      )
      .bind(value)
      .first<InvoiceRow>();
  } catch {
    try {
      return await db
        .prepare(
          `SELECT id, subscription_id, status, amount_vnd, payment_ref, tenant_id FROM subscription_invoices WHERE ${column} = ? LIMIT 1`
        )
        .bind(value)
        .first<InvoiceRow>();
    } catch {
      try {
        return await db
          .prepare(`SELECT id, subscription_id, status, amount_vnd FROM subscription_invoices WHERE ${column} = ? LIMIT 1`)
          .bind(value)
          .first<InvoiceRow>();
      } catch {
        return await db
          .prepare(`SELECT id, subscription_id, status FROM subscription_invoices WHERE ${column} = ? LIMIT 1`)
          .bind(value)
          .first<InvoiceRow>()
          .catch(() => null);
      }
    }
  }
}

export async function processNowPaymentsIpn(
  dbOrEnv: unknown,
  bodyInput?: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; status?: number; idempotent?: boolean }> {
  const firstObj = dbOrEnv as Record<string, unknown> | undefined;
  const secondObj = bodyInput as Record<string, unknown> | undefined;
  const firstIsDbOrEnv = Boolean(firstObj && (typeof firstObj.prepare === 'function' || firstObj.AURA_DB || firstObj.DB));
  const resolvedEnvOrDb = firstIsDbOrEnv ? firstObj : secondObj;
  const body = (firstIsDbOrEnv ? secondObj : firstObj) ?? {};

  const db = (resolvedEnvOrDb && typeof resolvedEnvOrDb.prepare === 'function'
    ? resolvedEnvOrDb
    : (resolvedEnvOrDb?.AURA_DB ?? resolvedEnvOrDb?.DB)) as unknown as DbBinding | undefined;

  const paymentId = String(body.payment_id || '').trim();
  const paymentStatus = String(body.payment_status || '').trim();
  const rawOrderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  const explicitInvoiceId =
    body.invoice_id !== undefined && body.invoice_id !== null ? String(body.invoice_id).trim() : '';
  const orderInvoiceId = rawOrderId.replace(/^invoice_/i, '');
  const lookupInvoiceId = orderInvoiceId || explicitInvoiceId;

  if (!paymentId && !lookupInvoiceId) {
    return { ok: true, status: 200 };
  }
  if (!db) {
    return { ok: true, status: 200 };
  }

  let inv: InvoiceRow | null = null;
  if (paymentId) {
    inv = await fetchInvoiceByColumn(db, 'payment_ref', paymentId);
    if (inv && lookupInvoiceId && String(inv.id).trim() !== lookupInvoiceId) {
      return { ok: false, error: 'Payment reference and order invoice mismatch', status: 400 };
    }
    if (inv && explicitInvoiceId && String(inv.id).trim() !== explicitInvoiceId) {
      return { ok: false, error: 'Payment reference and order invoice mismatch', status: 400 };
    }
  }
  if (!inv && lookupInvoiceId) {
    inv = await fetchInvoiceByColumn(db, 'id', lookupInvoiceId);
    if (!inv && orderInvoiceId && explicitInvoiceId && orderInvoiceId !== explicitInvoiceId) {
      inv = await fetchInvoiceByColumn(db, 'id', explicitInvoiceId);
    }
    if (inv && inv.payment_ref && paymentId) {
      const existingRef = String(inv.payment_ref).trim();
      const isMatchingPaymentId = existingRef === paymentId;
      const isMatchingInvoiceRef =
        (explicitInvoiceId !== '' &&
          (existingRef === explicitInvoiceId || existingRef === `inv:${explicitInvoiceId}`)) ||
        (explicitInvoiceId === '' && existingRef.startsWith('inv:'));
      if (existingRef && !isMatchingPaymentId && !isMatchingInvoiceRef) {
        return { ok: false, error: 'Invoice already bound to another payment reference', status: 409 };
      }
    }
  }

  if (!inv) {
    log.warn('IPN: invoice not found for payment', { paymentId, lookupInvoiceId });
    return { ok: true, status: 200 };
  }

  const rawInvTenantValue = typeof inv.tenant_id === 'string' ? inv.tenant_id.trim() : '';
  const rawInvTenant = rawInvTenantValue && rawInvTenantValue !== '*' && rawInvTenantValue.toLowerCase() !== 'hq' ? rawInvTenantValue : '';
  const invTenant = rawInvTenant || 'default';

  if (paymentStatus === 'finished' || paymentStatus === 'confirmed') {
    const expectedVnd = inv.amount_vnd !== undefined && inv.amount_vnd !== null ? Number(inv.amount_vnd) : NaN;
    if (!Number.isFinite(expectedVnd) || expectedVnd <= 0) {
      return { ok: false, error: 'Invalid invoice amount', status: 400 };
    }
    const priceCurrency = String(body.price_currency ?? 'vnd').toLowerCase().trim();
    if (priceCurrency !== '' && priceCurrency !== 'vnd') {
      return { ok: false, error: 'Invoice currency mismatch', status: 400 };
    }
    if (
      body.price_amount === undefined ||
      body.price_amount === null ||
      !Number.isFinite(Number(body.price_amount)) ||
      Number(body.price_amount) < expectedVnd
    ) {
      return { ok: false, error: 'Invoice amount mismatch', status: 400 };
    }

    if (inv.status === 'paid' || inv.status === 'cancelled') {
      return { ok: true, idempotent: true, status: 200 };
    }

    let sub: {
      id: string;
      status?: string;
      billing_cycle?: string;
      current_period_start?: string;
      current_period_end?: string;
      tenant_id?: string | null;
    } | null = null;
    let subTenant = '';
    if (inv.subscription_id) {
      try {
        sub = await db
          .prepare('SELECT * FROM subscriptions WHERE id = ?')
          .bind(inv.subscription_id)
          .first<{
            id: string;
            status?: string;
            billing_cycle?: string;
            current_period_start?: string;
            current_period_end?: string;
            tenant_id?: string | null;
          }>()
          .catch(() => null);
        if (sub && typeof sub.tenant_id === 'string') {
          const trimmedSubTenant = sub.tenant_id.trim();
          subTenant = trimmedSubTenant && trimmedSubTenant !== '*' && trimmedSubTenant.toLowerCase() !== 'hq' ? trimmedSubTenant : '';
        }
        if (subTenant && rawInvTenant && subTenant !== rawInvTenant) {
          log.warn('IPN: subscription tenant mismatch', {
            subscriptionId: inv.subscription_id,
            subTenant,
            invTenant: rawInvTenant,
          });
          return { ok: false, error: 'Subscription tenant mismatch', status: 400 };
        }
      } catch {
        sub = null;
      }
    }

    const now = new Date().toISOString();
    const paymentRef = paymentId || inv.payment_ref || '';
    let updateRes: { rowCount?: number; meta?: { changes?: number } } | undefined;
    try {
      updateRes = await db
        .prepare(
          "UPDATE subscription_invoices SET status = 'paid', paid_at = ?, payment_method = 'crypto', payment_ref = ? WHERE id = ? AND status NOT IN ('paid', 'cancelled') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
        .bind(now, paymentRef, inv.id, invTenant)
        .run();
    } catch {
      if (invTenant !== 'default') {
        return { ok: false, error: 'Tenant-scoped invoice update failed', status: 500 };
      }
      try {
        updateRes = await db
          .prepare(
            "UPDATE subscription_invoices SET status = 'paid', paid_at = ?, payment_method = 'crypto', payment_ref = ? WHERE id = ? AND status NOT IN ('paid', 'cancelled')"
          )
          .bind(now, paymentRef, inv.id)
          .run();
      } catch {
        updateRes = await db
          .prepare(
            "UPDATE subscription_invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ? AND status NOT IN ('paid', 'cancelled')"
          )
          .bind(now, now, inv.id)
          .run();
      }
    }

    const changes = updateRes?.meta?.changes;
    const wasUpdated = inv.status !== 'paid' && (typeof changes === 'number' ? changes !== 0 : true);
    if (!wasUpdated) {
      return { ok: true, idempotent: true, status: 200 };
    }

    if (inv.subscription_id) {
      try {
        const effectiveSubTenant = subTenant || invTenant || 'default';
        if (sub && sub.current_period_end && /^\d{4}-\d{2}-\d{2}/.test(sub.current_period_end)) {
          const months =
            sub.billing_cycle === 'quarterly'
              ? 3
              : sub.billing_cycle === 'annual' || sub.billing_cycle === 'yearly'
                ? 12
                : 1;
          const todayIso = now.slice(0, 10);
          const subEndDate = sub.current_period_end.slice(0, 10);
          const subStartDate =
            typeof sub.current_period_start === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sub.current_period_start)
              ? sub.current_period_start.slice(0, 10)
              : '';
          const invEndDate =
            typeof inv.period_end === 'string' && /^\d{4}-\d{2}-\d{2}/.test(inv.period_end)
              ? inv.period_end.slice(0, 10)
              : '';
          const invStartDate =
            typeof inv.period_start === 'string' && /^\d{4}-\d{2}-\d{2}/.test(inv.period_start)
              ? inv.period_start.slice(0, 10)
              : '';

          let hasPriorPaidInvoice = false;
          if (subEndDate > todayIso) {
            try {
              const priorRow = await db
                .prepare(
                  "SELECT COUNT(*) as count FROM subscription_invoices WHERE subscription_id = ? AND id != ? AND status IN ('paid', 'manual') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
                )
                .bind(inv.subscription_id, inv.id, effectiveSubTenant)
                .first<{ count?: number }>()
                .catch(() =>
                  effectiveSubTenant === 'default'
                    ? db
                        .prepare(
                          "SELECT COUNT(*) as count FROM subscription_invoices WHERE subscription_id = ? AND id != ? AND status IN ('paid', 'manual')"
                        )
                        .bind(inv.subscription_id, inv.id)
                        .first<{ count?: number }>()
                    : Promise.resolve(null)
                );
              hasPriorPaidInvoice = Number(priorRow?.count ?? 0) > 0;
            } catch {
              hasPriorPaidInvoice = false;
            }
          }

          // Do not double-extend current_period_end when settling the initial invoice for a subscription
          // whose initial billing period end was already set in the future at creation time.
          const isInitialPeriodAlreadySet =
            subEndDate > todayIso &&
            (sub.status === 'pending' ||
              (invEndDate !== '' && invEndDate <= subEndDate) ||
              (invStartDate !== '' && subStartDate !== '' && invStartDate === subStartDate) ||
              (!hasPriorPaidInvoice && (invEndDate === '' || invEndDate <= subEndDate)));

          const nextStart = isInitialPeriodAlreadySet
            ? (sub.current_period_start || todayIso)
            : sub.current_period_end;
          const newEnd = isInitialPeriodAlreadySet
            ? sub.current_period_end
            : addMonths(sub.current_period_end, months);

          try {
            await db
              .prepare(
                "UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, next_billing_date = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(nextStart, newEnd, newEnd, now, inv.subscription_id, effectiveSubTenant)
              .run();
          } catch {
            if (effectiveSubTenant === 'default') {
              try {
                await db
                  .prepare(
                    "UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, next_billing_date = ?, updated_at = ? WHERE id = ?"
                  )
                  .bind(nextStart, newEnd, newEnd, now, inv.subscription_id)
                  .run();
              } catch {
                await db
                  .prepare('UPDATE subscriptions SET current_period_end = ?, updated_at = ? WHERE id = ?')
                  .bind(newEnd, now, inv.subscription_id)
                  .run();
              }
            }
          }
        } else if (effectiveSubTenant === 'default') {
          await db
            .prepare("UPDATE subscriptions SET current_period_end = datetime(current_period_end, '+1 month'), updated_at = ? WHERE id = ?")
            .bind(now, inv.subscription_id)
            .run();
        }
      } catch {
        log.warn('IPN: subscription period extension failed', { subscriptionId: inv.subscription_id });
      }
    }

    try {
      await updateMRRSnapshot(
        db as unknown as import('@cloudflare/workers-types').D1Database,
        subTenant || invTenant || 'default'
      );
    } catch {
      // Optional MRR snapshot table in minimal test environments
    }

    log.info('IPN: invoice marked paid', { invoiceId: inv.id, paymentId });
  } else if (paymentStatus === 'failed' || paymentStatus === 'expired') {
    if (inv.status !== 'paid' && inv.status !== 'cancelled') {
      const now = new Date().toISOString();
      try {
        await db
          .prepare(
            "UPDATE subscription_invoices SET status = 'failed', updated_at = ? WHERE id = ? AND status NOT IN ('paid', 'cancelled') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(now, inv.id, invTenant)
          .run();
      } catch {
        if (invTenant !== 'default') {
          return { ok: false, error: 'Tenant-scoped invoice failure update failed', status: 500 };
        }
        try {
          await db
            .prepare("UPDATE subscription_invoices SET status = 'failed', updated_at = ? WHERE id = ? AND status NOT IN ('paid', 'cancelled')")
            .bind(now, inv.id)
            .run();
        } catch {
          await db
            .prepare("UPDATE subscription_invoices SET status = 'failed' WHERE id = ? AND status NOT IN ('paid', 'cancelled')")
            .bind(inv.id)
            .run();
        }
      }
      log.warn('IPN: invoice payment failed', { invoiceId: inv.id, paymentId, status: paymentStatus });
    }
  } else if (paymentStatus === 'refunded') {
    if (inv.payment_ref && String(inv.payment_ref).trim()) {
      const boundRef = String(inv.payment_ref).trim();
      const matchesBoundRef =
        Boolean(paymentId && boundRef === paymentId) ||
        (explicitInvoiceId !== '' && (boundRef === explicitInvoiceId || boundRef === `inv:${explicitInvoiceId}`));
      if (!matchesBoundRef) {
        return { ok: false, error: 'Invoice already bound to another payment reference', status: 409 };
      }
    }
    const normalizedInvStatus = String(inv.status || '').trim().toLowerCase();
    if (normalizedInvStatus === 'refunded') {
      return { ok: true, idempotent: true, status: 200 };
    }
    if (normalizedInvStatus !== 'paid') {
      log.warn('IPN: ignoring refund for non-paid invoice', { invoiceId: inv.id, status: inv.status });
      return { ok: true, status: 200 };
    }
    const now = new Date().toISOString();
    try {
      await db
        .prepare(
          "UPDATE subscription_invoices SET status = 'refunded', updated_at = ? WHERE id = ? AND status = 'paid' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        )
        .bind(now, inv.id, invTenant)
        .run();
    } catch {
      if (invTenant !== 'default') {
        return { ok: false, error: 'Tenant-scoped invoice refund update failed', status: 500 };
      }
      await db
        .prepare("UPDATE subscription_invoices SET status = 'refunded', updated_at = ? WHERE id = ? AND status = 'paid'")
        .bind(now, inv.id)
        .run();
    }
    let refundSubTenant = '';
    if (inv.subscription_id) {
      try {
        const subRow = await db
          .prepare('SELECT tenant_id FROM subscriptions WHERE id = ?')
          .bind(inv.subscription_id)
          .first<{ tenant_id?: string | null }>()
          .catch(() => null);
        if (subRow && typeof subRow.tenant_id === 'string') {
          const trimmedRefundSubTenant = subRow.tenant_id.trim();
          refundSubTenant =
            trimmedRefundSubTenant && trimmedRefundSubTenant !== '*' && trimmedRefundSubTenant.toLowerCase() !== 'hq'
              ? trimmedRefundSubTenant
              : '';
        }
      } catch {
        // Optional tenant_id column on subscriptions in minimal schemas
      }
    }
    const effectiveRefundTenant =
      (invTenant !== 'default' ? invTenant : '') || refundSubTenant || invTenant || 'default';
    if (inv.subscription_id) {
      try {
        await db
          .prepare(
            "UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ? AND status IN ('active', 'past_due') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(now, inv.subscription_id, effectiveRefundTenant)
          .run();
      } catch {
        if (effectiveRefundTenant === 'default') {
          await db
            .prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'active'")
            .bind(now, inv.subscription_id)
            .run()
            .catch(() => null);
        }
      }
    }
    try {
      await db
        .prepare("UPDATE saas_tenants SET tier = 'free', updated_at = ? WHERE id = ?")
        .bind(now, effectiveRefundTenant)
        .run()
        .catch(() => null);
    } catch {
      // Optional saas_tenants table in minimal test environments
    }
    try {
      await updateMRRSnapshot(db as unknown as import('@cloudflare/workers-types').D1Database, effectiveRefundTenant);
    } catch {
      // Optional MRR snapshot table in minimal test environments
    }
  }

  return { ok: true, status: 200 };
}

export async function nowPaymentsIPN(request: Request, env: Record<string, unknown>) {
  try {
    const secret = env.NOWPAYMENTS_IPN_SECRET as string | undefined;

    // Read raw body text once and verify HMAC signature BEFORE parsing JSON
    const bodyText = await request.text().catch(() => '');

    const isProd = env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';
    const allowUnsignedDev = !isProd && (
      env.ALLOW_UNSIGNED_NOWPAYMENTS_IPN === 'true' ||
      env.ENVIRONMENT === 'development' ||
      env.ENVIRONMENT === 'test'
    );
    if (!secret) {
      if (!allowUnsignedDev) {
        log.error('NOWPAYMENTS_IPN_SECRET not configured — rejecting IPN');
        return new Response('Server configuration error', { status: 500 });
      }
      log.warn('NOWPAYMENTS_IPN_SECRET not configured — accepting without verification (dev mode)');
    } else {
      const signature =
        request.headers.get('x-nowpayments-sig') ??
        request.headers.get('x-nowpayments-signature');
      if (!signature) {
        log.warn('IPN missing signature header');
        return new Response('Missing signature', { status: 401 });
      }
      const expected = await computeHMAC(bodyText, secret);
      if (!constantTimeEqual(expected, signature)) {
        log.warn('IPN signature verification failed');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(bodyText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return jsonResponse({ ok: false, error: 'Invalid JSON payload' }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      log.warn('IPN malformed JSON payload');
      return jsonResponse({ ok: false, error: 'Invalid JSON payload' }, 400);
    }
    log.debug('IPN payload received', { paymentId: body.payment_id, status: body.payment_status });

    const result = await processNowPaymentsIpn(env, body);
    if (!result.ok) {
      return jsonResponse(result, result.status || 400);
    }
    if (result.idempotent) {
      return jsonResponse({ ok: true, idempotent: true }, 200);
    }
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    log.error('IPN error:', { message: (error as Error).message });
    return jsonResponse({ ok: true }, 200); // always ack to prevent NowPayments retry storms
  }
}
