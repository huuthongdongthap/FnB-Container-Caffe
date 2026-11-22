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

type WriteResult = { meta?: { changes?: number } };
type BoundStatement = {
  run(): Promise<WriteResult>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};
type DbBinding = {
  prepare(_sql: string): { bind(..._a: unknown[]): BoundStatement };
  batch(_statements: BoundStatement[]): Promise<WriteResult[]>;
};

function missingColumn(error: unknown): boolean {
  return error instanceof Error && /no such column/i.test(error.message);
}

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
  return db.prepare(`SELECT * FROM subscription_invoices WHERE ${column} = ? LIMIT 1`)
    .bind(value).first<InvoiceRow>();
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
    if (inv.subscription_id) {
      if (!sub || !sub.current_period_end || !/^\d{4}-\d{2}-\d{2}/.test(sub.current_period_end)) {
        return { ok: false, error: 'Subscription unavailable for settlement', status: 500 };
      }
      if (typeof db.batch !== 'function') {
        return { ok: false, error: 'Atomic settlement unavailable', status: 500 };
      }
      try {
        const effectiveSubTenant = subTenant || invTenant || 'default';
        {
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
                .catch((error: unknown) =>
                  missingColumn(error) && effectiveSubTenant === 'default'
                    ? db
                        .prepare(
                          "SELECT COUNT(*) as count FROM subscription_invoices WHERE subscription_id = ? AND id != ? AND status IN ('paid', 'manual')"
                        )
                        .bind(inv.subscription_id, inv.id)
                        .first<{ count?: number }>()
                    : Promise.reject(error)
                );
              hasPriorPaidInvoice = Number(priorRow?.count ?? 0) > 0;
            } catch {
              return { ok: false, error: 'Subscription billing history unavailable', status: 500 };
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

          const settle = async (legacy: boolean) => {
            const invoiceScope = legacy ? '' : " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
            const subScope = legacy ? '' : " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
            const invoiceArgs = legacy ? [] : [rawInvTenantValue || 'default'];
            const subArgs = legacy ? [] : [typeof sub.tenant_id === 'string' ? sub.tenant_id.trim() || 'default' : 'default'];
            // D1 batch is transactional. The second write can settle only the subscription
            // changed by the immediately preceding statement in this same transaction.
            return db.batch([
              db.prepare(
                "UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, next_billing_date = ?, updated_at = ? WHERE id = ?" + subScope +
                " AND current_period_end = ? AND EXISTS (SELECT 1 FROM subscription_invoices WHERE id = ? AND subscription_id = ? AND status = ? AND COALESCE(payment_ref, '') = ?" + invoiceScope + ")"
              ).bind(nextStart, newEnd, newEnd, now, inv.subscription_id, ...subArgs,
                sub.current_period_end, inv.id, inv.subscription_id, inv.status, inv.payment_ref || '', ...invoiceArgs),
              db.prepare(
                "UPDATE subscription_invoices SET status = 'paid', paid_at = ?, payment_method = 'crypto', payment_ref = ? WHERE id = ? AND status = ? AND changes() = 1" + invoiceScope
              ).bind(now, paymentRef, inv.id, inv.status, ...invoiceArgs),
            ]);
          };
          let results: WriteResult[];
          try {
            results = await settle(false);
          } catch (error) {
            if (!missingColumn(error) || invTenant !== 'default' || effectiveSubTenant !== 'default') throw error;
            // Only schemas predating tenant columns may use unscoped writes.
            if ('tenant_id' in inv || 'tenant_id' in sub) throw error;
            results = await settle(true);
          }
          if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) {
            const current = await fetchInvoiceByColumn(db, 'id', inv.id);
            if (current?.status === 'paid' && current.payment_ref === paymentRef) {
              return { ok: true, idempotent: true, status: 200 };
            }
            return { ok: false, error: 'Settlement state changed; retry required', status: 500 };
          }
        }
      } catch {
        return { ok: false, error: 'Subscription settlement failed', status: 500 };
      }
    } else {
      try {
        const settleStandalone = async (legacy: boolean) => {
          const invoiceScope = legacy ? '' : " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
          const invoiceArgs = legacy ? [] : [rawInvTenantValue || 'default'];
          return db
            .prepare(
              "UPDATE subscription_invoices SET status = 'paid', paid_at = ?, payment_method = 'crypto', payment_ref = ? WHERE id = ? AND status = ? AND COALESCE(payment_ref, '') = ?" +
                invoiceScope
            )
            .bind(now, paymentRef, inv.id, inv.status, inv.payment_ref || '', ...invoiceArgs)
            .run();
        };
        let result: WriteResult;
        try {
          result = await settleStandalone(false);
        } catch (error) {
          if (!missingColumn(error) || invTenant !== 'default' || 'tenant_id' in inv) throw error;
          result = await settleStandalone(true);
        }
        if (result?.meta?.changes !== 1) {
          const current = await fetchInvoiceByColumn(db, 'id', inv.id);
          if (current?.status === 'paid' && current.payment_ref === paymentRef) {
            return { ok: true, idempotent: true, status: 200 };
          }
          return { ok: false, error: 'Settlement state changed; retry required', status: 500 };
        }
      } catch {
        return { ok: false, error: 'Invoice settlement failed', status: 500 };
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
    let effectiveRefundTenant = invTenant;
    try {
      const sub = inv.subscription_id
        ? await db.prepare('SELECT * FROM subscriptions WHERE id = ?')
            .bind(inv.subscription_id).first<{ tenant_id?: string | null }>()
        : null;
      if (inv.subscription_id && !sub) {
        return { ok: false, error: 'Subscription unavailable for refund', status: 500 };
      }
      const subTenant = sub?.tenant_id?.trim() || 'default';
      const refundSubTenant = subTenant !== '*' && subTenant.toLowerCase() !== 'hq' ? subTenant : 'default';
      effectiveRefundTenant = invTenant !== 'default' ? invTenant : refundSubTenant;
      if (sub && refundSubTenant !== effectiveRefundTenant) {
        return { ok: false, error: 'Invoice and subscription tenant mismatch', status: 400 };
      }
      const tenantScope = " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
      const invoiceScope = 'tenant_id' in inv ? tenantScope : '';
      const subScope = sub && 'tenant_id' in sub ? tenantScope : '';
      if (effectiveRefundTenant !== 'default' && (!invoiceScope || (sub && !subScope))) {
        return { ok: false, error: 'Tenant-scoped invoice refund update failed', status: 500 };
      }
      const subArgs = [inv.subscription_id, ...(subScope ? [subTenant] : [])];
      // A cancellation error rolls back the invoice transition so delivery can
      // retry. A duplicate invoice transition must not cancel a subscription again.
      const [invoiceResult] = await db.batch([
        db.prepare(
          "UPDATE subscription_invoices SET status = 'refunded', updated_at = ? WHERE id = ? AND status = 'paid' AND COALESCE(payment_ref, '') = ?" +
          invoiceScope + (sub ? ` AND subscription_id = ? AND EXISTS (SELECT 1 FROM subscriptions WHERE id = ?${subScope})` : ''),
        ).bind(now, inv.id, inv.payment_ref ?? '', ...(invoiceScope ? [rawInvTenantValue || 'default'] : []),
          ...(sub ? [inv.subscription_id, ...subArgs] : [])),
        ...(sub ? [db.prepare(
          "UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ? AND status IN ('active', 'past_due') AND changes() = 1" + subScope,
        ).bind(now, ...subArgs)] : []),
      ]);
      if (invoiceResult?.meta?.changes !== 1) {
        const current = await fetchInvoiceByColumn(db, 'id', inv.id);
        if (current?.status === 'refunded' && current.payment_ref === inv.payment_ref) {
          return { ok: true, idempotent: true, status: 200 };
        }
        return { ok: false, error: 'Refund state changed; retry required', status: 500 };
      }
    } catch {
      return { ok: false, error: 'Subscription refund failed', status: 500 };
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
    return jsonResponse({ ok: false, error: 'Payment processing failed' }, 500);
  }
}
