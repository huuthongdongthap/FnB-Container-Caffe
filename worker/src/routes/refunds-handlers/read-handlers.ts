import type { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { log } from './helpers';
import {
  canAccessPaymentOrder,
  extractRequestedPaymentTenant,
  FINANCIAL_ROLES,
  hasPaymentTenantMismatch,
} from '../../../../packages/domain/payment/policies/payment-access';
import { isHQSuperAdmin } from '../../middleware/tenant';

export function registerRefundReadHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/payments/refunds/:paymentId
  router.get('/refunds/:paymentId', requireAuth(FINANCIAL_ROLES), async (c) => {
    const user = c.get?.('user' as never) as
      | { id?: string; sub?: string; role?: string; tenantId?: string; tenant_id?: string; customerId?: string; customer_id?: string }
      | undefined;
    const explicitOverride = extractRequestedPaymentTenant(c);
    const rawCtxTenant = String((c.get?.('tenantId' as never) as string | undefined) || '').trim();
    if (
      hasPaymentTenantMismatch(c) ||
      (!isHQSuperAdmin(user) &&
        (explicitOverride === '*' ||
          explicitOverride.toLowerCase() === 'hq' ||
          rawCtxTenant === '*' ||
          rawCtxTenant.toLowerCase() === 'hq'))
    ) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const db = c.env.AURA_DB;
    const paymentId = c.req.param('paymentId');

    try {
      type RefundDetailRow = {
        id: string;
        order_id: string;
        method: string;
        amount: number;
        status: string;
        transaction_id: string | null;
        refund_status: string | null;
        refund_amount: number | null;
        refund_reason: string | null;
        created_at: string;
        updated_at: string;
        tenant_id: string | null;
        customer_id: string | null;
        order_token?: string | null;
      };
      let payment: RefundDetailRow | null = null;
      try {
        payment = await db.prepare(
          `SELECT p.*, o.tenant_id, o.customer_id, o.order_token FROM payments p
           JOIN orders o ON o.id = p.order_id WHERE p.id = ?`
        ).bind(paymentId).first<RefundDetailRow>();
      } catch {
        payment = await db.prepare(
          `SELECT p.*, o.tenant_id, o.customer_id FROM payments p
           JOIN orders o ON o.id = p.order_id WHERE p.id = ?`
        ).bind(paymentId).first<RefundDetailRow>();
      }

      let effectivePayment = payment;
      if (payment && user && String(user.role || '').trim().toLowerCase() === 'customer' && payment.customer_id) {
        const userId = String(user.id ?? user.sub ?? '').trim();
        const orderCustomerId = String(payment.customer_id).trim();
        const directCustomerId = String(user.customerId ?? user.customer_id ?? '').trim();
        let linkedMatch = Boolean(directCustomerId && directCustomerId === orderCustomerId);
        if (!linkedMatch && userId && orderCustomerId !== userId) {
          const ordTenant = payment.tenant_id && String(payment.tenant_id).trim() ? String(payment.tenant_id).trim() : 'default';
          const row = await db
            .prepare(
              "SELECT id FROM customers WHERE id = ? AND user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
            )
            .bind(orderCustomerId, userId, ordTenant)
            .first<{ id: string }>()
            .catch(() =>
              ordTenant === 'default'
                ? db.prepare('SELECT id FROM customers WHERE id = ? AND user_id = ? LIMIT 1').bind(orderCustomerId, userId).first<{ id: string }>().catch(() => null)
                : null
            );
          linkedMatch = Boolean(row?.id);
        }
        if (linkedMatch && userId) {
          effectivePayment = { ...payment, customer_id: userId };
        }
      }

      if (!payment || !effectivePayment || !canAccessPaymentOrder(c, effectivePayment)) {
        return c.json({ success: false, error: 'Không tìm thấy thanh toán / Payment not found' }, 404);
      }

      return c.json({
        success: true,
        data: {
          id: payment.id,
          orderId: payment.order_id,
          method: payment.method,
          amount: payment.amount,
          status: payment.status,
          refundStatus: payment.refund_status,
          refundAmount: payment.refund_amount,
          refundReason: payment.refund_reason,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at
        }
      });
    } catch (err) {
      log.error('Get refund status error:', { message: (err as Error).message });
      return c.json({ success: false, error: 'Lỗi nội bộ / Internal error' }, 500);
    }
  });
}
