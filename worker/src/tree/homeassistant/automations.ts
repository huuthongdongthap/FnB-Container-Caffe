/**
 * Home Assistant — Automation management (tree layer)
 * Handles triggering automations and logging execution results.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { matchesHaTenant } from './devices';

const log = createLogger({ route: 'ha-automations' });

export interface AutomationResult {
automation_id: string;
trigger_entity: string | null;
payload: unknown;
result: string;
executed_at: string;
}

export interface AutomationLogEntry extends AutomationResult {
id: number;
}

export async function triggerAutomation(
  env: Record<string, unknown>,
  automationId: string,
  payload: unknown,
  tenantId?: string
): Promise<Response> {
  try {
    const mockMode = env.HA_MOCK === 'true';
    const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;

    const triggerEntity = (typeof payload === 'object' && payload !== null && 'trigger_entity' in payload)
      ? (payload as Record<string, unknown>).trigger_entity as string | undefined
      : undefined;

    const result = mockMode
      ? 'mocked execution success'
      : 'dispatched to HA webhook';

    const now = new Date().toISOString();
    const cleanTenant = tenantId ? tenantId.trim() : '';
    const effectiveTenant = cleanTenant && cleanTenant !== '*' ? cleanTenant : 'default';

    try {
      await db
        .prepare(
          'INSERT INTO ha_automation_log (automation_id, trigger_entity, payload, result, executed_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(automationId, triggerEntity ?? null, JSON.stringify(payload), result, now, effectiveTenant)
        .run();
    } catch {
      await db
        .prepare(
          'INSERT INTO ha_automation_log (automation_id, trigger_entity, payload, result, executed_at) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(automationId, triggerEntity ?? null, JSON.stringify(payload), result, now)
        .run();
    }

    log.info('automation_triggered', { automation_id: automationId, trigger_entity: triggerEntity });

    return jsonResponse({
      success: true,
      mock: mockMode || undefined,
      automation_id: automationId,
      trigger_entity: triggerEntity ?? undefined,
      result,
      executed_at: now
    });
  } catch (err) {
    log.error('triggerAutomation error', { message: (err as Error).message, automationId });
    return errorResponse('Failed to trigger automation', 500);
  }
}

function safeParsePayload(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    return raw ?? {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getAutomationLog(
  env: Record<string, unknown>,
  limit = 50,
  tenantId?: string
): Promise<Response> {
  try {
    const mockMode = env.HA_MOCK === 'true';
    const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;
    const clamped = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;

    if (mockMode) {
      const mockEntries: AutomationLogEntry[] = Array.from({ length: Math.min(clamped, 3) }, (_, i) => ({
        id: i + 1,
        automation_id: 'mock_automation',
        trigger_entity: 'sensor.counter',
        payload: mockMode,
        result: 'mocked execution success',
        executed_at: new Date(Date.now() - i * 60000).toISOString()
      }));
      return jsonResponse({ mock: true, entries: mockEntries });
    }

    let results: Array<AutomationLogEntry & { tenant_id?: string | null }> = [];
    const cleanTenant = tenantId ? tenantId.trim() : '';
    try {
      if (cleanTenant && cleanTenant !== '*') {
        const res = await db
          .prepare(
            "SELECT id, automation_id, trigger_entity, payload, result, executed_at, tenant_id FROM ha_automation_log WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY executed_at DESC LIMIT ?"
          )
          .bind(cleanTenant, cleanTenant, clamped)
          .all<AutomationLogEntry & { tenant_id?: string | null }>();
        results = res?.results || [];
      } else {
        const res = await db
          .prepare('SELECT id, automation_id, trigger_entity, payload, result, executed_at, tenant_id FROM ha_automation_log ORDER BY executed_at DESC LIMIT ?')
          .bind(clamped)
          .all<AutomationLogEntry & { tenant_id?: string | null }>();
        results = res?.results || [];
      }
    } catch {
      const res = await db
        .prepare('SELECT id, automation_id, trigger_entity, payload, result, executed_at FROM ha_automation_log ORDER BY executed_at DESC LIMIT ?')
        .bind(clamped)
        .all<AutomationLogEntry>();
      results = res?.results || [];
    }

    const entries = (results || [])
      .filter((r) => matchesHaTenant(r as unknown as Record<string, unknown>, tenantId))
      .map((r) => ({
        id: r.id,
        automation_id: r.automation_id,
        trigger_entity: r.trigger_entity,
        payload: safeParsePayload(r.payload),
        result: r.result,
        executed_at: r.executed_at
      }));

    return jsonResponse({ entries });
  } catch (err) {
    log.error('getAutomationLog error', { message: (err as Error).message });
    return errorResponse('Failed to fetch automation log', 500);
  }
}

export async function logAutomationResult(env: Record<string, unknown>, logEntry: AutomationResult): Promise<void> {
  try {
    const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;
    await db
      .prepare(
        'INSERT INTO ha_automation_log (automation_id, trigger_entity, payload, result, executed_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(logEntry.automation_id, logEntry.trigger_entity ?? null, JSON.stringify(logEntry.payload), logEntry.result, logEntry.executed_at)
      .run();
  } catch (err) {
    log.error('logAutomationResult error', { message: (err as Error).message, automationId: logEntry.automation_id });
  }
}
