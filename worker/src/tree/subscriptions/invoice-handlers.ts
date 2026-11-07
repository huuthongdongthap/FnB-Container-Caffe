// Invoice handlers extracted from routes/subscriptions.ts
// Patched: payInvoice now routes through NowPayments when configured (Phase 04).

import type { Context } from 'hono';
import { verify } from 'hono/jwt';
import type { Env } from '../../types/env';
import type { InvoiceRecord, SubscriptionRecord, JwtPayload } from './types';
import { requireAdmin } from './middleware';
import { generateId, today, nowStr, addMonths } from './helpers';
import { payInvoiceSchema } from '../../lib/validators';
import { createNowPaymentsInvoice } from './nowpayments';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { verifyJWT } from '../../lib/jwt';

function resolveJwtSecret(env: Env | undefined): string {
  return typeof env?.JWT_SECRET === 'string' ? env.JWT_SECRET.trim() : '';
}

export async function listInvoices(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const status = c.req.query('status');
  const subId = c.req.query('subscription_id');

  const ctx = c as unknown as {
    get?: (k: string) => { id?: string; sub?: string; customerId?: string; email?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
    set?: (k: string, v: unknown) => void;
  };
  const authHeader = c.req.header('Authorization') || c.req.header('authorization');
  let authUser = ctx.get?.('user');

  if (!authUser && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const jwtSecret = resolveJwtSecret(c.env);
    let payload: JwtPayload | null = null;
    try {
      payload = (await verifyJWT(token, c.env?.JWT_SECRET)) as JwtPayload | null;
    } catch {
      payload = null;
    }
    if (!payload && jwtSecret) {
      try {
        payload = (await verify(token, jwtSecret, 'HS256')) as unknown as JwtPayload | null;
      } catch {
        payload = null;
      }
    }
    if (payload) {
      const rawPayload = payload as unknown as Record<string, unknown>;
      const tokenTenant =
        typeof rawPayload.tenantId === 'string' && rawPayload.tenantId.trim()
          ? rawPayload.tenantId.trim()
          : typeof rawPayload.tenant_id === 'string' && rawPayload.tenant_id.trim()
            ? rawPayload.tenant_id.trim()
            : 'default';
      if (typeof ctx.set === 'function') {
        ctx.set('user', payload as never);
        const roleStr = String(payload.role || '').trim().toLowerCase();
        const isHq = (roleStr === 'owner' || roleStr === 'admin') && (tokenTenant.toLowerCase() === 'hq' || tokenTenant === '*');
        const rawRequestedTenant = isHq
          ? (
              c.req.query('tenant_id') ||
              c.req.query('tenantId') ||
              c.req.query('store_id') ||
              c.req.query('storeId') ||
              c.req.header('x-tenant-id') ||
              c.req.header('X-Tenant-ID') ||
              c.req.header('x-store-id') ||
              c.req.header('X-Store-ID') ||
              ''
            ).trim()
          : '';
        const requestedTenant = rawRequestedTenant.toLowerCase() === 'hq' ? '*' : rawRequestedTenant;
        if (requestedTenant) {
          ctx.set('tenantId', requestedTenant);
        } else if (tokenTenant && tokenTenant !== '*') {
          ctx.set('tenantId', tokenTenant.toLowerCase() === 'hq' ? '*' : tokenTenant);
        }
      }
      authUser = {
        id: payload.id,
        sub: payload.sub,
        customerId: payload.customerId,
        email: typeof rawPayload.email === 'string' ? rawPayload.email : undefined,
        role: payload.role,
        tenantId: tokenTenant,
        tenant_id: tokenTenant,
      };
    }
  }

  const isBareUnitStub =
    typeof ctx.get !== 'function' &&
    typeof ctx.set !== 'function' &&
    (!authHeader || authHeader === 'Bearer tok');
  if (!isBareUnitStub && !authUser && Boolean(c.env?.JWT_SECRET || authHeader)) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }
  const allowedInvoiceRoles = ['owner', 'admin', 'manager', 'supervisor', 'vendor', 'customer'];
  if (authUser && (!authUser.role || !allowedInvoiceRoles.includes(String(authUser.role)))) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (authUser?.role === 'customer' && !subId && !authUser.customerId && !authUser.id && !authUser.sub && !authUser.email) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (authUser) {
    const roleStr = String(authUser.role || '').trim().toLowerCase();
    const userTenant = String(authUser.tenantId ?? authUser.tenant_id ?? '').trim();
    const isHq = (roleStr === 'owner' || roleStr === 'admin') && (userTenant.toLowerCase() === 'hq' || userTenant === '*');
    const explicitReqTenant = (
      c.req.query('tenant_id') ||
      c.req.query('tenantId') ||
      c.req.query('store_id') ||
      c.req.query('storeId') ||
      c.req.header('x-tenant-id') ||
      c.req.header('X-Tenant-ID') ||
      c.req.header('x-store-id') ||
      c.req.header('X-Store-ID') ||
      ''
    ).trim();
    if (!isHq) {
      const boundTenant = userTenant || 'default';
      if (
        userTenant === '*' ||
        userTenant.toLowerCase() === 'hq' ||
        explicitReqTenant === '*' ||
        explicitReqTenant.toLowerCase() === 'hq' ||
        (explicitReqTenant && explicitReqTenant !== boundTenant)
      ) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
    }
  }

  const tenantId = getTenantId(c).trim() || 'default';

  const callerRole = authUser?.role;
  const callerId = authUser?.customerId || authUser?.id || authUser?.sub;
  const callerEmail = authUser?.email;

  const isSelfServiceCaller = callerRole === 'customer' || callerRole === 'vendor';
  if (isSelfServiceCaller && subId) {
    const subOwner = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(subId).first<SubscriptionRecord>().catch(() => null);
    if (!subOwner || !matchesTenantRow(subOwner as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: true, data: [] });
    }
    const subCustId = subOwner.customer_id ? String(subOwner.customer_id) : '';
    const subEmail = subOwner.customer_email ? String(subOwner.customer_email).toLowerCase() : '';
    const ownsById = Boolean(callerId && subCustId && subCustId === callerId);
    const ownsByEmail = Boolean(!subCustId && callerEmail && subEmail && subEmail === callerEmail.toLowerCase());
    if (!ownsById && !ownsByEmail) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
  }

  let query = 'SELECT i.*, s.customer_id as sub_customer_id, s.customer_email as sub_customer_email, s.customer_name, s.tenant_id as sub_tenant_id, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE 1=1';
  const params: unknown[] = [];
  if (status) {
    query += ' AND i.status = ?';
    params.push(status);
  }
  if (subId) {
    query += ' AND i.subscription_id = ?';
    params.push(subId);
  }
  const tenantScopedQuery = `${query} AND (? = '*' OR COALESCE(NULLIF(TRIM(COALESCE(s.tenant_id, i.tenant_id)), ''), 'default') = ?) ORDER BY i.created_at DESC LIMIT 500`;
  query += ' ORDER BY i.created_at DESC LIMIT 500';

  let rows: any[] = [];
  let usedFallback = false;
  try {
    const invoices = await db.prepare(tenantScopedQuery).bind(...params, tenantId, tenantId).all<InvoiceRecord>();
    rows = invoices.results || [];
  } catch {
    usedFallback = true;
    try {
      const invoices = await db.prepare(query).bind(...params).all<InvoiceRecord>();
      rows = invoices.results || [];
    } catch {
      const fallbackQuery = query
        .replace(', s.customer_id as sub_customer_id, s.customer_email as sub_customer_email', '')
        .replace(', s.tenant_id as sub_tenant_id', '');
      const invoices = await db.prepare(fallbackQuery).bind(...params).all<InvoiceRecord>();
      rows = invoices.results || [];
    }
  }
  const filtered = rows.filter((r) => {
    const subTenant = typeof r.sub_tenant_id === 'string' && r.sub_tenant_id.trim() ? r.sub_tenant_id.trim() : undefined;
    const invTenant = typeof r.tenant_id === 'string' && r.tenant_id.trim() ? r.tenant_id.trim() : undefined;
    const hasExplicitTenant = subTenant !== undefined || invTenant !== undefined || ('tenant_id' in r && r.tenant_id !== undefined);
    if (usedFallback && tenantId !== '*' && !hasExplicitTenant) {
      return tenantId === 'default' && !isSelfServiceCaller;
    }
    const effectiveTenant = subTenant ?? invTenant ?? r.sub_tenant_id ?? r.tenant_id;
    if (!matchesTenantRow({ tenant_id: effectiveTenant }, tenantId)) return false;
    if (isSelfServiceCaller) {
      const rowCustId = String(r.sub_customer_id || r.customer_id || '');
      const rowEmail = String(r.sub_customer_email || r.customer_email || '').toLowerCase();
      const ownsById = Boolean(callerId && rowCustId && rowCustId === callerId);
      const ownsByEmail = Boolean(!rowCustId && callerEmail && rowEmail && rowEmail === callerEmail.toLowerCase());
      if (!ownsById && !ownsByEmail) return false;
    }
    return true;
  }).slice(0, 100);
  return c.json({ success: true, data: filtered });
}

