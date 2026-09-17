import type { Hono } from 'hono';
import type { CampaignTrigger, CampaignChannel } from '@aura/domain-crm';
import { campaignConfigSchema, zodErrorResponse } from '../../lib/validators';
import type { Env } from '../../types/env';
import {
  ALL_TRIGGERS,
  ALL_CHANNELS,
  TRIGGER_META,
  type CampaignConfig
} from './constants';

export function registerCampaignConfigHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/campaigns — list all campaign configs with defaults for missing entries
  router.get('/', async (c) => {
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
  router.get('/:trigger', async (c) => {
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
  router.put('/:trigger', async (c) => {
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
      const parsedChannels = typeof body.channels === 'string' ? JSON.parse(body.channels) : body.channels;
      const valid = (parsedChannels as string[]).filter((ch) => ALL_CHANNELS.includes(ch as CampaignChannel));
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

  // DELETE /api/campaigns/:trigger — delete config (reset to defaults)
  router.delete('/:trigger', async (c) => {
    const db = c.env.AURA_DB;
    const trigger = c.req.param('trigger') as CampaignTrigger;

    if (!ALL_TRIGGERS.includes(trigger)) {
      return c.json({ success: false, error: 'Loai chien dich khong hop le' }, 400);
    }

    await db.prepare('DELETE FROM campaign_configs WHERE trigger = ?').bind(trigger).run();

    return c.json({ success: true, data: null });
  });
}
