import type { Hono } from 'hono';
import type { CampaignTrigger, CampaignChannel } from '@aura/domain-crm';
import { campaignConfigSchema, zodErrorResponse } from '../../lib/validators';
import { getTenantId, matchesTenantRow } from '../../middleware/tenant';
import type { Env } from '../../types/env';
import {
  ALL_TRIGGERS,
  ALL_CHANNELS,
  TRIGGER_META,
  type CampaignConfig
} from './constants';

async function ensureTenantCampaignTable(db: import('@cloudflare/workers-types').D1Database): Promise<void> {
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS tenant_campaign_configs (tenant_id TEXT NOT NULL, trigger TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, channels TEXT NOT NULL DEFAULT \'["sms"]\', timing TEXT, updated_at TEXT, PRIMARY KEY (tenant_id, trigger))'
  ).run().catch(() => {});
}

async function seedTenantCampaignDefaults(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
): Promise<CampaignConfig[]> {
  const cleanTenant = tenantId.trim();
  await ensureTenantCampaignTable(db);
  const { results: existing } = await db.prepare(
    'SELECT trigger, is_active, channels, timing, updated_at FROM tenant_campaign_configs WHERE (tenant_id = ? OR TRIM(tenant_id) = ?1) ORDER BY trigger'
  ).bind(cleanTenant).all<CampaignConfig>();

  const existingMap = new Map((existing || []).map((r) => [r.trigger, r]));
  const now = new Date().toISOString();
  for (const trigger of ALL_TRIGGERS) {
    if (!existingMap.has(trigger)) {
      const meta = TRIGGER_META[trigger];
      await db.prepare(
        'INSERT OR IGNORE INTO tenant_campaign_configs (tenant_id, trigger, is_active, channels, timing, updated_at) VALUES (?, ?, 1, ?, ?, ?)'
      ).bind(cleanTenant, trigger, JSON.stringify(meta.default_channels), meta.timing_hint, now).run();
    }
  }

  const { results: all } = await db.prepare(
    'SELECT trigger, is_active, channels, timing, updated_at FROM tenant_campaign_configs WHERE (tenant_id = ? OR TRIM(tenant_id) = ?1) ORDER BY trigger'
  ).bind(cleanTenant).all<CampaignConfig>();
  return all || [];
}

function parseChannelsSafe(raw: unknown, fallback: string[] = ['push']): CampaignChannel[] {
  if (Array.isArray(raw)) {
    const items = raw.filter((ch): ch is string => typeof ch === 'string');
    return (items.length ? items : fallback) as CampaignChannel[];
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const items = parsed.filter((ch): ch is string => typeof ch === 'string');
        return (items.length ? items : fallback) as CampaignChannel[];
      }
    } catch {
      // Fall back when stored or supplied channels JSON is malformed
    }
  }
  return fallback as CampaignChannel[];
}

function enrichRow(row: CampaignConfig) {
  return {
    ...row,
    channels: parseChannelsSafe(row.channels, ['push']),
    meta: TRIGGER_META[row.trigger as CampaignTrigger] || null
  };
}

function resolveUpdatedChannels(rawChannels: unknown, fallback: string): string {
  const safeFallback = JSON.stringify(parseChannelsSafe(fallback, ['sms']));
  if (!rawChannels) return safeFallback;
  const parsed = parseChannelsSafe(rawChannels, ['push']);
  const valid = parsed.filter((ch) => ALL_CHANNELS.includes(ch as CampaignChannel));
  return JSON.stringify(valid.length ? valid : ['sms']);
}

