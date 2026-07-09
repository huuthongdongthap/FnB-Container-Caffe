import type { D1Database } from '@cloudflare/workers-types';
import type { ZnsData, ZnsResult, ZnsNotifyInput } from './types';
import { sendZNS } from './zns-sender';

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  zalo: string | null;
}

/**
 * High-level notify: resolve customer then send ZNS.
 * Falls back to pos_only if Zalo unavailable.
 */
export async function notifyMember(env: { ZALO_ACCESS_TOKEN?: string; AURA_DB?: D1Database }, params: ZnsNotifyInput): Promise<ZnsResult> {
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

  if (!customer) {
    return { ok: false, channel: 'pos_only', reason: 'customer_not_found' };
  }

  const sendPhone = customer.zalo || customer.phone;
  if (!sendPhone) {
    return { ok: false, channel: 'pos_only', reason: 'no_phone' };
  }

  const result = await sendZNS(env, {
    phone: sendPhone,
    template_key: params.template_key,
    data: { ...params.data, name: customer.name }
  });

  if (result.ok) {
    return { ok: true, channel: 'zalo' };
  }
  return { ok: false, channel: 'pos_only', reason: result.reason };
}
