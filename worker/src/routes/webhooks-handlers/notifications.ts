import type { Context } from 'hono';
import { notifyTelegram } from '@aura/domain-order';
import type { Env } from '../../types/env';
import type { EmailEnv } from '../../lib/email';
import { log } from './helpers';

export async function sendOrderPaidNotifications(
  c: Context<{ Bindings: Env }>,
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
      customer_address: orderRow.customer_address,
      payment_method: orderRow.payment_method,
      notes: orderRow.notes
    }).catch(e => log.error('Telegram webhook error:', { message: (e as Error).message }));

    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(tgPromise);
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

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(emailPromise);
      }
    } catch (emailErr) {
      log.error('Email receipt failed:', { message: (emailErr as Error).message });
    }
  }
}
