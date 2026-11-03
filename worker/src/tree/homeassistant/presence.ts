/**
 * Home Assistant — Dining Presence Triggers (tree layer)
 * Coordinates IoT ambiance, lighting, and HVAC based on dining milestones.
 */

import { triggerAutomation } from './automations';
import { matchesTenantRow, resolvePilotStore } from '../../middleware/tenant';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'ha-presence' });

export type DiningPresenceEvent = 'customer_arrived' | 'table_occupied' | 'table_cleared';

export interface PresenceTriggerPayload {
  table_id?: string | number;
  table_number?: string;
  customer_id?: string;
  order_id?: string;
  guest_count?: number;
  [key: string]: unknown;
}

export async function dispatchDiningPresence(
  env: Record<string, unknown>,
  event: DiningPresenceEvent,
  payload: PresenceTriggerPayload = {},
  tenantId?: string
): Promise<{ success: boolean; event: DiningPresenceEvent; result: unknown }> {
  log.info('dispatch_dining_presence', { event, table: payload.table_id ?? payload.table_number });

  // Map dining event to HA automation ID & device context
  const automationId = `dining_${event}`;
  const triggerPayload = {
    event_type: event,
    ...payload,
    timestamp: new Date().toISOString()
  };

  const response = await triggerAutomation(env, automationId, triggerPayload, tenantId);
  const json = await response.json();

  return {
    success: response.status === 200,
    event,
    result: json
  };
}

export async function handleHAWebhook(
  env: Record<string, unknown>,
  body: Record<string, unknown>,
  tenantOverride?: string
): Promise<{ success: boolean; action_taken: string }> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) {
    throw new Error('D1 database binding missing');
  }

  const rawBodyTenant = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : '';
  const safeBodyTenant = rawBodyTenant && rawBodyTenant !== '*' ? rawBodyTenant : '';
  const cleanOverride = typeof tenantOverride === 'string' ? tenantOverride.trim() : '';
  const safeOverride = cleanOverride && cleanOverride !== '*' ? cleanOverride : '';
  const pilotTenant = resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]).trim();
  const effectiveTenant = safeOverride || safeBodyTenant || (pilotTenant && pilotTenant !== '*' ? pilotTenant : 'default');

  // 1. Device state update webhook from Home Assistant
  if (typeof body.entity_id === 'string' && typeof body.state === 'string') {
    const entityId = body.entity_id;
    const state = body.state;
    const attributes = body.attributes ? JSON.stringify(body.attributes) : '{}';
    const lastChanged = (body.last_changed as string) || new Date().toISOString();

    try {
      const existing = await db
        .prepare('SELECT tenant_id FROM ha_device_states WHERE entity_id = ?')
        .bind(entityId)
        .first<Record<string, unknown>>();
      if (existing && 'tenant_id' in existing && existing.tenant_id !== undefined && !matchesTenantRow(existing, effectiveTenant)) {
        return { success: false, action_taken: `cross_tenant_blocked:${entityId}` };
      }
    } catch {
      // Optional tenant_id column in minimal test schemas
    }

    if (effectiveTenant !== 'default') {
      try {
        await db
          .prepare(
            "INSERT OR REPLACE INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated, tenant_id) VALUES (?, ?, ?, ?, datetime('now'), ?)"
          )
          .bind(entityId, state, attributes, lastChanged, effectiveTenant)
          .run();
      } catch {
        await db
          .prepare(
            "INSERT OR REPLACE INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated) VALUES (?, ?, ?, ?, datetime('now'))"
          )
          .bind(entityId, state, attributes, lastChanged)
          .run();
      }
    } else {
      await db
        .prepare(
          "INSERT OR REPLACE INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated) VALUES (?, ?, ?, ?, datetime('now'))"
        )
        .bind(entityId, state, attributes, lastChanged)
        .run();
    }

    log.info('ha_webhook_device_updated', { entityId, state });
    return { success: true, action_taken: `device_updated:${entityId}` };
  }

  // 2. Automation event or execution feedback from Home Assistant
  if (typeof body.automation_id === 'string' || typeof body.event === 'string') {
    const automationId = (body.automation_id as string) || (body.event as string);
    const triggerEntity = (body.trigger_entity as string) || null;
    const result = (body.result as string) || 'feedback_received';
    const payload = body.payload ?? body;
    const serializedPayload = JSON.stringify(payload);

    try {
      await db
        .prepare(
          "INSERT INTO ha_automation_log (automation_id, trigger_entity, payload, result, executed_at, tenant_id) VALUES (?, ?, ?, ?, datetime('now'), ?)"
        )
        .bind(automationId, triggerEntity, serializedPayload, result, effectiveTenant)
        .run();
    } catch {
      await db
        .prepare(
          "INSERT INTO ha_automation_log (automation_id, trigger_entity, payload, result, executed_at) VALUES (?, ?, ?, ?, datetime('now'))"
        )
        .bind(automationId, triggerEntity, serializedPayload, result)
        .run();
    }

    log.info('ha_webhook_automation_logged', { automationId, result });
    return { success: true, action_taken: `automation_logged:${automationId}` };
  }

  log.info('ha_webhook_acknowledged_no_op', { keys: Object.keys(body) });
  return { success: true, action_taken: 'acknowledged' };
}