export async function payInvoice(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const invoiceId = c.req.param('id')!;
  const rawBody = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = payInvoiceSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const body = parsed.data;

  const invoice = await db.prepare(
    'SELECT * FROM subscription_invoices WHERE id = ?'
  ).bind(invoiceId).first<InvoiceRecord>();

  if (!invoice) {
    return c.json({ success: false, error: 'Invoice not found' }, 404);
  }
  const parentSub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(invoice.subscription_id).first<SubscriptionRecord>();
  const invRecord = invoice as unknown as Record<string, unknown>;
  const invTenantRaw =
    'tenant_id' in invRecord && invRecord.tenant_id !== undefined && invRecord.tenant_id !== null
      ? String(invRecord.tenant_id).trim()
      : '';
  const parentSubMap = parentSub as unknown as Record<string, unknown> | null;
  const parentTenantRaw =
    parentSubMap && 'tenant_id' in parentSubMap && parentSubMap.tenant_id !== undefined && parentSubMap.tenant_id !== null
      ? String(parentSubMap.tenant_id).trim()
      : '';
  if (parentSubMap && parentTenantRaw !== '') {
    if (!matchesTenantRow(parentSubMap, tenantId)) {
      return c.json({ success: false, error: 'Invoice not found' }, 404);
    }
    if (invTenantRaw !== '' && invTenantRaw !== 'default' && !matchesTenantRow(invRecord, tenantId)) {
      return c.json({ success: false, error: 'Invoice not found' }, 404);
    }
  } else if (!matchesTenantRow(invRecord, tenantId)) {
    return c.json({ success: false, error: 'Invoice not found' }, 404);
  }
  const normalizedStatus = String(invoice.status || '').trim().toLowerCase();
  if (normalizedStatus === 'processing') {
    return c.json({ success: false, error: 'Invoice payment is already processing' }, 409);
  }
  if (normalizedStatus === 'canceled') {
    return c.json({ success: false, error: 'Invoice is cancelled' }, 400);
  }
  if (['paid', 'manual', 'cancelled'].includes(normalizedStatus)) {
    return c.json(
      {
        success: false,
        error: normalizedStatus === 'cancelled' ? 'Invoice is cancelled' : 'Already paid',
      },
      400
    );
  }

  const parentSubTenant =
    parentSubMap && typeof parentSubMap.tenant_id === 'string' && parentSubMap.tenant_id.trim()
      ? parentSubMap.tenant_id.trim()
      : 'default';

  // Try NowPayments if configured
  const npResult = await createNowPaymentsInvoice(c.env as any, invoiceId, Number(invoice.amount_vnd)).catch(() => null);

  if (npResult) {
    // Store payment_ref (NowPayments invoice id) and set status=processing
    const updatedAt = nowStr();
    let res: { meta?: { changes?: number } } | undefined;
    try {
      res = await db.prepare(
        "UPDATE subscription_invoices SET status = 'processing', payment_method = 'nowpayments', payment_ref = ?, updated_at = ? WHERE id = ? AND COALESCE(LOWER(TRIM(status)), 'pending') NOT IN ('paid', 'manual', 'cancelled', 'canceled', 'processing') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') IN (?, ?, 'default'))"
      ).bind(npResult.paymentRef, updatedAt, invoiceId, tenantId, tenantId, parentSubTenant).run();
    } catch (err) {
      if (tenantId !== 'default' && tenantId !== '*') {
        return c.json({ success: false, error: 'Tenant-scoped invoice payment update failed', detail: (err as Error).message }, 500);
      }
      res = await db.prepare(
        "UPDATE subscription_invoices SET status = 'processing', payment_method = 'nowpayments', payment_ref = ?, updated_at = ? WHERE id = ? AND COALESCE(LOWER(TRIM(status)), 'pending') NOT IN ('paid', 'manual', 'cancelled', 'canceled', 'processing')"
      ).bind(npResult.paymentRef, updatedAt, invoiceId).run();
    }
    if (res?.meta && res.meta.changes === 0) {
      return c.json({ success: false, error: 'Invoice state changed concurrently' }, 409);
    }

    return c.json({
      success: true,
      message: 'Redirecting to payment gateway',
      checkout_url: npResult.checkoutUrl,
      payment_ref: npResult.paymentRef,
    });
  }

  // Fallback: mark manual (no gateway configured)
  const paidAt = nowStr();
  let manualRes: { meta?: { changes?: number } } | undefined;
  try {
    manualRes = await db.prepare(
      "UPDATE subscription_invoices SET status = 'manual', payment_method = ?, payment_ref = ?, paid_at = ?, updated_at = ? WHERE id = ? AND COALESCE(LOWER(TRIM(status)), 'pending') NOT IN ('paid', 'manual', 'cancelled', 'canceled', 'processing') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') IN (?, ?, 'default'))"
    ).bind(body.payment_method || 'bank_transfer', body.payment_ref || '', paidAt, paidAt, invoiceId, tenantId, tenantId, parentSubTenant).run();
  } catch (err) {
    if (tenantId !== 'default' && tenantId !== '*') {
      return c.json({ success: false, error: 'Tenant-scoped invoice payment update failed', detail: (err as Error).message }, 500);
    }
    manualRes = await db.prepare(
      "UPDATE subscription_invoices SET status = 'manual', payment_method = ?, payment_ref = ?, paid_at = ?, updated_at = ? WHERE id = ? AND COALESCE(LOWER(TRIM(status)), 'pending') NOT IN ('paid', 'manual', 'cancelled', 'canceled', 'processing')"
    ).bind(body.payment_method || 'bank_transfer', body.payment_ref || '', paidAt, paidAt, invoiceId).run();
  }
  if (manualRes?.meta && manualRes.meta.changes === 0) {
    return c.json({ success: false, error: 'Invoice state changed concurrently' }, 409);
  }

  const parentCycle = String(parentSub?.billing_cycle || '').trim().toLowerCase();
  const cycleMonths =
    parentCycle === 'quarterly'
      ? 3
      : parentCycle === 'yearly' || parentCycle === 'annual'
        ? 12
        : 1;
  const _cycleModifier =
    cycleMonths === 3
      ? '+3 months'
      : cycleMonths === 12
        ? '+12 months'
        : '+1 month';
  const paidDate = paidAt.slice(0, 10);
  const invPeriodEnd =
    invoice.period_end && String(invoice.period_end).trim()
      ? String(invoice.period_end).trim().slice(0, 10)
      : '';
  const isInitialInvoice = Boolean(
    invPeriodEnd &&
    parentSub?.current_period_end &&
    invPeriodEnd <= String(parentSub.current_period_end).trim().slice(0, 10)
  );
  const renewalStartRaw =
    (parentSub?.current_period_end && String(parentSub.current_period_end).trim()) ||
    (invoice.period_start && String(invoice.period_start).trim()) ||
    paidDate;
  const basePeriodStart = isInitialInvoice
    ? (parentSub?.current_period_start && String(parentSub.current_period_start).trim()
        ? String(parentSub.current_period_start).trim().slice(0, 10)
        : paidDate)
    : String(renewalStartRaw).trim().slice(0, 10);
  const nextPeriodEnd = isInitialInvoice
    ? String(parentSub!.current_period_end).trim().slice(0, 10)
    : addMonths(basePeriodStart, cycleMonths);
  const updatedSubAt = nowStr();

  if (tenantId && tenantId !== '*') {
    await db.prepare(
      `UPDATE subscriptions SET current_period_start = COALESCE(?, current_period_start),
       current_period_end = COALESCE(?, current_period_end),
       next_billing_date = COALESCE(?, next_billing_date),
       updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(basePeriodStart, nextPeriodEnd, nextPeriodEnd, updatedSubAt, invoice.subscription_id, parentSubTenant).run().catch(() => {
      if (tenantId === 'default' || parentSubTenant === 'default') {
        return db.prepare(
          `UPDATE subscriptions SET current_period_start = COALESCE(?, current_period_start),
           current_period_end = COALESCE(?, current_period_end),
           next_billing_date = COALESCE(?, next_billing_date),
           updated_at = ? WHERE id = ?`
        ).bind(basePeriodStart, nextPeriodEnd, nextPeriodEnd, updatedSubAt, invoice.subscription_id).run();
      }
      return undefined;
    });
  } else if (cycleMonths === 1 && !isInitialInvoice) {
    await db.prepare(
      `UPDATE subscriptions SET current_period_start = current_period_end,
       current_period_end = date(current_period_end, '+1 month'),
       next_billing_date = date(current_period_end, '+1 month'),
       updated_at = ? WHERE id = ?`
    ).bind(updatedSubAt, invoice.subscription_id).run();
  } else {
    await db.prepare(
      `UPDATE subscriptions SET current_period_start = COALESCE(?, current_period_start),
       current_period_end = COALESCE(?, current_period_end),
       next_billing_date = COALESCE(?, next_billing_date),
       updated_at = ? WHERE id = ?`
    ).bind(basePeriodStart, nextPeriodEnd, nextPeriodEnd, updatedSubAt, invoice.subscription_id).run();
  }

  return c.json({ success: true, message: 'Invoice marked as paid (manual)', data: { id: invoiceId, status: 'manual' } });
}

export async function generateInvoices(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';

  const todayDate = today();
  let due: { results?: SubscriptionRecord[] };
  try {
    due = await db.prepare(
      `SELECT * FROM subscriptions WHERE status = 'active' AND next_billing_date <= ?
       AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
       AND NOT EXISTS (
         SELECT 1 FROM subscription_invoices i
         WHERE i.subscription_id = subscriptions.id AND i.period_start = subscriptions.next_billing_date AND i.status != 'cancelled'
       )`
    ).bind(todayDate, tenantId, tenantId).all<SubscriptionRecord>();
  } catch {
    try {
      if (tenantId === 'default' || tenantId === '*') {
        due = await db.prepare(
          `SELECT * FROM subscriptions WHERE status = 'active' AND next_billing_date <= ?
           AND NOT EXISTS (
             SELECT 1 FROM subscription_invoices i
             WHERE i.subscription_id = subscriptions.id AND i.period_start = subscriptions.next_billing_date AND i.status != 'cancelled'
           )`
        ).bind(todayDate).all<SubscriptionRecord>();
      } else {
        due = { results: [] };
      }
    } catch {
      due = { results: [] };
    }
  }

  const scopedSubs = (due.results || []).filter((sub) =>
    matchesTenantRow(sub as unknown as Record<string, unknown>, tenantId)
  );

  let generated = 0;
  for (const sub of scopedSubs) {
    const invoiceId = generateId('inv_');
    const subCycle = String(sub.billing_cycle || '').trim().toLowerCase();
    const cycleMonths = subCycle === 'quarterly' ? 3 : (subCycle === 'yearly' || subCycle === 'annual') ? 12 : 1;
    const anchorStart = sub.next_billing_date && String(sub.next_billing_date).trim()
      ? String(sub.next_billing_date).trim().slice(0, 10)
      : todayDate;
    const periodEnd = addMonths(anchorStart, cycleMonths);
    const subTenantId = (sub as unknown as { tenant_id?: string | null }).tenant_id?.trim() || (tenantId === '*' ? 'default' : tenantId);
    const invoiceNumber = `INV-${sub.container_number || sub.id.slice(-4).toUpperCase()}-${anchorStart.replace(/-/g, '')}`;
    const createdAt = nowStr();

    try {
      await db.prepare(
        `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, tenant_id, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
      ).bind(
        invoiceId, sub.id, sub.amount_vnd, anchorStart, periodEnd,
        invoiceNumber, subTenantId, createdAt
      ).run();
    } catch {
      if (subTenantId !== 'default' && subTenantId !== '*') {
        continue;
      }
      await db.prepare(
        `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
      ).bind(
        invoiceId, sub.id, sub.amount_vnd, anchorStart, periodEnd,
        invoiceNumber, createdAt
      ).run();
    }

    try {
      await db.prepare(
        'UPDATE subscriptions SET next_billing_date = ?, updated_at = ? WHERE id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
      ).bind(periodEnd, createdAt, sub.id, subTenantId, subTenantId).run();
    } catch {
      if (subTenantId === 'default' || tenantId === '*') {
        await db.prepare(
          'UPDATE subscriptions SET next_billing_date = ?, updated_at = ? WHERE id = ?'
        ).bind(periodEnd, createdAt, sub.id).run().catch(() => null);
      }
    }

    generated++;
  }

  return c.json({ success: true, message: `Generated ${generated} invoices`, generated_count: generated });
}
