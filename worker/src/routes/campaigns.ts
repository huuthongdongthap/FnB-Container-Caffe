/**
 * Campaigns Routes — /api/campaigns
 * Admin CRUD for automated marketing campaign configs + stats.
 */
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { campaignConfigSchema, zodErrorResponse } from '../lib/validators';

type CampaignTrigger = 'welcome' | 'birthday' | 'winback' | 'post_visit' | 'cashback_expiry';
type CampaignChannel = 'sms' | 'email' | 'zalo';

const ALL_TRIGGERS: CampaignTrigger[] = [
  'welcome',
  'birthday',
  'winback',
  'post_visit',
  'cashback_expiry'
];

const ALL_CHANNELS: CampaignChannel[] = ['sms', 'email', 'zalo'];

interface CampaignConfig {
  trigger: CampaignTrigger;
  is_active: number;
  channels: string; // JSON array
  timing: string | null;
  updated_at: string | null;
}

interface TriggerMeta {
  label: string;
  label_vn: string;
  description: string;
  default_channels: string[];
  timing_hint: string;
}

const TRIGGER_META: Record<CampaignTrigger, TriggerMeta> = {
  welcome: {
    label: 'Welcome',
    label_vn: 'Chao mung',
    description: 'Gui tin nhan chao mung khach hang moi trong 24h',
    default_channels: ['sms', 'email'],
    timing_hint: 'Moi 15 phut'
  },
  birthday: {
    label: 'Birthday',
    label_vn: 'Sinh nhat',
    description: 'Gui uu dai sinh nhat cho khach hang',
    default_channels: ['sms', 'zalo'],
    timing_hint: 'Hang ngay'
  },
  winback: {
    label: 'Winback',
    label_vn: 'Tai kich hoat',
    description: 'Gui tin nhan cho khach hang khong quay lai 30 ngay',
    default_channels: ['sms'],
    timing_hint: 'Hang ngay'
  },
  post_visit: {
    label: 'Post-Visit',
    label_vn: 'Sau khi ghe',
    description: 'Gui yeu cau danh gia sau khi khach hang ghe quan',
    default_channels: ['sms'],
    timing_hint: 'Moi 30 phut'
  },
  cashback_expiry: {
    label: 'Cashback Expiry',
    label_vn: 'Cashback sap het han',
    description: 'Nhan nhac cashback sap het han truoc 7 ngay',
    default_channels: ['sms'],
    timing_hint: 'Hang ngay'
  }
};

export const campaignsRouter = new Hono<{ Bindings: Env }>();

// All routes require auth
campaignsRouter.use('/*', requireAuth(['owner', 'staff']));

// GET /api/campaigns — list all campaign configs with defaults for missing entries
campaignsRouter.get('/', async(c) => {
  const db = c.env.AURA_DB;

  // Ensure all triggers have a config row
  const { results: existing } = await db.prepare(
    'SELECT * FROM campaign_configs ORDER BY trigger'
  ).all<CampaignConfig>();

  const existingMap = new Map(existing.map((r) => [r.trigger, r]));

  // Upsert missing triggers
  const now = new Date().toISOString();
  for (const trigger of ALL_TRIGGERS) {
    if (!existingMap.has(trigger)) {
      const meta = TRIGGER_META[trigger];
      await db.prepare(
        `INSERT OR IGNORE INTO campaign_configs (trigger, is_active, channels, timing, updated_at)
         VALUES (?, 1, ?, ?, ?)`
      ).bind(
        trigger,
        JSON.stringify(meta.default_channels),
        meta.timing_hint,
        now
      ).run();
    }
  }

  // Re-fetch
  const { results: all } = await db.prepare(
    'SELECT * FROM campaign_configs ORDER BY trigger'
  ).all<CampaignConfig>();

  const enriched = all.map((row) => ({
    ...row,
    channels: JSON.parse(row.channels) as CampaignChannel[],
    meta: TRIGGER_META[row.trigger as CampaignTrigger] || null
  }));

  return c.json({ success: true, data: enriched });
});

