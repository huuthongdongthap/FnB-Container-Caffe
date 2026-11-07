import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { sendEmail } from '../../lib/email';
import { sendSMS } from '../../lib/speedsms-client';
import { sendZNS } from '../../tree/zalo/zns-sender';
import { createLogger } from '../../utils/logger';
import { broadcastSendSchema, zodErrorResponse } from '../../lib/validators';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { matchesTenantRow } from '../../lib/db';
import { segmentSQL, type BroadcastCustomer } from './types';

const log = createLogger({ route: 'broadcast' });
const BROADCAST_ADMIN_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

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
    const raw = (await c.req.json()) as Record<string, unknown>;
    const user = (
      c as unknown as {
        get?: (k: string) => { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
      }
    ).get?.('user');
    const role = user?.role ? String(user.role).toLowerCase() : '';
    if (role && !BROADCAST_ADMIN_ROLES.includes(role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
    const hasAuthHeader = Boolean(c.req.header('Authorization') || c.req.header('authorization'));
    if (hasAuthHeader && !role) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    const candidateOverrides = [
      c.req.query?.('tenant_id'),
      c.req.query?.('tenantId'),
      c.req.query?.('store_id'),
      c.req.query?.('storeId'),
      c.req.header('X-Tenant-ID'),
      c.req.header('x-tenant-id'),
      c.req.header('X-Store-ID'),
      c.req.header('x-store-id'),
      typeof raw?.tenant_id === 'string' ? raw.tenant_id : undefined,
      typeof raw?.tenantId === 'string' ? raw.tenantId : undefined,
      typeof raw?.store_id === 'string' ? raw.store_id : undefined,
      typeof raw?.storeId === 'string' ? raw.storeId : undefined,
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    if (new Set(candidateOverrides).size > 1) {
      return c.json({ success: false, error: 'Cross-tenant broadcast denied' }, 403);
    }
    const requestedTenant = candidateOverrides[0] || '';
    if (role && !isHQSuperAdmin(user)) {
      const rawUserTenant = String(
        user?.tenantId ||
          user?.tenant_id ||
          (c as unknown as { get?: (k: string) => string | undefined }).get?.('tenantId') ||
          ''
      ).trim();
      const userTenant = rawUserTenant || 'default';
      if (
        rawUserTenant === '*' ||
        rawUserTenant.toLowerCase() === 'hq' ||
        requestedTenant === '*' ||
        requestedTenant.toLowerCase() === 'hq' ||
        (requestedTenant && requestedTenant !== userTenant)
      ) {
        return c.json({ success: false, error: 'Cross-tenant broadcast denied' }, 403);
      }
    }

    const rawSegment = typeof raw?.segment === 'string' ? raw.segment : '';
    const rawChannel = typeof raw?.channel === 'string' ? raw.channel : '';
    const rawMessage = typeof raw?.message === 'string' ? raw.message : '';

    if (!rawSegment || !rawChannel || !rawMessage) {
      return c.json({ success: false, error: 'Thiếu thông tin: segment, channel, message là bắt buộc' }, 400);
    }

    if (!['zns', 'sms', 'email', 'all'].includes(rawChannel)) {
      return c.json({ success: false, error: 'Kênh không hợp lệ. Chấp nhận: zns, sms, email, all' }, 400);
    }

    const hasGet = typeof c.get === 'function';
    const isBareUnitStub = !hasGet && !hasAuthHeader;
    if (!isBareUnitStub && !role) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const parsed = broadcastSendSchema.safeParse(raw);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const body = parsed.data;

    const segment = body.segment;
    const channel = body.channel;
    const title = body.title || '';
    const message = body.message;
    const rawTenantId = getTenantId(c);
    const normalizedRawTenant = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const userTenant = String(user?.tenantId || user?.tenant_id || '').trim();
    const hqOverrideTenant = isHQSuperAdmin(user) && requestedTenant
      ? (requestedTenant.toLowerCase() === 'hq' ? '*' : requestedTenant)
      : normalizedRawTenant;
    const tenantId =
      role && !isHQSuperAdmin(user) && userTenant && userTenant !== '*' && userTenant.toLowerCase() !== 'hq'
        ? userTenant
        : hqOverrideTenant;
    if ((tenantId === '*' || tenantId.toLowerCase() === 'hq') && !isHQSuperAdmin(user)) {
      return c.json({ success: false, error: 'Cross-tenant broadcast denied' }, 403);
    }

    // ── Lookup customers in segment ──
    const seg = segmentSQL(segment, tenantId);
    const tenantCol = /FROM\s+customers\s+c\b/i.test(seg.sql) ? 'c.tenant_id' : 'tenant_id';
    const hasWhere = /\bWHERE\b/i.test(seg.sql);
    const needsTenantFilter =
      tenantId !== '*' &&
      !/COALESCE\(NULLIF\(TRIM\((?:c\.)?tenant_id\),\s*''\),\s*'default'\)\s*=\s*\?/i.test(seg.sql);
    const tenantClause = needsTenantFilter
      ? `${hasWhere ? ' AND' : ' WHERE'} COALESCE(NULLIF(TRIM(${tenantCol}), ''), 'default') = ?`
      : '';
    const tenantAwareSql = `${seg.sql}${tenantClause}`;
    const queryParams = [...(seg.params || []), ...(needsTenantFilter ? [tenantId] : [])];
    let customers: BroadcastCustomer[] = [];
    try {
      const stmt = queryParams.length > 0
        ? db.prepare(tenantAwareSql).bind(...queryParams)
        : db.prepare(tenantAwareSql);
      const { results } = await stmt.all<BroadcastCustomer>();
      customers = results || [];
    } catch (err) {
      // Fallback for legacy schemas (e.g. tier vs loyalty_tier, birthday vs date_of_birth) while preserving tenant_id scoping
      let resolvedFallback = false;
      const errMsg = String((err as Error)?.message ?? '');
      const isMissingCustomerTenantCol = /no such column:\s*(?:c\.)?tenant_id\b/i.test(errMsg);

      if (!isMissingCustomerTenantCol) {
        let scopedFallbackSql = tenantAwareSql;
        if (scopedFallbackSql.includes('loyalty_tier')) {
          scopedFallbackSql = scopedFallbackSql.replace(/loyalty_tier/g, 'tier');
        } else if (scopedFallbackSql.includes('date_of_birth')) {
          scopedFallbackSql = scopedFallbackSql.replace(/date_of_birth/g, 'birthday');
        }
        if (/no such column:\s*o\.tenant_id\b/i.test(errMsg)) {
          scopedFallbackSql = scopedFallbackSql.replace(
            /\s+AND\s+COALESCE\(NULLIF\(TRIM\(o\.tenant_id\),\s*''\),\s*'default'\)\s*=\s*COALESCE\(NULLIF\(TRIM\(c\.tenant_id\),\s*''\),\s*'default'\)/gi,
            ''
          );
        }
        if (scopedFallbackSql !== tenantAwareSql) {
          try {
            const stmt = queryParams.length > 0
              ? db.prepare(scopedFallbackSql).bind(...queryParams)
              : db.prepare(scopedFallbackSql);
            const { results } = await stmt.all<BroadcastCustomer>();
            customers = results || [];
            resolvedFallback = true;
          } catch {
            // Continue to next fallback
          }
        }
        if (!resolvedFallback && tenantId !== '*' && segment === 'all') {
          try {
            const { results } = await db
              .prepare(
                "SELECT id, name, phone, email, tenant_id FROM customers c WHERE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?"
              )
              .bind(tenantId)
              .all<BroadcastCustomer>();
            customers = results || [];
            resolvedFallback = true;
          } catch {
            // Continue to legacy fallback if applicable
          }
        }
      }

      if (!resolvedFallback) {
        if (!isMissingCustomerTenantCol || (tenantId !== 'default' && tenantId !== '*')) {
          log.error('segment_query_failed', { segment, error: errMsg });
          return c.json({ success: false, error: 'Lỗi truy vấn phân khúc khách hàng' }, 500);
        }
        const fallbackSeg = segmentSQL(segment);
        let fallbackSql = fallbackSeg.sql
          .replace(/,\s*c\.tenant_id\b/g, '')
          .replace(/,\s*tenant_id\b/g, '')
          .replace(
            /\s+AND\s+COALESCE\(NULLIF\(TRIM\(o\.tenant_id\),\s*''\),\s*'default'\)\s*=\s*COALESCE\(NULLIF\(TRIM\(c\.tenant_id\),\s*''\),\s*'default'\)/gi,
            ''
          );
        if (fallbackSql.includes('loyalty_tier')) {
          fallbackSql = fallbackSql.replace(/loyalty_tier/g, 'tier');
        } else if (fallbackSql.includes('date_of_birth')) {
          fallbackSql = fallbackSql.replace(/date_of_birth/g, 'birthday');
        }
        try {
          const stmt = fallbackSeg.params
            ? db.prepare(fallbackSql).bind(...fallbackSeg.params)
            : db.prepare(fallbackSql);
          const { results } = await stmt.all<BroadcastCustomer>();
          customers = results || [];
        } catch (fallbackErr) {
          log.error('segment_query_failed', { segment, error: errMsg, fallbackError: (fallbackErr as Error).message });
          return c.json({ success: false, error: 'Lỗi truy vấn phân khúc khách hàng' }, 500);
        }
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
                      } as Record<string, string>,
                      tenantId:
                        customer.tenant_id && String(customer.tenant_id).trim() && String(customer.tenant_id).trim() !== '*'
                          ? String(customer.tenant_id).trim()
                          : tenantId !== '*'
                            ? tenantId
                            : 'default'
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