export function registerCampaignConfigHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/campaigns — list all campaign configs with defaults for missing entries
  router.get('/', async (c) => {
    const db = c.env.AURA_DB;
    const rawTenant = getTenantId(c as any).trim() || 'default';
    const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;

    if (tenantId !== 'default' && tenantId !== '*') {
      const all = await seedTenantCampaignDefaults(db, tenantId);
      return c.json({ success: true, data: all.map(enrichRow) });
    }

    let existing: CampaignConfig[] = [];
    try {
      const res = await db.prepare(
        "SELECT * FROM campaign_configs WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY trigger"
      ).bind(tenantId, tenantId).all<CampaignConfig>();
      existing = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
    } catch {
      if (tenantId === 'default') {
        const res = await db.prepare('SELECT * FROM campaign_configs ORDER BY trigger').all<CampaignConfig>();
        existing = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      }
    }
    const existingMap = new Map(existing.map((r) => [r.trigger, r]));
    const now = new Date().toISOString();
    const writeTenant = tenantId === '*' ? 'default' : tenantId;
    for (const trigger of ALL_TRIGGERS) {
      if (!existingMap.has(trigger)) {
        const meta = TRIGGER_META[trigger];
        try {
          await db.prepare(
            'INSERT OR IGNORE INTO campaign_configs (trigger, is_active, channels, timing, tenant_id, updated_at) VALUES (?, 1, ?, ?, ?, ?)'
          ).bind(trigger, JSON.stringify(meta.default_channels), meta.timing_hint, writeTenant, now).run();
        } catch {
          if (tenantId === 'default') {
            await db.prepare(
              'INSERT OR IGNORE INTO campaign_configs (trigger, is_active, channels, timing, updated_at) VALUES (?, 1, ?, ?, ?)'
            ).bind(trigger, JSON.stringify(meta.default_channels), meta.timing_hint, now).run();
          }
        }
      }
    }

    let all: CampaignConfig[] = [];
    try {
      const res = await db.prepare(
        "SELECT * FROM campaign_configs WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY trigger"
      ).bind(tenantId, tenantId).all<CampaignConfig>();
      all = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
    } catch {
      if (tenantId === 'default') {
        const res = await db.prepare('SELECT * FROM campaign_configs ORDER BY trigger').all<CampaignConfig>();
        all = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      }
    }
    return c.json({ success: true, data: all.map(enrichRow) });
  });

  // GET /api/campaigns/:trigger — single config
  router.get('/:trigger', async (c) => {
    const db = c.env.AURA_DB;
    const rawTenant = getTenantId(c as any).trim() || 'default';
    const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
    const trigger = c.req.param('trigger') as CampaignTrigger;

    if (tenantId !== 'default' && tenantId !== '*') {
      if (!ALL_TRIGGERS.includes(trigger)) {
        return c.json({ success: false, error: 'Khong tim thay chien dich' }, 404);
      }
      await ensureTenantCampaignTable(db);
      const row = await db.prepare(
        'SELECT trigger, is_active, channels, timing, updated_at FROM tenant_campaign_configs WHERE (tenant_id = ? OR TRIM(tenant_id) = ?1) AND trigger = ?'
      ).bind(tenantId, trigger).first<CampaignConfig>();
      if (!row) return c.json({ success: false, error: 'Khong tim thay chien dich' }, 404);
      return c.json({ success: true, data: enrichRow(row) });
    }

    let row: CampaignConfig | null = null;
    try {
      row = await db.prepare(
        "SELECT * FROM campaign_configs WHERE trigger = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      ).bind(trigger, tenantId, tenantId).first<CampaignConfig>();
    } catch {
      if (tenantId === 'default') {
        row = await db.prepare('SELECT * FROM campaign_configs WHERE trigger = ?').bind(trigger).first<CampaignConfig>();
      }
    }
    if (!row || !matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Khong tim thay chien dich' }, 404);
    }
    return c.json({ success: true, data: enrichRow(row) });
  });

  // PUT /api/campaigns/:trigger — update config
  router.put('/:trigger', async (c) => {
    const user = (c as any).get?.('user') as { role?: string } | undefined;
    if (!user?.role || !['owner', 'manager', 'admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const db = c.env.AURA_DB;
    const rawTenant = getTenantId(c as any).trim() || 'default';
    const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
    if (tenantId === '*') {
      return c.json({ success: false, error: 'Concrete tenant context required for campaign config modification' }, 400);
    }
    const trigger = c.req.param('trigger') as CampaignTrigger;

    if (!ALL_TRIGGERS.includes(trigger)) {
      return c.json({ success: false, error: 'Loai chien dich khong hop le' }, 400);
    }

    const raw = await c.req.json();
    const parsed = campaignConfigSchema.safeParse(raw);
    if (!parsed.success) return zodErrorResponse(c, parsed.error);
    const body = parsed.data;

    if (tenantId !== 'default') {
      await ensureTenantCampaignTable(db);
      const selectSql = 'SELECT trigger, is_active, channels, timing, updated_at FROM tenant_campaign_configs WHERE (tenant_id = ? OR TRIM(tenant_id) = ?1) AND trigger = ?';
      let existing = await db.prepare(selectSql).bind(tenantId, trigger).first<CampaignConfig>();
      if (!existing) {
        const meta = TRIGGER_META[trigger];
        await db.prepare(
          'INSERT OR IGNORE INTO tenant_campaign_configs (tenant_id, trigger, is_active, channels, timing, updated_at) VALUES (?, ?, 1, ?, ?, ?)'
        ).bind(tenantId, trigger, JSON.stringify(meta.default_channels), meta.timing_hint, new Date().toISOString()).run();
        existing = await db.prepare(selectSql).bind(tenantId, trigger).first<CampaignConfig>();
      }
      if (!existing) return c.json({ success: false, error: 'Khong tim thay chien dich' }, 404);
      const isActive = body.is_active !== undefined ? body.is_active : existing.is_active;
      const channels = resolveUpdatedChannels(body.channels, existing.channels);
      await db.prepare(
        'UPDATE tenant_campaign_configs SET is_active = ?, channels = ?, updated_at = ? WHERE (tenant_id = ? OR TRIM(tenant_id) = ?4) AND trigger = ?'
      ).bind(isActive, channels, new Date().toISOString(), tenantId, trigger).run();
      const updated = await db.prepare(selectSql).bind(tenantId, trigger).first<CampaignConfig>();
      return c.json({ success: true, data: enrichRow(updated!) });
    }

    let existing: CampaignConfig | null = null;
    try {
      existing = await db.prepare(
        "SELECT * FROM campaign_configs WHERE trigger = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(trigger, tenantId).first<CampaignConfig>();
    } catch {
      if (tenantId === 'default') {
        existing = await db.prepare('SELECT * FROM campaign_configs WHERE trigger = ?').bind(trigger).first<CampaignConfig>();
      }
    }
    if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Khong tim thay chien dich' }, 404);
    }

    const isActive = body.is_active !== undefined ? body.is_active : existing.is_active;
    const channels = resolveUpdatedChannels(body.channels, existing.channels);
    const now = new Date().toISOString();
    try {
      await db.prepare(
        "UPDATE campaign_configs SET is_active = ?, channels = ?, updated_at = ? WHERE trigger = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(isActive, channels, now, trigger, tenantId).run();
    } catch {
      if (tenantId === 'default') {
        await db.prepare('UPDATE campaign_configs SET is_active = ?, channels = ?, updated_at = ? WHERE trigger = ?')
          .bind(isActive, channels, now, trigger).run();
      }
    }

    let updated: CampaignConfig | null = null;
    try {
      updated = await db.prepare(
        "SELECT * FROM campaign_configs WHERE trigger = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(trigger, tenantId).first<CampaignConfig>();
    } catch {
      if (tenantId === 'default') {
        updated = await db.prepare('SELECT * FROM campaign_configs WHERE trigger = ?').bind(trigger).first<CampaignConfig>();
      }
    }
    return c.json({ success: true, data: enrichRow(updated!) });
  });

  // DELETE /api/campaigns/:trigger — delete config (reset to defaults)
  router.delete('/:trigger', async (c) => {
    const user = (c as any).get?.('user') as { role?: string } | undefined;
    if (!user?.role || !['owner', 'manager', 'admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const db = c.env.AURA_DB;
    const rawTenant = getTenantId(c as any).trim() || 'default';
    const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
    if (tenantId === '*') {
      return c.json({ success: false, error: 'Concrete tenant context required for campaign config modification' }, 400);
    }
    const trigger = c.req.param('trigger') as CampaignTrigger;

    if (!ALL_TRIGGERS.includes(trigger)) {
      return c.json({ success: false, error: 'Loai chien dich khong hop le' }, 400);
    }

    if (tenantId !== 'default') {
      await ensureTenantCampaignTable(db);
      await db.prepare('DELETE FROM tenant_campaign_configs WHERE (tenant_id = ? OR TRIM(tenant_id) = ?1) AND trigger = ?').bind(tenantId, trigger).run();
      return c.json({ success: true, data: null });
    }

    try {
      await db.prepare(
        "DELETE FROM campaign_configs WHERE trigger = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(trigger, tenantId).run();
    } catch {
      if (tenantId === 'default') {
        await db.prepare('DELETE FROM campaign_configs WHERE trigger = ?').bind(trigger).run();
      }
    }
    return c.json({ success: true, data: null });
  });
}
