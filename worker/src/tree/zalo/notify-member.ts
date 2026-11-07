import type { D1Database } from '@cloudflare/workers-types';
import type { ZnsResult, ZnsNotifyInput } from './types';
import { sendZNS } from './zns-sender';

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  zalo: string | null;
  tenant_id?: string | null;
}

function matchesCustomerTenant(customer: CustomerRecord, tenantId?: string): boolean {
  const effectiveTenant = (tenantId ?? '').trim() || 'default';
  if (effectiveTenant === '*') return true;
  if ('tenant_id' in customer && customer.tenant_id !== undefined && customer.tenant_id !== null && String(customer.tenant_id).trim() !== '') {
    return String(customer.tenant_id).trim() === effectiveTenant;
  }
  return effectiveTenant === 'default';
}

/**
 * High-level notify: resolve customer then send ZNS.
 * Falls back to pos_only if Zalo unavailable.
 */
export async function notifyMember(env: { ZALO_ACCESS_TOKEN?: string; AURA_DB?: D1Database }, params: ZnsNotifyInput, tenantOverride?: string): Promise<ZnsResult> {
  const rawParamTenant = (params.tenantId ?? '').trim();
  const rawOverrideTenant = (tenantOverride ?? '').trim();
  if (rawParamTenant && rawOverrideTenant) {
    const normParam = rawParamTenant.toLowerCase() === 'hq' ? '*' : rawParamTenant;
    const normOverride = rawOverrideTenant.toLowerCase() === 'hq' ? '*' : rawOverrideTenant;
    if (normParam !== '*' && normOverride !== '*' && normParam !== normOverride) {
      return { ok: false, channel: 'pos_only', reason: 'customer_not_found' };
    }
  }
  const rawTenant = rawParamTenant || rawOverrideTenant;
  const effectiveTenant = rawTenant.toLowerCase() === 'hq' ? '*' : (rawTenant || 'default');
  let customer: CustomerRecord | null = null;
  if (env.AURA_DB) {
    try {
      if (effectiveTenant !== '*') {
        customer = await env.AURA_DB.prepare(
          "SELECT id, name, phone, zalo, tenant_id FROM customers WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
        ).bind(params.customer_id, effectiveTenant, effectiveTenant).first<CustomerRecord>();
      } else {
        customer = await env.AURA_DB.prepare(
          'SELECT id, name, phone, zalo, tenant_id FROM customers WHERE id = ?'
        ).bind(params.customer_id).first<CustomerRecord>();
      }
    } catch {
      if (effectiveTenant === 'default' || effectiveTenant === '*') {
        try {
          customer = await env.AURA_DB.prepare(
            'SELECT id, name, phone, zalo, tenant_id FROM customers WHERE id = ?'
          ).bind(params.customer_id).first<CustomerRecord>();
        } catch {
          try {
            customer = await env.AURA_DB.prepare(
              'SELECT id, name, phone, zalo FROM customers WHERE id = ?'
            ).bind(params.customer_id).first<CustomerRecord>();
          } catch {
            /* db error — graceful */
          }
        }
      }
    }
  }

  if (customer && !matchesCustomerTenant(customer, effectiveTenant)) {
    customer = null;
  }

  if (!customer) {
    return { ok: false, channel: 'pos_only', reason: 'customer_not_found' };
  }

  const sendPhone = customer.zalo || customer.phone;
  if (!sendPhone) {
    return { ok: false, channel: 'pos_only', reason: 'no_phone' };
  }

  const customerTenant =
    typeof customer.tenant_id === 'string' &&
    customer.tenant_id.trim() &&
    customer.tenant_id.trim() !== '*' &&
    customer.tenant_id.trim().toLowerCase() !== 'hq'
      ? customer.tenant_id.trim()
      : 'default';
  const auditTenant = effectiveTenant === '*' ? customerTenant : effectiveTenant;

  const result = await sendZNS(env, {
    phone: sendPhone,
    template_key: params.template_key,
    data: { ...params.data, name: customer.name },
    tenantId: auditTenant
  });

  if (result.ok) {
    return { ok: true, channel: 'zalo' };
  }
  return { ok: false, channel: 'pos_only', reason: result.reason };
}
