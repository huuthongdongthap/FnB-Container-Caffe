/**
 * Zalo ZNS Notification Service — /api/zalo
 * Sends transactional messages via Zalo Notification Service (ZNS).
 *
 * Prerequisites:
 *   1. Zalo OA Business verified at https://oa.zalo.me
 *   2. 4 ZNS templates approved (3-7 day review)
 *   3. wrangler secret put ZALO_ACCESS_TOKEN
 *   4. Update TEMPLATE_IDS below after approval
 *
 * Until ZALO_ACCESS_TOKEN is set: all sends are no-ops (logged, never throw).
 */

const ZALO_ZNS_URL = 'https://business.openapi.zalo.me/message/template';

// Replace placeholder IDs after Zalo template approval
const TEMPLATE_IDS: Record<string, string> = {
  welcome_signup: 'YOUR_WELCOME_TEMPLATE_ID',
  cashback_earned: 'YOUR_CASHBACK_TEMPLATE_ID',
  tier_upgrade: 'YOUR_TIER_TEMPLATE_ID',
  cashback_expiry_warning: 'YOUR_EXPIRY_TEMPLATE_ID',
};

interface ZaloEnv {
  ZALO_ACCESS_TOKEN?: string;
  AURA_DB?: D1Database;
}

interface ZnsData {
  name?: string;
  member_id?: string;
  balance?: number;
  qr_url?: string;
  amount?: number;
  order_id?: string;
  new_tier?: string;
  new_tier_vi?: string;
  new_rate?: number;
  days?: number;
}

interface ZnsResult {
  ok: boolean;
  channel: string;
  reason?: string;
  result?: unknown;
}

interface ZnsNotifyInput {
  customer_id: string;
  template_key: string;
  data: ZnsData;
}

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  zalo: string | null;
}

// Normalize VN phone → ZNS format: 0901234567 | +84901234567 → 84901234567
function normalizePhone(phone: string): string {
  return String(phone || '').replace(/^\+?84/, '').replace(/^0/, '');
}

function buildTemplateData(template_key: string, data: ZnsData): Record<string, string> {
  switch (template_key) {
    case 'welcome_signup':
      return {
        customer_name: data.name || '',
        member_id: data.member_id || '',
        balance: (data.balance || 0).toLocaleString('vi-VN') + 'đ',
        qr_url: data.qr_url || 'https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien',
      };
    case 'cashback_earned':
      return {
        customer_name: data.name || '',
        amount_earned: (data.amount || 0).toLocaleString('vi-VN') + 'đ',
        new_balance: (data.balance || 0).toLocaleString('vi-VN') + 'đ',
        order_id: 'AC' + String(data.order_id || '').slice(0, 8).toUpperCase(),
      };
    case 'tier_upgrade':
      return {
        customer_name: data.name || '',
        new_tier: data.new_tier_vi || data.new_tier || '',
        cashback_rate: ((data.new_rate || 0) * 100) + '%',
      };
    case 'cashback_expiry_warning':
      return {
        customer_name: data.name || '',
        expiring_amount: (data.amount || 0).toLocaleString('vi-VN') + 'đ',
        days_remaining: String(data.days || 7),
      };
    default:
      return {};
  }
}

/**
 * Send a single ZNS message.
 * Returns { ok, channel } — never throws.
 */
export async function sendZNS(env: ZaloEnv, params: { phone: string; template_key: string; data: ZnsData }): Promise<ZnsResult> {
  if (!env.ZALO_ACCESS_TOKEN) {
    return { ok: false, channel: 'zalo', reason: 'no_token' };
  }

  const template_id = TEMPLATE_IDS[params.template_key];
  if (!template_id || template_id.startsWith('YOUR_')) {
    return { ok: false, channel: 'zalo', reason: 'template_not_configured' };
  }

  const normalized = '84' + normalizePhone(params.phone);
  let status = 'failed';
  let zaloResponse: unknown = null;

  try {
    const res = await fetch(ZALO_ZNS_URL, {
      method: 'POST',
      headers: {
        'access_token': env.ZALO_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: normalized,
        template_id,
        template_data: buildTemplateData(params.template_key, params.data),
        tracking_id: `aura_${Date.now()}`,
      }),
    });

    zaloResponse = await res.json();
    status = (zaloResponse as { error: number }).error === 0 ? 'sent' : 'failed';
  } catch (err: unknown) {
    zaloResponse = { error: -1, message: err instanceof Error ? err.message : String(err) };
  }

  // Audit log — fire-and-forget, never block main flow
  if (env.AURA_DB) {
    try {
      await env.AURA_DB.prepare(
        `INSERT INTO notification_audit_log
         (channel, phone, template_key, data, status, response, created_at)
         VALUES ('zalo_zns', ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        params.phone, params.template_key,
        JSON.stringify(params.data), status,
        JSON.stringify(zaloResponse)
      ).run();
    } catch {
      /* audit failure never blocks */
    }
  }

  return { ok: status === 'sent', channel: 'zalo', result: zaloResponse };
}

/**
 * High-level notify: resolve customer then send ZNS.
 * Falls back to pos_only if Zalo unavailable.
 */
export async function notifyMember(env: ZaloEnv, params: ZnsNotifyInput): Promise<ZnsResult> {
  let customer: CustomerRecord | null = null;
  if (env.AURA_DB) {
    try {
      customer = await env.AURA_DB.prepare(
        'SELECT id, name, phone, zalo FROM customers WHERE id = ?'
      ).bind(params.customer_id).first<CustomerRecord>();
    } catch {
      /* db error — graceful */
    }
  }

  if (!customer) return { ok: false, channel: 'pos_only', reason: 'customer_not_found' };

  const sendPhone = customer.zalo || customer.phone;
  if (!sendPhone) return { ok: false, channel: 'pos_only', reason: 'no_phone' };

  const result = await sendZNS(env, {
    phone: sendPhone,
    template_key: params.template_key,
    data: { ...params.data, name: customer.name },
  });

  if (result.ok) return { ok: true, channel: 'zalo' };
  return { ok: false, channel: 'pos_only', reason: result.reason };
}

// ── Router handler for /api/zalo webhooks ──

export async function handleZaloRequest(request: Request, env: ZaloEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/zalo', '');
  const method = request.method;

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  // POST /api/zalo/send — manual send endpoint
  if (method === 'POST' && path === '/send') {
    const body = await request.json() as { phone?: string; customer_id?: string; template_key: string; data: ZnsData };

    if (body.customer_id) {
      const result = await notifyMember(env, {
        customer_id: body.customer_id,
        template_key: body.template_key,
        data: body.data,
      });
      return json({ success: result.ok, data: result });
    }

    if (body.phone) {
      const result = await sendZNS(env, {
        phone: body.phone,
        template_key: body.template_key,
        data: body.data,
      });
      return json({ success: result.ok, data: result });
    }

    return json({ success: false, error: 'phone or customer_id required' }, 400);
  }

  return json({ success: false, error: 'Not found' }, 404);
}
