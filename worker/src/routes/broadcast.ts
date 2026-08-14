/**
 * Broadcast Routes — /api/broadcast
 * POST /api/broadcast/send — send bulk message to customer segment
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { sendEmail } from '../lib/email';
import { sendSMS } from '../lib/speedsms-client';
import { sendZNS } from '../tree/zalo/zns-sender';
import { createLogger } from '../utils/logger';
import { broadcastSendSchema, zodErrorResponse } from '../lib/validators';

const log = createLogger({ route: 'broadcast' });

interface BroadcastCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * Build SQL query for each predefined segment.
 */
function segmentSQL(segment: string): { sql: string; params?: string[] } {
  switch (segment) {
  case 'all':
    return { sql: 'SELECT id, name, phone, email FROM customers' };
  case 'loyalty_bronze':
    return { sql: 'SELECT id, name, phone, email FROM customers WHERE tier = \'bronze\'' };
  case 'loyalty_silver':
    return { sql: 'SELECT id, name, phone, email FROM customers WHERE tier = \'silver\'' };
  case 'loyalty_gold':
    return { sql: 'SELECT id, name, phone, email FROM customers WHERE tier = \'gold\'' };
  case 'loyalty_platinum':
    return { sql: 'SELECT id, name, phone, email FROM customers WHERE tier = \'platinum\'' };
  case 'active_30d':
    return {
      sql: `SELECT DISTINCT c.id, c.name, c.phone, c.email
              FROM customers c
              INNER JOIN orders o ON o.customer_phone = c.phone
              WHERE o.created_at >= datetime('now', '-30 days')`
    };
  case 'inactive_90d':
    return {
      sql: `SELECT id, name, phone, email FROM customers
              WHERE phone NOT IN (
                SELECT DISTINCT customer_phone FROM orders
                WHERE created_at >= datetime('now', '-90 days')
              ) AND phone IS NOT NULL`
    };
  case 'birthday_this_month': {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return {
      sql: 'SELECT id, name, phone, email FROM customers WHERE birthday IS NOT NULL AND substr(birthday, 6, 2) = ?',
      params: [month]
    };
  }
  default:
    return { sql: 'SELECT id, name, phone, email FROM customers' };
  }
}

export const broadcastRouter = new Hono<{ Bindings: Env }>();

// POST /api/broadcast/send — send bulk broadcast
broadcastRouter.post('/send', async(c) => {
  const db = c.env.AURA_DB;

  const raw = await c.req.json();
  const parsed = broadcastSendSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const body = parsed.data;

  const segment = body.segment;
  const channel = body.channel;
  const title = body.title || '';
  const message = body.message;

  if (!segment || !channel || !message) {
    return c.json({ success: false, error: 'Thiếu thông tin: segment, channel, message là bắt buộc' }, 400);
  }

  if (!['zns', 'sms', 'email', 'all'].includes(channel)) {
    return c.json({ success: false, error: 'Kênh không hợp lệ. Chấp nhận: zns, sms, email, all' }, 400);
  }

  // ── Lookup customers in segment ──
  const seg = segmentSQL(segment);
  let customers: BroadcastCustomer[];
  try {
    const stmt = seg.params
      ? db.prepare(seg.sql).bind(...seg.params)
      : db.prepare(seg.sql);
    const { results } = await stmt.all<BroadcastCustomer>();
    customers = results || [];
  } catch (err) {
    log.error('segment_query_failed', { segment, error: (err as Error).message });
    return c.json({ success: false, error: 'Lỗi truy vấn phân khúc khách hàng' }, 500);
  }

  if (customers.length === 0) {
    return c.json({ success: false, error: 'Không có khách hàng nào trong phân khúc này' }, 400);
  }

  // ── Determine which channels to send to ──
  const activeChannels: string[] = channel === 'all'
    ? ['zns', 'sms', 'email']
    : [channel];

  // Skip channels where env is not configured
  const env = c.env as Record<string, string | undefined>;
  const skipReasons: Record<string, string> = {};
  if (activeChannels.includes('zns') && !env.ZALO_ACCESS_TOKEN) {
    skipReasons.zns = 'ZALO_ACCESS_TOKEN not configured';
  }
  if (activeChannels.includes('sms') && !env.SPEEDSMS_API_KEY) {
    skipReasons.sms = 'SPEEDSMS_API_KEY not configured';
  }
  if (activeChannels.includes('email') && !env.SENDGRID_API_KEY) {
    skipReasons.email = 'SENDGRID_API_KEY not configured';
  }

  const sendChannels = activeChannels.filter((ch) => !skipReasons[ch]);

  if (sendChannels.length === 0) {
    return c.json({
      success: false,
      error: 'Không có kênh nào được cấu hình. Vui lòng cấu hình API key.',
      skipReasons
    }, 400);
  }

  // ── Send messages (non-blocking via waitUntil or Promise.allSettled) ──
  let sentCount = 0;
  let failedCount = 0;

  const sendTasks: Promise<void>[] = [];

  for (const customer of customers) {
    for (const ch of sendChannels) {
      sendTasks.push(
        (async(): Promise<void> => {
          try {
            if (ch === 'zns') {
              if (customer.phone) {
                const result = await sendZNS(
                  env as unknown as { ZALO_ACCESS_TOKEN?: string; AURA_DB?: import('@cloudflare/workers-types').D1Database },
                  {
                    phone: customer.phone,
                    template_key: 'general_promotion',
                    data: { name: customer.name || '' }
                  }
                );
                if (result.ok) {
                  sentCount++; return;
                }
                log.warn('zns_broadcast_failed', { customerId: customer.id, reason: result.reason });
              }
            } else if (ch === 'sms') {
              if (customer.phone) {
                const result = await sendSMS(env, { phone: customer.phone, message });
                if (result.success) {
                  sentCount++; return;
                }
                log.warn('sms_broadcast_failed', { customerId: customer.id });
              }
            } else if (ch === 'email') {
              if (customer.email) {
                const result = await sendEmail(env, {
                  to: customer.email,
                  subject: title || 'AURA CAFE',
                  html: message.replace(/\n/g, '<br>')
                });
                if (result) {
                  sentCount++; return;
                }
                log.warn('email_broadcast_failed', { customerId: customer.id });
              }
            }
            failedCount++;
          } catch (err) {
            log.error('broadcast_send_error', { customerId: customer.id, channel: ch, error: (err as Error).message });
            failedCount++;
          }
        })()
      );
    }
  }

  log.info('broadcast_started', {
    segment,
    channel,
    customerCount: customers.length,
    sendChannels,
    taskCount: sendTasks.length
  });

  // Non-blocking: use waitUntil when available, else fall back to blocking
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(Promise.allSettled(sendTasks));
    return c.json({
      success: true,
      pending: true,
      total: customers.length,
      channels: sendChannels,
      skipped: skipReasons
    });
  }

  // Blocking fallback
  await Promise.allSettled(sendTasks);
  return c.json({
    success: true,
    sent_count: sentCount,
    failed_count: failedCount,
    total: customers.length,
    channels: sendChannels,
    skipped: skipReasons
  });
});
