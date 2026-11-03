/**
 * AI Customer Support Assistant Router
 * Conversational concierge for order status, table bills, WiFi, and Sa Đéc menu advice.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { optionalAuth } from '../middleware/auth';
import { resolvePublicTenantId as resolveAssistantTenantId } from '../middleware/tenant';

export const customerAssistantRouter = new Hono<{ Bindings: Env }>();

customerAssistantRouter.use('/*', async (c, next) => {
  if (!c.get('user' as never) && (c.req.header('Authorization') || c.req.header('authorization'))) {
    return optionalAuth()(c, next);
  }
  return next();
});

const querySchema = z.object({
  query: z.string().min(1).max(500),
  phone: z.string().max(20).optional(),
  order_id: z.string().max(50).optional(),
  table_number: z.string().max(20).optional(),
  channel: z.enum(['web', 'zalo', 'kiosk']).default('web')
});

const STATUS_MAP: Record<string, string> = {
  pending: 'chờ xác nhận',
  confirmed: 'đã xác nhận',
  preparing: 'đang pha chế',
  ready: 'đã sẵn sàng, mời bạn nhận món tại quầy',
  served: 'đã phục vụ',
  completed: 'hoàn thành',
  cancelled: 'đã hủy'
};

function makeInteractionId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `cs_${Date.now().toString(36)}_${rand}`;
}

function maskCustomerName(name?: string | null): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'bạn';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return `${trimmed.slice(0, 1)}***`;
  }
  return `${parts[0]} ***`;
}

function maskOrderId(orderId: string): string {
  if (orderId.length <= 4) return `***${orderId}`;
  return `***${orderId.slice(-4)}`;
}

export async function processCustomerQuery(
  db: import('@cloudflare/workers-types').D1Database,
  aiBinding: unknown,
  tenantId: string,
  data: z.infer<typeof querySchema>
): Promise<{ intent: string; reply: string; engine: string }> {
  const q = data.query.toLowerCase();
  let intent = 'general';
  let reply = '';
  let engine = 'deterministic';

  if (q.includes('wifi') || q.includes('wi-fi') || q.includes('mật khẩu') || q.includes('pass')) {
    intent = 'wifi_info';
    reply = 'WiFi: AURA_CAFE_FREE_WIFI (Mật khẩu: auracafe2026). Sau khi kết nối, trang đăng nhập chào mừng sẽ tự động xuất hiện.';
  } else if (q.includes('đơn') || q.includes('order') || q.includes('giao') || q.includes('làm xong') || data.order_id) {
    intent = 'order_status';
    let orderRow: { id: string; status: string; total: number } | null = null;
    const extractedId = data.order_id?.trim() || q.match(/(?:#([a-z0-9_-]{3,32})|\b((?:ord[_-])[a-z0-9_-]{2,32}|(?=[a-z0-9_-]*\d)[a-z0-9_-]{5,32})\b)/i)?.[1]
      || q.match(/(?:#([a-z0-9_-]{3,32})|\b((?:ord[_-])[a-z0-9_-]{2,32}|(?=[a-z0-9_-]*\d)[a-z0-9_-]{5,32})\b)/i)?.[2];

    if (extractedId) {
      try {
        orderRow = await db.prepare(
          "SELECT id, status, COALESCE(total_amount, total, 0) as total FROM orders WHERE (? = '*' OR COALESCE(NULLIF(tenant_id, ''), 'default') = ?) AND LOWER(id) = LOWER(?) OR (?1 = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) AND LOWER(id) = LOWER(?3) LIMIT 1"
        ).bind(tenantId, tenantId, extractedId).first<{ id: string; status: string; total: number }>();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/no such column:\s*tenant_id/i.test(msg)) {
          orderRow = (tenantId === 'default' || tenantId === '*')
            ? await db.prepare('SELECT id, status, COALESCE(total, 0) as total FROM orders WHERE LOWER(id) = LOWER(?) LIMIT 1')
                .bind(extractedId).first<{ id: string; status: string; total: number }>().catch(() => null)
            : null;
        } else {
          orderRow = await db.prepare("SELECT id, status, COALESCE(total, 0) as total FROM orders WHERE (? = '*' OR COALESCE(NULLIF(tenant_id, ''), 'default') = ?) AND LOWER(id) = LOWER(?) OR (?1 = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) AND LOWER(id) = LOWER(?3) LIMIT 1")
            .bind(tenantId, tenantId, extractedId).first<{ id: string; status: string; total: number }>().catch(() => null);
        }
      }
    } else if (data.phone) {
      try {
        orderRow = await db.prepare(
          "SELECT id, status, COALESCE(total_amount, total, 0) as total FROM orders WHERE (? = '*' OR COALESCE(NULLIF(tenant_id, ''), 'default') = ?) AND customer_phone = ? OR (?1 = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) AND customer_phone = ?3 ORDER BY created_at DESC LIMIT 1"
        ).bind(tenantId, tenantId, data.phone).first<{ id: string; status: string; total: number }>();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        orderRow = /no such column:\s*tenant_id/i.test(msg)
          ? (tenantId === 'default' || tenantId === '*'
              ? await db.prepare('SELECT id, status, COALESCE(total, 0) as total FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 1')
                  .bind(data.phone).first<{ id: string; status: string; total: number }>().catch(() => null)
              : null)
          : await db.prepare("SELECT id, status, COALESCE(total, 0) as total FROM orders WHERE (? = '*' OR COALESCE(NULLIF(tenant_id, ''), 'default') = ?) AND customer_phone = ? OR (?1 = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2) AND customer_phone = ?3 ORDER BY created_at DESC LIMIT 1")
              .bind(tenantId, tenantId, data.phone).first<{ id: string; status: string; total: number }>().catch(() => null);
      }
    }

    if (orderRow) {
      const st = STATUS_MAP[orderRow.status] || orderRow.status;
      const displayId = extractedId || data.channel === 'zalo' ? orderRow.id : maskOrderId(orderRow.id);
      reply = `Đơn hàng #${displayId} (${Number(orderRow.total || 0).toLocaleString('vi-VN')}đ) hiện đang ở trạng thái: ${st}.`;
    } else {
      reply = 'AURA chưa tìm thấy đơn hàng tương ứng. Bạn vui lòng cung cấp mã đơn hoặc số điện thoại đã đặt nhé!';
    }
  } else if (q.includes('bàn') || q.includes('tính tiền') || q.includes('hóa đơn') || data.table_number) {
    intent = 'table_bill';
    const tbl = data.table_number || q.match(/bàn\s*([0-9a-zA-Z]+)/)?.[1];
    if (tbl) {
      let activeOrder: { id: string; total: number; status: string } | null = null;
      try {
        activeOrder = await db.prepare(
          `SELECT o.id, COALESCE(o.total_amount, o.total, 0) as total, o.status
           FROM orders o
           LEFT JOIN cafe_tables t ON o.table_id = t.id
             AND (COALESCE(NULLIF(t.tenant_id, ''), 'default') = COALESCE(NULLIF(o.tenant_id, ''), 'default') OR COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default'))
           WHERE (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)
             AND (o.table_number = ? OR t.table_number = ? OR o.table_id = ?)
             AND o.status NOT IN ('completed', 'cancelled')
           ORDER BY o.created_at DESC
           LIMIT 1`
        ).bind(tenantId, tenantId, tbl, tbl, tbl).first<{ id: string; total: number; status: string }>();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/no such column:\s*(?:o\.)?tenant_id/i.test(msg)) {
          activeOrder = (tenantId === 'default' || tenantId === '*')
            ? await db.prepare(
                `SELECT o.id, COALESCE(o.total, 0) as total, o.status FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id
                 WHERE (CAST(t.table_number AS TEXT) = ? OR o.table_id = ?) AND o.status NOT IN ('completed', 'cancelled') ORDER BY o.created_at DESC LIMIT 1`
              ).bind(String(tbl), tbl).first<{ id: string; total: number; status: string }>().catch(() => null)
            : null;
        } else {
          try {
            activeOrder = await db.prepare(
              `SELECT o.id, COALESCE(o.total, 0) as total, o.status FROM orders o
               LEFT JOIN cafe_tables t ON o.table_id = t.id
                 AND (? = '*' OR COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = ?)
               WHERE (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)
                 AND (o.table_number = ? OR CAST(t.table_number AS TEXT) = ? OR o.table_id = ?)
                 AND o.status NOT IN ('completed', 'cancelled') ORDER BY o.created_at DESC LIMIT 1`
            ).bind(tenantId, tenantId, tenantId, tenantId, String(tbl), String(tbl), tbl).first<{ id: string; total: number; status: string }>();
          } catch {
            try {
              activeOrder = await db.prepare(
                `SELECT o.id, COALESCE(o.total, 0) as total, o.status FROM orders o
                 LEFT JOIN cafe_tables t ON o.table_id = t.id
                   AND (? = '*' OR COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = ?)
                 WHERE (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)
                   AND (CAST(t.table_number AS TEXT) = ? OR o.table_id = ?)
                   AND o.status NOT IN ('completed', 'cancelled') ORDER BY o.created_at DESC LIMIT 1`
              ).bind(tenantId, tenantId, tenantId, tenantId, String(tbl), tbl).first<{ id: string; total: number; status: string }>();
            } catch {
              activeOrder = await db.prepare(
                `SELECT o.id, COALESCE(o.total, 0) as total, o.status FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id
                 WHERE (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?) AND (CAST(t.table_number AS TEXT) = ? OR o.table_id = ?)
                   AND o.status NOT IN ('completed', 'cancelled') ORDER BY o.created_at DESC LIMIT 1`
              ).bind(tenantId, tenantId, String(tbl), tbl).first<{ id: string; total: number; status: string }>().catch(() => null);
            }
          }
        }
      }
      if (activeOrder) {
        reply = `Bàn ${tbl} đang có đơn #${maskOrderId(activeOrder.id)} với tổng tiền ${Number(activeOrder.total || 0).toLocaleString('vi-VN')}đ (${STATUS_MAP[activeOrder.status] || activeOrder.status}).`;
      } else {
        reply = `Bàn ${tbl} hiện không có hóa đơn chưa thanh toán.`;
      }
    } else {
      reply = 'Bạn đang ngồi tại bàn số mấy để AURA kiểm tra hóa đơn giúp bạn nhé?';
    }
  } else if (q.includes('điểm') || q.includes('hạng') || q.includes('tích điểm')) {
    intent = 'loyalty_points';
    if (data.phone) {
      let cust: { name: string; loyalty_points: number; loyalty_tier: string } | null = null;
      try {
        cust = await db.prepare(
          "SELECT name, loyalty_points, loyalty_tier FROM customers WHERE phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
        ).bind(data.phone, tenantId, tenantId).first<{ name: string; loyalty_points: number; loyalty_tier: string }>();
      } catch (err) {
        if (/no such column:\s*tenant_id/i.test(err instanceof Error ? err.message : String(err))) {
          cust = (tenantId === 'default' || tenantId === '*')
            ? await db.prepare('SELECT name, loyalty_points, loyalty_tier FROM customers WHERE phone = ? LIMIT 1')
                .bind(data.phone).first<{ name: string; loyalty_points: number; loyalty_tier: string }>().catch(() => null)
            : null;
        }
      }
      if (cust) {
        reply = `Chào ${maskCustomerName(cust.name)}, bạn đang có ${cust.loyalty_points || 0} điểm tích lũy (Hạng: ${(cust.loyalty_tier || 'bronze').toUpperCase()}).`;
      } else {
        reply = `Số điện thoại ${data.phone} chưa đăng ký thành viên. Bạn có thể đăng ký ngay tại quầy hoặc trên ứng dụng AURA!`;
      }
    } else {
      reply = 'Vui lòng cung cấp số điện thoại để AURA tra cứu điểm thành viên cho bạn nhé!';
    }
  } else if (q.includes('menu') || q.includes('uống gì') || q.includes('món') || q.includes('đặc sản') || q.includes('gợi ý')) {
    intent = 'menu_recommendation';
    reply = 'Đặc sản AURA hôm nay: Cà phê muối Sa Đéc đậm đà kem mặn béo ngậy, Cà phê cốt dừa Bến Tre tuyết mịn, và Trà sen Tháp Mười thanh mát.';
  } else if (q.includes('giờ') || q.includes('mở cửa') || q.includes('địa chỉ') || q.includes('ở đâu')) {
    intent = 'store_info';
    reply = 'AURA CAFE Container mở cửa phục vụ từ 06:30 đến 22:00 mỗi ngày tại Làng hoa Sa Đéc, Đồng Tháp. Rất hân hạnh đón tiếp bạn!';
  } else {
    // Attempt Workers AI for free-form conversation if bound
    const ai = aiBinding as { run: (_m: string, _opts: unknown) => Promise<{ response?: string }> } | undefined;
    if (ai && typeof ai.run === 'function') {
      try {
        const resp = await ai.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are AURA CAFE assistant in Sa Đéc. Reply warmly in Vietnamese in 1-2 sentences.' },
            { role: 'user', content: data.query }
          ]
        });
        if (resp?.response) {
          reply = resp.response.trim();
          engine = 'workers_ai';
        }
      } catch { /* fallback to default */ }
    }
    if (!reply) {
      reply = 'Chào bạn! AURA có thể giúp bạn kiểm tra trạng thái đơn hàng, tra cứu hóa đơn bàn, xem mật khẩu WiFi hoặc gợi ý món đặc sản!';
    }
  }

  // Non-blocking interaction log
  try {
    const id = makeInteractionId();
    const logTenantId = tenantId === '*' ? 'default' : tenantId;
    await db.prepare(`
      INSERT INTO customer_support_interactions (
        id, tenant_id, channel, customer_phone, user_query, detected_intent, bot_response, engine_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, logTenantId, data.channel, data.phone || null, data.query, intent, reply, engine).run();
  } catch { /* non-blocking log error */ }

  return { intent, reply, engine };
}

// POST /api/chat/assistant
customerAssistantRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = querySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid input' }, 400);
  }

  const tenantId = resolveAssistantTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const aiBinding = (c.env as Record<string, unknown>).AI;
  const user = c.get('user' as never) as { id?: string; sub?: string; role?: string; phone?: string } | undefined;
  const isStaff = Boolean(user?.role && ['owner', 'admin', 'manager', 'supervisor', 'staff', 'waiter', 'cashier'].includes(user.role));

  if (user && !isStaff && parsed.data.phone) {
    const normalizePhone = (v: string) => v.replace(/[\s()-]/g, '').trim();
    const targetPhone = normalizePhone(parsed.data.phone);
    const claimPhone = typeof user.phone === 'string' && user.phone.trim() ? normalizePhone(user.phone) : '';
    const userId = String(user.id || user.sub || '').trim();

    let phoneOwned = false;
    if (claimPhone) {
      phoneOwned = claimPhone === targetPhone;
    } else if (userId && normalizePhone(userId) === targetPhone) {
      phoneOwned = true;
    } else if (userId && db) {
      let custRow: { phone?: string | null } | null = null;
      try {
        custRow = await db
          .prepare(
            "SELECT phone FROM customers WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
          )
          .bind(userId, tenantId, tenantId)
          .first<{ phone?: string | null }>();
      } catch {
        custRow = await db
          .prepare('SELECT phone FROM customers WHERE id = ? LIMIT 1')
          .bind(userId)
          .first<{ phone?: string | null }>()
          .catch(() => null);
      }

      if (custRow?.phone && custRow.phone.trim()) {
        phoneOwned = normalizePhone(custRow.phone) === targetPhone;
      } else {
        let ownOrderRow: { customer_phone?: string | null } | null = null;
        try {
          ownOrderRow = await db
            .prepare(
              "SELECT customer_phone FROM orders WHERE customer_id = ? AND customer_phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
            )
            .bind(userId, parsed.data.phone, tenantId, tenantId)
            .first<{ customer_phone?: string | null }>();
        } catch {
          ownOrderRow = await db
            .prepare('SELECT customer_phone FROM orders WHERE customer_id = ? AND customer_phone = ? LIMIT 1')
            .bind(userId, parsed.data.phone)
            .first<{ customer_phone?: string | null }>()
            .catch(() => null);
        }
        phoneOwned = Boolean(ownOrderRow?.customer_phone && normalizePhone(ownOrderRow.customer_phone) === targetPhone);
      }
    }

    if (!phoneOwned) {
      return c.json({ success: false, error: 'Forbidden: cannot query another customer phone number' }, 403);
    }
  }

  const safeData = isStaff ? parsed.data : { ...parsed.data, channel: 'web' as const };

  const result = await processCustomerQuery(db, aiBinding, tenantId, safeData);
  return c.json({ success: true, data: result });
});
