import type { Context } from 'hono';
import { formatKdsPushOriginLabel, notifyTelegram } from '@aura/domain-order';
import type { Env } from '../../types/env';
import type { EmailEnv } from '../../lib/email';
import { log } from './helpers';

export interface NotificationContextLike {
  env: Env;
  executionCtx?: { waitUntil?: (p: Promise<unknown>) => void };
}

export async function sendKdsReleasePushNotification(
  c: Context<{ Bindings: Env }> | NotificationContextLike,
  orderRow: Record<string, unknown>,
  tenantId: string,
): Promise<void> {
  try {
    const db = (c.env?.AURA_DB ?? (c.env as unknown as Record<string, unknown>)?.DB) as
      | import('@cloudflare/workers-types').D1Database
      | undefined;
    if (!db) return;
    const rawStatus = String(orderRow.status ?? 'pending').trim().toLowerCase();
    if (!['pending', 'confirmed'].includes(rawStatus)) return;
    let parsedItems: unknown[] = [];
    if (Array.isArray(orderRow.items)) {
      parsedItems = orderRow.items;
    } else if (typeof orderRow.items === 'string' && orderRow.items.trim()) {
      try {
        const parsed = JSON.parse(orderRow.items);
        if (Array.isArray(parsed)) parsedItems = parsed;
      } catch { /* ignore */ }
    }
    const { sendPushToStaff } = await import('../../tree/push/notifier.js');
    const { STAFF_PUSH_ROLE } = await import('../../tree/push/roles.js');
    const rawEnv = (c.env || {}) as unknown as Record<string, unknown>;
    const pushEnv: import('../../tree/push/notifier').PushEnv = {
      AURA_DB: db,
      VAPID_PUBLIC_KEY: typeof rawEnv.VAPID_PUBLIC_KEY === 'string' ? rawEnv.VAPID_PUBLIC_KEY : undefined,
      VAPID_PRIVATE_KEY: typeof rawEnv.VAPID_PRIVATE_KEY === 'string' ? rawEnv.VAPID_PRIVATE_KEY : undefined,
      VAPID_EMAIL: typeof rawEnv.VAPID_EMAIL === 'string' ? rawEnv.VAPID_EMAIL : undefined,
      PILOT_STORE: typeof rawEnv.PILOT_STORE === 'string' ? rawEnv.PILOT_STORE : undefined,
    };
    const originLabel = formatKdsPushOriginLabel({
      orderType: typeof orderRow.order_type === 'string' ? orderRow.order_type : null,
      tableId: typeof orderRow.table_id === 'string' ? orderRow.table_id : null,
    });
    const orderId = String(orderRow.id ?? '');
    const pushPromise = sendPushToStaff(
      pushEnv,
      {
        title: 'Đơn hàng mới 🍳',
        body: `${originLabel} — ${parsedItems.length} món`,
        data: { url: '/kds', orderId },
      },
      STAFF_PUSH_ROLE,
      undefined,
      tenantId || 'default',
    ).catch((e) => log.warn('KDS release push failed:', { message: (e as Error).message }));

    let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
    try {
      waitUntilFn = c.executionCtx?.waitUntil?.bind(c.executionCtx);
    } catch {
      waitUntilFn = undefined;
    }
    if (waitUntilFn) {
      waitUntilFn(pushPromise);
    } else {
      await pushPromise;
    }
  } catch (err) {
    log.warn('KDS release push error:', { message: (err as Error).message });
  }
}

export async function sendOrderPaidNotifications(
  c: Context<{ Bindings: Env }> | NotificationContextLike,
  orderRow: Record<string, unknown>,
  paymentTime: string
): Promise<void> {
  try {
    let parsedItems: Array<Record<string, unknown>> = [];
    try {
      parsedItems = JSON.parse((orderRow.items as string) || '[]');
    } catch { /* ignore */ }

    const tgPromise = notifyTelegram(c.env as unknown as Record<string, unknown>, {
      id: orderRow.id,
      items: parsedItems,
      total: orderRow.total,
      customer_name: orderRow.customer_name,
      customer_phone: orderRow.customer_phone,
      customer_address: orderRow.customer_address ?? orderRow.address,
      payment_method: orderRow.payment_method,
      notes: orderRow.notes
    }).catch(e => log.error('Telegram webhook error:', { message: (e as Error).message }));

    let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
    try {
      waitUntilFn = c.executionCtx?.waitUntil?.bind(c.executionCtx);
    } catch {
      waitUntilFn = undefined;
    }
    if (waitUntilFn) {
      waitUntilFn(tgPromise);
    } else {
      await tgPromise;
    }
  } catch (tgErr) {
    log.error('Telegram webhook failed:', { message: (tgErr as Error).message });
  }

  if (orderRow.customer_email) {
    try {
      const { sendEmail } = await import('../../lib/email.js');
      const { renderReceipt } = await import('../../templates/receipt.js');
      const paymentLabels: Record<string, string> = { cod: 'COD', payos: 'PayOS' };
      const emailPromise = sendEmail(c.env as unknown as EmailEnv, {
        to: orderRow.customer_email as string,
        subject: `Thanh toán thành công #${orderRow.id as string} — AURA CAFE`,
        html: renderReceipt({
          id: orderRow.id as string,
          total: orderRow.total as number,
          payment_method: paymentLabels[orderRow.payment_method as string] || (orderRow.payment_method as string),
          payment_time: paymentTime
        })
      }).catch(e => log.error('Email receipt error:', { message: (e as Error).message }));

      let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
      try {
        waitUntilFn = c.executionCtx?.waitUntil?.bind(c.executionCtx);
      } catch {
        waitUntilFn = undefined;
      }
      if (waitUntilFn) {
        waitUntilFn(emailPromise);
      } else {
        await emailPromise;
      }
    } catch (emailErr) {
      log.error('Email receipt failed:', { message: (emailErr as Error).message });
    }
  }
}
