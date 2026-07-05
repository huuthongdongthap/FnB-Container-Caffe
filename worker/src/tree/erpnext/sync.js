/**
 * ERPNext order sync — background fire-and-forget helper.
 *
 * Triggered from checkout (orders-hono.ts) via c.executionCtx.waitUntil.
 * Calls Sales Order + Lead creation on ERPNext when ERPNEXT_SYNC_ENABLED=true.
 *
 * Designed as ESM .js so it can be imported regardless of TS config.
 */

import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'erpnext-sync' });

/**
 * Sync a submitted order to ERPNext.
 *
 * @param {{ ERPNEXT_URL: string, ERPNEXT_API_KEY: string, ERPNEXT_API_SECRET: string }} env
 * @param {string} orderId
 * @param {{ customer_name?: string, customer_phone?: string, customer_id?: string, table_id?: string | null, items?: Array<Record<string, unknown>>, total?: number, payment_method?: string, notes?: string }} orderData
 * @returns {{ ok: boolean, orderId: string, results: { salesOrder: unknown, lead: unknown } }}
 */
export async function syncOrderToERPNext(env, orderId, orderData) {
  const baseUrl = env.ERPNEXT_URL?.replace(/\/$/, '');
  const apiKey = env.ERPNEXT_API_KEY;
  const apiSecret = env.ERPNEXT_API_SECRET;

  if (!baseUrl || !apiKey || !apiSecret) {
    log.warn('erpnext_credentials_missing', { orderId });
    return { ok: true, orderId, skipped: true, reason: 'missing-credentials' };
  }

  const authHeader = `token ${apiKey}:${apiSecret}`;
  const results = { salesOrder: null, lead: null };

  // ── 1) Sales Order (when customer_name is known) ─────────────────────────
  try {
    const customerName = orderData?.customer_name;
    if (customerName) {
      const soBody = {
        doctype: 'Sales Order',
        customer: customerName,
        customer_name: customerName,
        delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        items: Array.isArray(orderData?.items)
          ? orderData.items.map((it) => {
              const itemCode = String(it.product_id || it.item_code || '');
              const qty = Number(it.quantity ?? it.qty ?? 1);
              const rate = Number(it.unit_price ?? it.rate ?? 0);
              const amount =
                it.subtotal !== undefined
                  ? Number(it.subtotal)
                  : rate * qty;
              return { item_code: itemCode, qty, rate, amount };
            })
          : [],
        ...(orderData?.table_id
          ? { remarks: `Table ${orderData.table_id}` }
          : {}),
      };

      const soRespFixed = await fetch(
        `${baseUrl}/api/resource/Sales%20Order`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(soBody),
        },
      );

      const soJson = await soRespFixed.json().catch(() => ({}));
      results.salesOrder = soJson.data ?? soJson;

      if (!soRespFixed.ok) {
        console.error(
          '[erpnext-sync] Sales Order failed:',
          soRespFixed.status,
          soJson,
        );
      }
    }
  } catch (err) {
    log.error('erpnext_sales_order_exception', { error: err?.message || err });
  }

  // ── 2) Lead for new walk-in customers (no linked customer_id) ─────────────
  try {
    const isWalkIn = !orderData?.customer_id;
    if (isWalkIn && orderData?.customer_name && orderData?.customer_phone) {
      const leadBody = {
        doctype: 'Lead',
        lead_name: orderData.customer_name,
        mobile_no: orderData.customer_phone,
        source: 'Walk-in',
        status: 'Lead',
      };

      const leadResp = await fetch(`${baseUrl}/api/resource/Lead`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadBody),
      });

      const leadJson = await leadResp.json().catch(() => ({}));
      results.lead = leadJson.data ?? leadJson;

      if (!leadResp.ok) {
        console.error(
          '[erpnext-sync] Lead failed:',
          leadResp.status,
          leadJson,
        );
      }
    }
  } catch (err) {
    log.error('erpnext_lead_exception', { error: err?.message || err });
  }

  return { ok: true, orderId, results };
}
