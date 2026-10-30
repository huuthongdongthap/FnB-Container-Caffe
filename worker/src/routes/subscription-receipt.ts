// subscription-receipt.ts — GET /api/subscriptions/invoices/:id/receipt

import { errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import type { Context } from 'hono';
import type { Env } from '../types/env';

const log = createLogger({ route: 'receipt' });

function getTenantId(c: Context<{ Bindings: Env }>): string {
  const user = (c as unknown as { get: (k: string) => { tenantId?: string } | undefined }).get('user');
  return user?.tenantId || 'default';
}

export async function getInvoiceReceipt(c: Context<{ Bindings: Env }>) {
  try {
    const invoiceId = c.req.param('id');
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);

    let inv: Record<string, unknown> | null = null;
    try {
      inv = await db
        .prepare('SELECT i.*, s.customer_id, s.customer_name, s.customer_email, s.tenant_id as subscription_tenant_id, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE i.id = ?')
        .bind(invoiceId)
        .first<Record<string, unknown>>();
    } catch {
      try {
        inv = await db
          .prepare('SELECT i.*, s.customer_id, s.customer_name, s.customer_email, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE i.id = ?')
          .bind(invoiceId)
          .first<Record<string, unknown>>();
      } catch {
        inv = await db
          .prepare('SELECT i.*, s.customer_name, s.customer_email, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE i.id = ?')
          .bind(invoiceId)
          .first<Record<string, unknown>>();
      }
    }

    if (!inv) {
      return errorResponse('Invoice not found', 404);
    }

    const rawTenant = inv.subscription_tenant_id ?? inv.tenant_id;
    if (rawTenant !== undefined) {
      const rowTenant = typeof rawTenant === 'string' && rawTenant.trim() ? rawTenant.trim() : 'default';
      if (rowTenant !== tenantId) {
        return errorResponse('Invoice not found', 404);
      }
    } else if (tenantId !== 'default') {
      return errorResponse('Invoice not found', 404);
    }

    const user = (c as unknown as { get: (k: string) => { id?: string; email?: string; role?: string } | undefined }).get('user');
    if (user?.role === 'customer') {
      const matchesId = Boolean(user.id && inv.customer_id && String(inv.customer_id) === String(user.id));
      const matchesEmail = Boolean(
        user.email &&
        inv.customer_email &&
        String(inv.customer_email).toLowerCase() === String(user.email).toLowerCase()
      );
      if (!matchesId && !matchesEmail) {
        return errorResponse('Forbidden', 403);
      }
    }

    const amount = Number(inv.amount_vnd).toLocaleString('vi-VN');
    const periodStart = inv.period_start ? new Date(String(inv.period_start)).toLocaleDateString('vi-VN') : '—';
    const periodEnd = inv.period_end ? new Date(String(inv.period_end)).toLocaleDateString('vi-VN') : '—';
    const invoiceNumber = inv.invoice_number || invoiceId;
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
        'Content-Disposition': `attachment; filename="receipt-${invoiceNumber}.txt"`,
      },
    });
  } catch (error) {
    log.error('Receipt error:', { message: (error as Error).message });
    return errorResponse('Lỗi tải hóa đơn', 500);
  }
}
