/**
 * Cron + admin debug routes — extracted from src/index.ts so the entry
 * module stays a thin router table instead of a 600-line handler dump.
 *
 * All handlers are secret-protected (cron) or owner-only (debug).
 */

import type { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { audit } from '../middleware/audit-log';
import { createLogger } from '../middleware/logger';
import { createAlertDispatcher } from '../lib/alert-dispatcher';
import { notifyTelegram } from '../tree/orders/telegram';
import { sendZNS } from './zalo';
import { sendCashbackExpiryWarnings } from './cron';

const log = createLogger({ route: 'cron-admin' });

function checkCronSecret(c: {
  env: Env;
  req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
}): boolean {
  if (!c.env.CRON_SECRET) {
    return false;
  } // not configured — fail-closed
  const secret = c.req.header('X-Cron-Secret') || c.req.query('secret');
  return secret === c.env.CRON_SECRET;
}

async function sendTelegram(
  env: Env,
  msg: string,
  _severity?: string
): Promise<void> {
  const tgToken = env.TELEGRAM_BOT_TOKEN;
  const tgChatId = env.TELEGRAM_CHAT_ID;
  if (!tgToken || !tgChatId) {
    return;
  }
  await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: 'Markdown' }),
    signal: AbortSignal.timeout(5000)
  });
}

export function registerCronAdminRoutes(app: Hono<{ Bindings: Env }>): void {
  // ── Cron: Alert dispatch (protected by shared secret) ──
  app.get('/cron/alerts', async(c) => {
    if (!checkCronSecret(c)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const fired = await createAlertDispatcher(c.env.AURA_DB).dispatchAlerts((msg, sev) =>
      sendTelegram(c.env, msg, sev)
    );
    return c.json({ fired, at: new Date().toISOString() });
  });

  // ── Cron: Daily digest (triggered hourly, dispatched only at 21:00 ICT) ──
  app.get('/cron/digest', async(c) => {
    if (!checkCronSecret(c)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const ictHour = parseInt(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false }),
      10
    );
    if (ictHour !== 21) {
      return c.json({ skipped: true, reason: 'Not digest time', ictHour });
    }
    await createAlertDispatcher(c.env.AURA_DB).dispatchDigest((msg) => sendTelegram(c.env, msg));
    return c.json({ ok: true, at: new Date().toISOString() });
  });

  // ── Dev: Simulate PayOS webhook + Telegram (owner-only) ──
  app.post('/api/test/telegram-sim', requireAuth(['owner']), audit('test_telegram_sim'), async(c) => {
    try {
      const body = await c.req.json<{ order_id?: string }>();
      if (!body.order_id) {
        return c.json({ error: 'Missing order_id' }, 400);
      }
      const order = await c.env.AURA_DB.prepare('SELECT * FROM orders WHERE id = ?')
        .bind(body.order_id).first<Record<string, unknown>>();
      if (!order) {
        return c.json({ error: 'Order not found' }, 404);
      }
      const parsedItems = JSON.parse((order.items as string) || '[]');
      const tgPromise = notifyTelegram(c.env as unknown as Record<string, unknown>, {
        id: order.id as string,
        items: parsedItems,
        total: order.total as number,
        customer_name: order.customer_name as string,
        customer_phone: order.customer_phone as string,
        customer_address: order.customer_address as string,
        payment_method: order.payment_method as string,
        notes: order.notes as string
      }).catch((e: Error) => log.error('Telegram test error:', { message: e.message }));
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(tgPromise);
      } else {
        await tgPromise;
      }
      return c.json({ ok: true, message: 'Telegram sent' });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // ── Admin: Test Zalo ZNS (owner-only) ──
  app.post('/api/test/zalo-zns', requireAuth(['owner']), audit('test_zalo_zns'), async(c) => {
    try {
      const { phone, template } = await c.req.json<{ phone?: string; template?: string }>();
      if (!phone || !template) {
        return c.json({ error: 'phone and template required' }, 400);
      }
      const result = await sendZNS(c.env as unknown as Record<string, unknown>, {
        phone,
        template_key: template,
        data: { name: 'Test Member', member_id: 'AC000001', balance: 50000, amount: 12000, order_id: 'test123', days: 7 }
      });
      return c.json(result);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // ── Admin: Manual cashback expiry warning run ──
  app.post('/api/admin/zalo/send-expiry-warnings', requireAuth(['owner']), audit('send_expiry_warnings'), async(c) => {
    const result = await sendCashbackExpiryWarnings(c.env as unknown as Record<string, unknown>);
    return c.json({ ok: true, ...result });
  });
}
