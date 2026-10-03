/**
 * Container Edge Telemetry & Autonomous Watchdog Router
 * IoT heartbeat ingestion, thermal/power anomaly detection, and Telegram incident escalation.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { getTenantId } from '../middleware/tenant';
import { sendTelegramMessage } from '../lib/alerts/telegram';

export const containerTelemetryRouter = new Hono<{ Bindings: Env }>();

const heartbeatSchema = z.object({
  container_id: z.string().min(1).max(50),
  power_source: z.enum(['grid', 'battery', 'solar']).default('grid'),
  battery_percentage: z.number().min(0).max(100).optional(),
  ambient_temp_celsius: z.number().min(-10).max(70),
  kds_online: z.boolean().default(true),
  network_ping_ms: z.number().nonnegative().default(20)
});

// POST /api/edge/telemetry/heartbeat
containerTelemetryRouter.post('/telemetry/heartbeat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid telemetry data' }, 400);
  }

  const data = parsed.data;
  const tenantId = getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  // Autonomous Watchdog Rule Evaluation
  let alertStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
  const alertMessages: string[] = [];

  if (data.ambient_temp_celsius >= 38.0) {
    alertStatus = 'CRITICAL';
    alertMessages.push(`Nhiệt độ vượt ngưỡng: ${data.ambient_temp_celsius}°C (Nguy cơ hỏng sữa tươi/nguyên liệu)`);
  } else if (data.ambient_temp_celsius >= 33.0) {
    alertStatus = 'WARNING';
    alertMessages.push(`Nhiệt độ khoang pha chế cao: ${data.ambient_temp_celsius}°C`);
  }

  if (data.power_source === 'battery' && (data.battery_percentage ?? 100) <= 20) {
    alertStatus = 'CRITICAL';
    alertMessages.push(`Mất điện lưới! Pin dự phòng còn ${data.battery_percentage}%`);
  }

  if (!data.kds_online) {
    if (alertStatus !== 'CRITICAL') alertStatus = 'WARNING';
    alertMessages.push('Mất kết nối KDS màn hình bếp');
  }

  const alertMessage = alertMessages.length > 0 ? alertMessages.join(' | ') : null;

  // Telegram Alert Escalation on CRITICAL
  if (alertStatus === 'CRITICAL') {
    const tgToken = c.env.TELEGRAM_BOT_TOKEN;
    const tgChat = c.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChat) {
      const msg = `🚨 *[AURA CONTAINER WATCHDOG]*\n• Container: \`${data.container_id}\`\n• Trạng thái: *CRITICAL*\n• Cảnh báo: ${alertMessage}\n• Nguồn điện: ${data.power_source} (${data.battery_percentage ?? 'N/A'}%)\n• Nhiệt độ: ${data.ambient_temp_celsius}°C`;
      let ctx: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
      try { ctx = c.executionCtx as unknown as { waitUntil?: (p: Promise<unknown>) => void }; } catch { /* test environment without executionCtx */ }
      if (ctx?.waitUntil) {
        ctx.waitUntil(sendTelegramMessage(tgToken, tgChat, msg));
      } else {
        await sendTelegramMessage(tgToken, tgChat, msg);
      }
    }
  }

  const logId = `tel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await db.prepare(`
    INSERT INTO container_telemetry_logs (
      id, container_id, tenant_id, power_source, battery_percentage,
      ambient_temp_celsius, kds_online, network_ping_ms, alert_status, alert_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    logId, data.container_id, tenantId, data.power_source, data.battery_percentage ?? null,
    data.ambient_temp_celsius, data.kds_online ? 1 : 0, data.network_ping_ms, alertStatus, alertMessage
  ).run();

  return c.json({
    success: true,
    data: {
      log_id: logId,
      container_id: data.container_id,
      alert_status: alertStatus,
      alert_message: alertMessage
    }
  });
});

// GET /api/edge/containers/status
containerTelemetryRouter.get('/containers/status', requireAuth(['owner', 'manager']), async (c) => {
  const tenantId = c.req.query('tenant_id') || getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const { results: rawLogs } = await db.prepare(`
    SELECT t.*
    FROM container_telemetry_logs t
    INNER JOIN (
      SELECT container_id, MAX(created_at) as max_created
      FROM container_telemetry_logs
      WHERE tenant_id = ?
      GROUP BY container_id
    ) latest ON t.container_id = latest.container_id AND t.created_at = latest.max_created
  `).bind(tenantId).all<{
    id: string; container_id: string; power_source: string; battery_percentage: number | null;
    ambient_temp_celsius: number; kds_online: number; alert_status: string; alert_message: string | null; created_at: string;
  }>();

  const now = Date.now();
  const containers = (rawLogs || []).map((row) => {
    const logTime = new Date(row.created_at).getTime();
    const minutesAgo = Math.round((now - logTime) / (60 * 1000));
    const isOffline = minutesAgo > 15;

    return {
      container_id: row.container_id,
      operational_status: isOffline ? 'OFFLINE' : row.alert_status,
      power_source: row.power_source,
      battery_percentage: row.battery_percentage,
      ambient_temp_celsius: row.ambient_temp_celsius,
      kds_online: Boolean(row.kds_online),
      alert_message: isOffline ? `Không có tín hiệu trong ${minutesAgo} phút` : row.alert_message,
      last_heartbeat: row.created_at,
      minutes_since_heartbeat: minutesAgo
    };
  });

  return c.json({ success: true, count: containers.length, data: containers });
});

// GET /api/edge/containers/:id/history
containerTelemetryRouter.get('/containers/:id/history', requireAuth(['owner', 'manager']), async (c) => {
  const containerId = c.req.param('id');
  const tenantId = c.req.query('tenant_id') || getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const { results } = await db.prepare(
    'SELECT * FROM container_telemetry_logs WHERE container_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(containerId, tenantId).all();

  return c.json({ success: true, container_id: containerId, data: results || [] });
});