// GET /api/campaigns/:trigger — single config
campaignsRouter.get('/:trigger', async(c) => {
  const db = c.env.AURA_DB;
  const trigger = c.req.param('trigger') as CampaignTrigger;

  const row = await db.prepare(
    'SELECT * FROM campaign_configs WHERE trigger = ?'
  ).bind(trigger).first<CampaignConfig>();

  if (!row) {
    return c.json({ success: false, error: 'Khong tim thay chien dich' }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...row,
      channels: JSON.parse(row.channels),
      meta: TRIGGER_META[trigger] || null
    }
  });
});

// PUT /api/campaigns/:trigger — update config
campaignsRouter.put('/:trigger', async(c) => {
  const db = c.env.AURA_DB;
  const trigger = c.req.param('trigger') as CampaignTrigger;

  if (!ALL_TRIGGERS.includes(trigger)) {
    return c.json({ success: false, error: 'Loai chien dich khong hop le' }, 400);
  }

  const raw = await c.req.json();
  const parsed = campaignConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const body = parsed.data;
  const existing = await db.prepare(
    'SELECT * FROM campaign_configs WHERE trigger = ?'
  ).bind(trigger).first<CampaignConfig>();

  if (!existing) {
    return c.json({ success: false, error: 'Khong tim thay chien dich' }, 404);
  }

  const isActive = body.is_active !== undefined ? body.is_active : existing.is_active;
  let channels = existing.channels;
  if (body.channels) {
    const parsed = typeof body.channels === 'string' ? JSON.parse(body.channels) : body.channels;
    const valid = (parsed as string[]).filter((ch) => ALL_CHANNELS.includes(ch as CampaignChannel));
    channels = JSON.stringify(valid.length ? valid : ['sms']);
  }

  await db.prepare(
    'UPDATE campaign_configs SET is_active = ?, channels = ?, updated_at = ? WHERE trigger = ?'
  ).bind(isActive, channels, new Date().toISOString(), trigger).run();

  const updated = await db.prepare(
    'SELECT * FROM campaign_configs WHERE trigger = ?'
  ).bind(trigger).first<CampaignConfig>();

  return c.json({
    success: true,
    data: {
      ...updated,
      channels: JSON.parse(updated!.channels),
      meta: TRIGGER_META[trigger]
    }
  });
});

// GET /api/campaigns/stats — aggregate stats from campaign_logs
campaignsRouter.get('/stats/all', async(c) => {
  const db = c.env.AURA_DB;

  const { results } = await db.prepare(`
    SELECT
      trigger,
      COUNT(*) as total_sent,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success_count,
      MAX(sent_at) as last_run_at,
      COUNT(DISTINCT customer_id) as unique_customers
    FROM campaign_logs
    GROUP BY trigger
    ORDER BY trigger
  `).all<{
    trigger: string;
    total_sent: number;
    success_count: number;
    last_run_at: string | null;
    unique_customers: number;
  }>();

  const stats: Record<string, {
    total_sent: number;
    success_count: number;
    success_rate: number;
    last_run_at: string | null;
    unique_customers: number;
  }> = {};

  for (const trigger of ALL_TRIGGERS) {
    const row = results.find((r) => r.trigger === trigger);
    stats[trigger] = row
      ? {
        total_sent: row.total_sent,
        success_count: row.success_count,
        success_rate: row.total_sent > 0
          ? Math.round((row.success_count / row.total_sent) * 100)
          : 0,
        last_run_at: row.last_run_at,
        unique_customers: row.unique_customers
      }
      : {
        total_sent: 0,
        success_count: 0,
        success_rate: 0,
        last_run_at: null,
        unique_customers: 0
      };
  }

  return c.json({ success: true, data: stats });
});

// DELETE /api/campaigns/:trigger — delete config (reset to defaults)
campaignsRouter.delete('/:trigger', async(c) => {
  const db = c.env.AURA_DB;
  const trigger = c.req.param('trigger') as CampaignTrigger;

  if (!ALL_TRIGGERS.includes(trigger)) {
    return c.json({ success: false, error: 'Loai chien dich khong hop le' }, 400);
  }

  await db.prepare('DELETE FROM campaign_configs WHERE trigger = ?').bind(trigger).run();

  return c.json({ success: true, data: null });
});

export { ALL_TRIGGERS, ALL_CHANNELS, TRIGGER_META };
export type { CampaignTrigger, CampaignChannel, CampaignConfig };
