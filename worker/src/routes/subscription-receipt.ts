// subscription-receipt.ts — GET /api/subscriptions/invoices/:id/receipt

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireAuth } from '../middleware/auth';
import type { Context } from 'hono';
import type { Env } from '../types/env';

const log = createLogger({ route: 'receipt' });

export async function getInvoiceReceipt(c: Context<{ Bindings: Env }>) {
  try {
    const invoiceId = c.req.param('id');
    const db = c.env.AURA_DB;

    const inv = await db
      .prepare('SELECT i.*, s.customer_name, s.customer_email, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE i.id = ?')
      .bind(invoiceId)
      .first<Record<string, unknown>>();

    if (!inv) {
      return errorResponse('Invoice not found', 404);
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
