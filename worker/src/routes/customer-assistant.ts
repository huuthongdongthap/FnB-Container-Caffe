/**
 * AI Customer Support Assistant Router
 * Conversational concierge for order status, table bills, WiFi, and Sa Đéc menu advice.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { getTenantId } from '../middleware/tenant';

export const customerAssistantRouter = new Hono<{ Bindings: Env }>();

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
    const extractedId = data.order_id || q.match(/#?([a-zA-Z0-9_-]{5,32})/)?.[1];

    if (extractedId) {
      orderRow = await db.prepare(
        'SELECT id, status, total FROM orders WHERE tenant_id = ? AND (id = ? OR id LIKE ?) LIMIT 1'
      ).bind(tenantId, extractedId, `%${extractedId}%`).first<{ id: string; status: string; total: number }>();
    } else if (data.phone) {
      orderRow = await db.prepare(
        'SELECT id, status, total FROM orders WHERE tenant_id = ? AND customer_phone = ? ORDER BY created_at DESC LIMIT 1'
      ).bind(tenantId, data.phone).first<{ id: string; status: string; total: number }>();
    }

    if (orderRow) {
      const st = STATUS_MAP[orderRow.status] || orderRow.status;
      reply = `Đơn hàng #${orderRow.id} (${orderRow.total.toLocaleString('vi-VN')}đ) hiện đang ở trạng thái: ${st}.`;
    } else {
      reply = 'AURA chưa tìm thấy đơn hàng tương ứng. Bạn vui lòng cung cấp mã đơn hoặc số điện thoại đã đặt nhé!';
    }
  } else if (q.includes('bàn') || q.includes('tính tiền') || q.includes('hóa đơn') || data.table_number) {
    intent = 'table_bill';
    const tbl = data.table_number || q.match(/bàn\s*([0-9a-zA-Z]+)/)?.[1];
    if (tbl) {
      const activeOrder = await db.prepare(
        'SELECT id, total, status FROM orders WHERE tenant_id = ? AND table_number = ? AND status NOT IN (\'completed\', \'cancelled\') LIMIT 1'
      ).bind(tenantId, tbl).first<{ id: string; total: number; status: string }>();
      if (activeOrder) {
        reply = `Bàn ${tbl} đang có đơn #${activeOrder.id} với tổng tiền ${activeOrder.total.toLocaleString('vi-VN')}đ (${STATUS_MAP[activeOrder.status] || activeOrder.status}).`;
      } else {
        reply = `Bàn ${tbl} hiện không có hóa đơn chưa thanh toán.`;
      }
    } else {
      reply = 'Bạn đang ngồi tại bàn số mấy để AURA kiểm tra hóa đơn giúp bạn nhé?';
    }
  } else if (q.includes('điểm') || q.includes('hạng') || q.includes('tích điểm')) {
    intent = 'loyalty_points';
    if (data.phone) {
      const cust = await db.prepare(
        'SELECT name, loyalty_points, loyalty_tier FROM customers WHERE phone = ? LIMIT 1'
      ).bind(data.phone).first<{ name: string; loyalty_points: number; loyalty_tier: string }>();
      if (cust) {
        reply = `Chào ${cust.name || 'bạn'}, bạn đang có ${cust.loyalty_points || 0} điểm tích lũy (Hạng: ${(cust.loyalty_tier || 'bronze').toUpperCase()}).`;
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
    const id = `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    await db.prepare(`
      INSERT INTO customer_support_interactions (
        id, tenant_id, channel, customer_phone, user_query, detected_intent, bot_response, engine_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, tenantId, data.channel, data.phone || null, data.query, intent, reply, engine).run();
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

  const tenantId = getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const aiBinding = (c.env as Record<string, unknown>).AI;

  const result = await processCustomerQuery(db, aiBinding, tenantId, parsed.data);
  return c.json({ success: true, data: result });
});
