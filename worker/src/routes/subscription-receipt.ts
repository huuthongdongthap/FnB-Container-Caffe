// subscription-receipt.ts — GET /api/subscriptions/invoices/:id/receipt

import { errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { getTenantId, matchesTenantRow } from '../lib/db';
import type { Context } from 'hono';
import type { Env } from '../types/env';

const log = createLogger({ route: 'receipt' });

const ALLOWED_RECEIPT_STAFF_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'supervisor',
  'cashier',
]);

export async function getInvoiceReceipt(c: Context<{ Bindings: Env }>) {
  try {
    const user = (
      c as unknown as {
        get?: (k: string) => {
          id?: string;
          sub?: string;
          customerId?: string;
          email?: string;
          role?: string;
          tenantId?: string;
          tenant_id?: string;
        } | undefined;
      }
    ).get?.('user');
    const userRole = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
    if (!user || !userRole) {
      return errorResponse('Unauthorized', 401);
    }
    const isSelfServiceRole = userRole === 'customer' || userRole === 'vendor';
    if (!isSelfServiceRole && !ALLOWED_RECEIPT_STAFF_ROLES.has(userRole)) {
      return errorResponse('Forbidden', 403);
    }
    const userTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
    const isHq =
      (userRole === 'owner' || userRole === 'admin') &&
      (userTenant.toLowerCase() === 'hq' || userTenant === '*');
    const headerCandidates = [
      c.req.header?.('X-Tenant-ID'),
      c.req.header?.('x-tenant-id'),
      c.req.header?.('X-Store-ID'),
      c.req.header?.('x-store-id'),
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v) => Boolean(v) && !/^Bearer\s+/i.test(v));
    const reqCandidates = [
      c.req.query?.('tenant_id'),
      c.req.query?.('tenantId'),
      c.req.query?.('store_id'),
      c.req.query?.('storeId'),
      ...headerCandidates,
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    if (new Set(reqCandidates).size > 1) {
      return errorResponse('Cross-tenant access denied', 403);
    }
    const explicitReqTenant = reqCandidates[0] || '';
    const contextTenant = String(
      (c as unknown as { get?: (k: string) => unknown }).get?.('tenantId') ?? ''
    ).trim();
    const rawResolvedTenant = getTenantId(c).trim() || 'default';
    if (!isHq) {
      const boundTenant = userTenant || contextTenant || 'default';
      if (
        userTenant === '*' ||
        userTenant.toLowerCase() === 'hq' ||
        contextTenant === '*' ||
        contextTenant.toLowerCase() === 'hq' ||
        explicitReqTenant === '*' ||
        explicitReqTenant.toLowerCase() === 'hq' ||
        rawResolvedTenant === '*' ||
        rawResolvedTenant.toLowerCase() === 'hq' ||
        (userTenant && contextTenant && contextTenant !== userTenant) ||
        (explicitReqTenant && explicitReqTenant !== boundTenant) ||
        rawResolvedTenant !== boundTenant
      ) {
        return errorResponse('Cross-tenant access denied', 403);
      }
    }

    const invoiceId = c.req.param('id');
    const db = c.env.AURA_DB;
    const tenantId = isHq
      ? (explicitReqTenant
          ? (explicitReqTenant.toLowerCase() === 'hq' ? '*' : explicitReqTenant)
          : (rawResolvedTenant.toLowerCase() === 'hq' ? '*' : rawResolvedTenant))
      : (userTenant || contextTenant || 'default');

    let inv: Record<string, unknown> | null = null;
    let tenantColumnVerified = true;
    try {
      inv = await db
        .prepare('SELECT i.*, s.customer_id, s.customer_name, s.customer_email, s.tenant_id as subscription_tenant_id, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE i.id = ?')
        .bind(invoiceId)
        .first<Record<string, unknown>>();
    } catch {
      if (tenantId !== 'default' && tenantId !== '*') {
        tenantColumnVerified = false;
      }
      try {
        inv = await db
          .prepare('SELECT i.*, s.customer_id, s.customer_name, s.customer_email, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE i.id = ?')
          .bind(invoiceId)
          .first<Record<string, unknown>>();
      } catch {
        if (tenantId !== 'default' && tenantId !== '*') {
          return errorResponse('Invoice not found', 404);
        }
        inv = await db
          .prepare('SELECT i.*, s.customer_name, s.customer_email, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE i.id = ?')
          .bind(invoiceId)
          .first<Record<string, unknown>>();
      }
    }

    if (!inv) {
      return errorResponse('Invoice not found', 404);
    }

    const subTenant = inv.subscription_tenant_id !== undefined && inv.subscription_tenant_id !== null
      ? String(inv.subscription_tenant_id).trim()
      : '';
    const invTenant = inv.tenant_id !== undefined && inv.tenant_id !== null
      ? String(inv.tenant_id).trim()
      : '';
    const hasExplicitTenantColumn =
      inv.subscription_tenant_id !== undefined || inv.tenant_id !== undefined;
    if (!hasExplicitTenantColumn && tenantId !== 'default' && tenantId !== '*') {
      return errorResponse('Invoice not found', 404);
    }
    if (!tenantColumnVerified && !invTenant && tenantId !== 'default' && tenantId !== '*') {
      return errorResponse('Invoice not found', 404);
    }
    const rawTenant = subTenant || invTenant || (hasExplicitTenantColumn ? 'default' : undefined);
    const rowForMatch = rawTenant !== undefined ? { tenant_id: rawTenant } : {};
    if (!matchesTenantRow(rowForMatch, tenantId)) {
      return errorResponse('Invoice not found', 404);
    }

    if (isSelfServiceRole) {
      const callerId = user.id ?? user.customerId ?? user.sub;
      const hasCustomerId = Boolean(inv.customer_id && String(inv.customer_id).trim());
      const matchesId = Boolean(callerId && hasCustomerId && String(inv.customer_id).trim() === String(callerId).trim());
      const matchesEmail = Boolean(
        !hasCustomerId &&
        user.email &&
        inv.customer_email &&
        String(inv.customer_email).trim().toLowerCase() === String(user.email).trim().toLowerCase()
      );
      if (!matchesId && !matchesEmail) {
        return errorResponse('Forbidden', 403);
      }
    }

    const amount = Number(inv.amount_vnd).toLocaleString('vi-VN');
    const periodStart = inv.period_start ? new Date(String(inv.period_start)).toLocaleDateString('vi-VN') : '—';
    const periodEnd = inv.period_end ? new Date(String(inv.period_end)).toLocaleDateString('vi-VN') : '—';
    const invoiceNumber = String(inv.invoice_number || invoiceId);
    const safeFilenameInvoice = invoiceNumber.replace(/[^A-Za-z0-9._-]/g, '_');
    const paidAt = inv.paid_at ? new Date(String(inv.paid_at)).toLocaleString('vi-VN') : 'Chưa thanh toán';

    const lines = [
      '═══════════════════════════════════════',
      '         HÓA ĐƠN / RECEIPT',
      '═══════════════════════════════════════',
      `Số hóa đơn: ${invoiceNumber}`,
      `Ngày: ${paidAt}`,
      '',
      '--- KHÁCH HÀNG ---',
      `Tên: ${inv.customer_name || '—'}`,
      `Email: ${inv.customer_email || '—'}`,
      '',
      '--- CHI TIẾT ---',
      `Gói: ${inv.plan_name || 'Container Rental'}`,
      `Kỳ: ${periodStart} → ${periodEnd}`,
      `Số tiền: ${amount}₫`,
      `Trạng thái: ${inv.status}`,
      `Phương thức: ${inv.payment_method || '—'}`,
      '',
      'Cảm ơn quý khách!',
      'AURA CAFE — F&B Container Caffe',
      '═══════════════════════════════════════',
    ];

    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Content-Disposition': `attachment; filename="receipt-${safeFilenameInvoice}.txt"`,
      },
    });
  } catch (error) {
    log.error('Receipt error:', { message: (error as Error).message });
    return errorResponse('Lỗi tải hóa đơn', 500);
  }
}
