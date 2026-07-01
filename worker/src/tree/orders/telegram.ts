/**
 * Orders — Telegram notification
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'orders' });

export async function notifyTelegram(env: Record<string, unknown>, order: Record<string, unknown>) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }
  try {
    const items = (order.items as Array<Record<string, unknown>> || []).map(i =>
      `• ${i.name} x${i.qty || i.quantity || 1}`
    ).join('\n');
    const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + '₫';
    const esc = (s: string) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const text = '🟎 <b>DON MBI — AURA CAFE</b>\n' +
      '━'.repeat(22) + '\n' +
      `📋 ${esc(order.id as string)}\n` +
      `👤 ${esc(order.customer_name as string)}\n` +
      `📞 ${esc(order.customer_phone as string)}\n` +
      ((order.customer_address as string) ? `📍 ${esc(order.customer_address as string)}\n` : '') +
      '━'.repeat(22) + '\n' +
      `${esc(items)}\n` +
      '━'.repeat(22) + '\n' +
      `💵 <b>${fmt(Number(order.total))}</b>\n` +
      `💳 ${esc(String(order.payment_method).toUpperCase())}\n` +
      ((order.notes as string) ? `📝 ${esc(order.notes as string)}\n` : '');
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const err = await res.text();
      log.error('Telegram HTTP', { status: res.status, error: err });
    }
  } catch (e) {
    log.error('Telegram notify failed:', { message: (e as Error).message });
  }
}
