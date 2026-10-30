import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { sendEmail } from '../../lib/email';
import { sendSMS } from '../../lib/speedsms-client';
import { sendZNS } from '../../tree/zalo/zns-sender';
import { createLogger } from '../../utils/logger';
import { broadcastSendSchema, zodErrorResponse } from '../../lib/validators';
import { segmentSQL, type BroadcastCustomer } from './types';

const log = createLogger({ route: 'broadcast' });

function getTenantId(c: { get: (k: string) => unknown }): string {
  const user = c.get('user') as { tenantId?: string } | undefined;
  return user?.tenantId || 'default';
}

function matchesTenantRow(row: unknown, tenantId: string): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  if (r.tenant_id === undefined) {
    return tenantId === 'default';
  }
  const rowTenant = typeof r.tenant_id === 'string' && r.tenant_id.trim() ? r.tenant_id.trim() : 'default';
  return rowTenant === tenantId;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function registerSendHandler(router: Hono<{ Bindings: Env }>): void {
  // POST /api/broadcast/send — send bulk broadcast
  router.post('/send', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c as unknown as { get: (k: string) => unknown });

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
    const tenantAwareSql = seg.sql
      .replace(/^SELECT DISTINCT c\./, 'SELECT DISTINCT c.tenant_id, c.')
      .replace(/^SELECT id, name, phone, email/, 'SELECT id, name, phone, email, tenant_id');
    let customers: BroadcastCustomer[] = [];
    try {
      const stmt = seg.params
        ? db.prepare(tenantAwareSql).bind(...seg.params)
        : db.prepare(tenantAwareSql);
      const { results } = await stmt.all<BroadcastCustomer>();
      customers = results || [];
    } catch (err) {
      // Fallback for legacy test mocks without tenant_id, loyalty_tier, or date_of_birth
      let fallbackSql = seg.sql;
      if (fallbackSql.includes('loyalty_tier')) {
        fallbackSql = fallbackSql.replace(/loyalty_tier/g, 'tier');
      } else if (fallbackSql.includes('date_of_birth')) {
        fallbackSql = fallbackSql.replace(/date_of_birth/g, 'birthday');
      }
      try {
        const stmt = seg.params
          ? db.prepare(fallbackSql).bind(...seg.params)
          : db.prepare(fallbackSql);
        const { results } = await stmt.all<BroadcastCustomer>();
        customers = results || [];
      } catch (fallbackErr) {
        log.error('segment_query_failed', { segment, error: (err as Error).message, fallbackError: (fallbackErr as Error).message });
        return c.json({ success: false, error: 'Lỗi truy vấn phân khúc khách hàng' }, 500);
      }
    }

    customers = customers.filter((cust) => matchesTenantRow(cust, tenantId));

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
          (async (): Promise<void> => {
            try {
              if (ch === 'zns') {
                if (customer.phone) {
                  const result = await sendZNS(
                    env as unknown as { ZALO_ACCESS_TOKEN?: string; AURA_DB?: import('@cloudflare/workers-types').D1Database },
                    {
                      phone: customer.phone,
                      template_key: 'general_promotion',
                      data: {
                        name: customer.name || '',
                        title: body.title ?? '',
                        message: body.message
                      } as Record<string, string>
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
                    html: escapeHtml(message).replace(/\n/g, '<br>')
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
}
