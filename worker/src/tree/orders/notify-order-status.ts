/**
 * Order Status Notifications — ZNS + SMS + Push for order status updates
 * Fire-and-forget: never blocks the request path.
 */

import { createLogger } from '../../middleware/logger';
import { sendZNS } from '../zalo/zns-sender';
import type { ZnsData } from '../zalo/types';
import { sendSMS } from '../../lib/speedsms-client';
import type { SpeedSMSEnv } from '../../lib/speedsms-client';

const log = createLogger({ route: 'order-notify' });

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'da xac nhan',
  preparing: 'dang pha che',
  ready: 'san sang',
  served: 'da phuc vu'
};

interface OrderRow {
  customer_name: string | null;
  customer_phone: string | null;
  total: number;
  status: string;
}

/**
 * Fire ZNS and SMS notifications for an order status update.
 * Skips silently when env vars are unconfigured.
 * Each channel is independently wrapped in try/catch.
 */
export async function notifyOrderStatus(
  env: Record<string, unknown>,
  orderId: string
): Promise<void> {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) {
    return;
  }

  let order: OrderRow | null = null;
  try {
    order = await db.prepare(
      'SELECT customer_name, customer_phone, total, status FROM orders WHERE id = ?'
    ).bind(orderId).first<OrderRow>();
  } catch {
    /* db fetch failure — nothing to notify */
    return;
  }

  if (!order || !order.customer_phone) {
    return;
  }

  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const customerName = order.customer_name || 'Khach hang';
  const totalFormatted = `${(order.total || 0).toLocaleString('vi-VN')}d`;

  // ── ZNS ──────────────────────────────────────────────
  if (env.ZALO_ACCESS_TOKEN) {
    sendZNS(env as { ZALO_ACCESS_TOKEN?: string; AURA_DB?: import('@cloudflare/workers-types').D1Database }, {
      phone: order.customer_phone,
      template_key: 'order_status_update',
      data: {
        name: customerName,
        order_id: orderId,
        status: statusLabel,
        amount: order.total || 0
      } as ZnsData
    }).catch((err: unknown) =>
      log.error('ZNS order notification error:', { message: err instanceof Error ? err.message : String(err) })
    );
  }

  // ── SMS ──────────────────────────────────────────────
  if (env.SPEEDSMS_API_KEY || env.SPEEDSMS_API_SECRET) {
    const orderRef = `AC${String(orderId).slice(0, 8).toUpperCase()}`;
    const smsMessage =
      `AURA CAFE - ${customerName} oi, don hang ${orderRef} da ${statusLabel}. ` +
      `Tong tien: ${totalFormatted}. Cam on quy khach!`;

    sendSMS(env as SpeedSMSEnv, {
      phone: order.customer_phone,
      message: smsMessage
    }).catch((err: unknown) =>
      log.error('SMS order notification error:', { message: err instanceof Error ? err.message : String(err) })
    );
  }
}
