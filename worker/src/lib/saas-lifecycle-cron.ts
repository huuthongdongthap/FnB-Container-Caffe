/**
 * SaaS Commercial Lifecycle, Stale-Invoice Expiry & Trial Dunning Cron.
 *
 * Uses deterministic `saas_audit_logs.id` keys so each milestone fires at most
 * once per tenant/cycle even under concurrent Worker cron ticks.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import { resolveTenantLifecycle } from './saas-entitlement';
import { sendTelegramMessage } from './alerts/telegram';

const ACTIVATION_MIN_PRODUCTS = 5;
const ACTIVATION_MIN_ORDERS = 3;
const MS_PER_24H = 24 * 60 * 60 * 1000;
const escapeMarkdown = (value: string): string => value.replace(/([_*`\[\]\\])/g, '\\$1');

export interface SaasLifecycleCronSummary {
  expiredInvoices: number;
  expiredTransactions: number;
  nudgesSent: number;
  trialD3Sent: number;
  trialD1Sent: number;
  graceD1Sent: number;
  telegramDispatched: number;
}

interface TenantLifecycleRow {
  id: string; slug: string; name: string | null; tier: string | null; status: string | null;
  owner_name: string | null; owner_email: string | null; owner_phone: string | null;
  trial_ends_at: string | null; current_period_end: string | null; created_at: string | null;
  sub_tier: string | null; billing_cycle: string | null; sub_status: string | null;
  sub_trial_ends_at: string | null; sub_period_end: string | null; grace_ends_at: string | null;
  product_count: number; order_count: number;
}

async function expireStalePending(
  db: D1Database,
  table: 'tenant_invoices' | 'saas_billing_transactions',
  nowIso: string
): Promise<number> {
  try {
    const res = await db
      .prepare(
        `UPDATE ${table} SET status = 'expired', updated_at = ?
         WHERE status = 'pending' AND created_at IS NOT NULL AND (julianday(?) - julianday(created_at)) >= 1`
      )
      .bind(nowIso, nowIso)
      .run();
    return Number(res.meta?.changes ?? 0);
  } catch {
    return 0;
  }
}

async function claimAndNotify(
  db: D1Database,
  env: Env,
  evt: { auditId: string; tenantId: string; action: string; reason: string; details: Record<string, unknown>; nowIso: string; text: string },
  summary: SaasLifecycleCronSummary
): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO saas_audit_logs (id, tenant_id, actor_user_id, actor_role, action, after_json, reason, created_at)
       VALUES (?, ?, 'system_cron', 'system', ?, ?, ?, ?)`
    )
    .bind(evt.auditId, evt.tenantId, evt.action, JSON.stringify(evt.details), evt.reason, evt.nowIso)
    .run();
  if (Number(res.meta?.changes ?? 0) !== 1) return false;

  const sent = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, evt.text);
  if (!sent) {
    await db.prepare('DELETE FROM saas_audit_logs WHERE id = ?').bind(evt.auditId).run().catch(() => {});
    return false;
  }
  summary.telegramDispatched++;
  return true;
}

export async function runSaasLifecycleCron(env: Env, now: Date = new Date()): Promise<SaasLifecycleCronSummary> {
  const summary: SaasLifecycleCronSummary = {
    expiredInvoices: 0,
    expiredTransactions: 0,
    nudgesSent: 0,
    trialD3Sent: 0,
    trialD1Sent: 0,
    graceD1Sent: 0,
    telegramDispatched: 0,
  };
  const db = env.AURA_DB;
  if (!db) return summary;

  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  summary.expiredInvoices = await expireStalePending(db, 'tenant_invoices', nowIso);
  summary.expiredTransactions = await expireStalePending(db, 'saas_billing_transactions', nowIso);

  let tenants: TenantLifecycleRow[] = [];
  try {
    const res = await db
      .prepare(
        `SELECT t.id, t.slug, t.name, t.tier, t.status, t.owner_name, t.owner_email, t.owner_phone,
                t.trial_ends_at, t.current_period_end, t.created_at,
                s.tier AS sub_tier, s.billing_cycle, s.status AS sub_status,
                s.trial_ends_at AS sub_trial_ends_at, s.current_period_end AS sub_period_end, s.grace_ends_at,
                (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id AND COALESCE(p.is_available, 1) = 1) AS product_count,
                (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id) AS order_count
         FROM saas_tenants t
         LEFT JOIN tenant_subscriptions s ON s.tenant_id = t.id
         WHERE LOWER(t.id) NOT IN ('default', 'hq', '*')`
      )
      .all<TenantLifecycleRow>();
    tenants = res.results || [];
  } catch {
    return summary;
  }

  for (const row of tenants) {
    const lifecycle = resolveTenantLifecycle(
      {
        tenant_id: row.id,
        tier: String(row.sub_tier || row.tier || 'starter'),
        billing_cycle: String(row.billing_cycle || 'monthly'),
        status: String(row.sub_status || row.status || 'trial'),
        trial_ends_at: row.sub_trial_ends_at ?? row.trial_ends_at,
        current_period_end: row.sub_period_end ?? row.current_period_end,
        grace_ends_at: row.grace_ends_at,
      },
      now
    );
    if (lifecycle.rawStatus === 'suspended' || lifecycle.lifecycleState === 'active') continue;

    const shopLabel = escapeMarkdown(row.name || row.slug);
    const contact = escapeMarkdown([row.owner_name, row.owner_phone, row.owner_email].filter(Boolean).join(' | ') || 'Chưa có liên hệ');
    const products = Number(row.product_count || 0);
    const orders = Number(row.order_count || 0);
    const createdMs = row.created_at ? Date.parse(row.created_at) : NaN;

    if (
      lifecycle.lifecycleState === 'trial' &&
      (products < ACTIVATION_MIN_PRODUCTS || orders < ACTIVATION_MIN_ORDERS) &&
      Number.isFinite(createdMs) &&
      nowMs - createdMs >= MS_PER_24H &&
      (await claimAndNotify(db, env, {
        auditId: `saas_nudge_24h:${row.id}`,
        tenantId: row.id,
        action: 'lifecycle_nudge_24h_unactivated',
        reason: '24h trial signup has not reached activation threshold',
        details: { slug: row.slug, products, orders },
        nowIso,
        text: `🟡 *SaaS Nudge 24h* — Quán *${shopLabel}* (\`/s/${row.slug}\`) chưa kích hoạt (${products} món, ${orders} đơn).\nLiên hệ: ${contact}`,
      }, summary))
    ) {
      summary.nudgesSent++;
    }

    if (lifecycle.lifecycleState === 'trial') {
      const trialEndTag = String(lifecycle.trialEndsAt || nowIso).slice(0, 10);
      if (lifecycle.daysRemaining <= 1) {
        if (await claimAndNotify(db, env, {
          auditId: `saas_trial_d1:${row.id}:${trialEndTag}`,
          tenantId: row.id,
          action: 'lifecycle_dunning_trial_d1',
          reason: 'Trial expires within 24 hours',
          details: { slug: row.slug, trialEndsAt: lifecycle.trialEndsAt, daysRemaining: lifecycle.daysRemaining },
          nowIso,
          text: `🟠 *SaaS Trial D-1* — Quán *${shopLabel}* (\`/s/${row.slug}\`) hết trial ngày *${trialEndTag}*.\nLiên hệ: ${contact}`,
        }, summary)) summary.trialD1Sent++;
      } else if (lifecycle.daysRemaining <= 3) {
        if (await claimAndNotify(db, env, {
          auditId: `saas_trial_d3:${row.id}:${trialEndTag}`,
          tenantId: row.id,
          action: 'lifecycle_dunning_trial_d3',
          reason: 'Trial expires within 3 days',
          details: { slug: row.slug, trialEndsAt: lifecycle.trialEndsAt, daysRemaining: lifecycle.daysRemaining },
          nowIso,
          text: `🔔 *SaaS Trial D-3* — Quán *${shopLabel}* (\`/s/${row.slug}\`) còn *${lifecycle.daysRemaining} ngày* trial (hết ${trialEndTag}).\nLiên hệ: ${contact}`,
        }, summary)) summary.trialD3Sent++;
      }
    }

    if (lifecycle.lifecycleState === 'grace' && lifecycle.daysRemaining <= 1) {
      const graceEndTag = String(lifecycle.graceEndsAt || nowIso).slice(0, 10);
      if (await claimAndNotify(db, env, {
        auditId: `saas_grace_d1:${row.id}:${graceEndTag}`,
        tenantId: row.id,
        action: 'lifecycle_dunning_grace_d1',
        reason: 'Grace period expires within 24 hours before read-only lock',
        details: { slug: row.slug, graceEndsAt: lifecycle.graceEndsAt, daysRemaining: lifecycle.daysRemaining },
        nowIso,
        text: `🔴 *SaaS Grace Period* — Quán *${shopLabel}* (\`/s/${row.slug}\`) sắp khóa Read-Only ngày *${graceEndTag}*.\nLiên hệ: ${contact}`,
      }, summary)) summary.graceD1Sent++;
    }
  }

  return summary;
}
