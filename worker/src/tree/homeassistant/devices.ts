/**
 * Home Assistant — Device state management (tree layer)
 * Handles device state caching, toggling, and zone queries.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'ha-devices' });

export interface DeviceState {
entity_id: string;
state: string;
attributes: Record<string, unknown> | null;
last_changed: string;
last_updated: string;
}

export interface ToggleResult {
entity_id: string;
state: string;
attributes: Record<string, unknown> | null;
}

const ZONE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export function matchesHaTenant(
  row: Record<string, unknown> | null | undefined,
  tenantId?: string
): boolean {
  if (!row) return false;
  if (!tenantId || tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === tenantId;
  }
  return tenantId === 'default';
}

export async function getDeviceState(
  env: Record<string, unknown>,
  entityId: string,
  tenantId?: string
): Promise<Response> {
  try {
    const mockMode = env.HA_MOCK === 'true';
    const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;

    if (mockMode) {
      return jsonResponse({
        mock: true,
        device: {
          entity_id: entityId,
          state: 'unknown',
          attributes: null,
          last_changed: '',
          last_updated: ''
        }
      });
    }

    let row: (DeviceState & { tenant_id?: string | null }) | null = null;
    try {
      row = await db
        .prepare('SELECT entity_id, state, attributes, last_changed, last_updated, tenant_id FROM ha_device_states WHERE entity_id = ?')
        .bind(entityId)
        .first<DeviceState & { tenant_id?: string | null }>();
    } catch {
      row = await db
        .prepare('SELECT entity_id, state, attributes, last_changed, last_updated FROM ha_device_states WHERE entity_id = ?')
        .bind(entityId)
        .first<DeviceState>();
    }

    if (!row || !matchesHaTenant(row as unknown as Record<string, unknown>, tenantId)) {
      return errorResponse('Device not found', 404);
    }

    const device: DeviceState = {
      entity_id: row.entity_id,
      state: row.state,
      attributes: row.attributes ? JSON.parse(row.attributes as unknown as string) : null,
      last_changed: row.last_changed,
      last_updated: row.last_updated
    };

    return jsonResponse({ device });
  } catch (err) {
    log.error('getDeviceState error', { message: (err as Error).message, entityId });
    return errorResponse('Failed to fetch device state', 500);
  }
}

export async function toggleDevice(
  env: Record<string, unknown>,
  entityId: string,
  on: boolean,
  tenantId?: string
): Promise<Response> {
  try {
    const mockMode = env.HA_MOCK === 'true';
    const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;
    const newState = on ? 'on' : 'off';

    if (mockMode) {
      return jsonResponse({
        mock: true,
        result: {
          entity_id: entityId,
          state: newState,
          attributes: null
        } satisfies ToggleResult
      });
    }

    let existing: { entity_id: string; state: string; attributes: string | null; tenant_id?: string | null } | null = null;
    try {
      existing = await db
        .prepare('SELECT entity_id, state, attributes, last_changed, last_updated, tenant_id FROM ha_device_states WHERE entity_id = ?')
        .bind(entityId)
        .first<{ entity_id: string; state: string; attributes: string | null; tenant_id?: string | null }>();
    } catch {
      existing = await db
        .prepare('SELECT entity_id, state, attributes, last_changed, last_updated FROM ha_device_states WHERE entity_id = ?')
        .bind(entityId)
        .first<{ entity_id: string; state: string; attributes: string | null }>();
    }

    if (!existing || !matchesHaTenant(existing as unknown as Record<string, unknown>, tenantId)) {
      return errorResponse('Device not found', 404);
    }

    if ('tenant_id' in existing && existing.tenant_id !== undefined && tenantId && tenantId !== '*') {
      await db
        .prepare("UPDATE ha_device_states SET state = ?, last_updated = datetime('now') WHERE entity_id = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?")
        .bind(newState, entityId, tenantId)
        .run();
    } else {
      await db
        .prepare("UPDATE ha_device_states SET state = ?, last_updated = datetime('now') WHERE entity_id = ?")
        .bind(newState, entityId)
        .run();
    }

    const result: ToggleResult = {
      entity_id: existing.entity_id,
      state: newState,
      attributes: existing.attributes ? JSON.parse(existing.attributes as unknown as string) : null
    };

    return jsonResponse({ result });
  } catch (err) {
    log.error('toggleDevice error', { message: (err as Error).message, entityId, on });
    return errorResponse('Failed to toggle device', 500);
  }
}

export async function getZoneDevices(
  env: Record<string, unknown>,
  zone: string,
  tenantId?: string
): Promise<Response> {
  try {
    if (!ZONE_ID_REGEX.test(zone)) {
      return errorResponse('Invalid zone identifier', 400);
    }
    const mockMode = env.HA_MOCK === 'true';
    const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;

    if (mockMode) {
      return jsonResponse({ mock: true, zone, devices: [] });
    }

    const likePattern = `%.${zone}%`;

    let results: Array<DeviceState & { tenant_id?: string | null }> = [];
    try {
      const res = await db
        .prepare('SELECT entity_id, state, attributes, last_changed, last_updated, tenant_id FROM ha_device_states WHERE entity_id LIKE ?')
        .bind(likePattern)
        .all<DeviceState & { tenant_id?: string | null }>();
      results = res.results || [];
    } catch {
      const res = await db
        .prepare('SELECT entity_id, state, attributes, last_changed, last_updated FROM ha_device_states WHERE entity_id LIKE ?')
        .bind(likePattern)
        .all<DeviceState>();
      results = res.results || [];
    }

    const devices = (results || [])
      .filter((r) => matchesHaTenant(r as unknown as Record<string, unknown>, tenantId))
      .map((r) => ({
        entity_id: r.entity_id,
        state: r.state,
        attributes: r.attributes ? JSON.parse((r.attributes as unknown) as string) : null,
        last_changed: r.last_changed,
        last_updated: r.last_updated
      }));

    return jsonResponse({ zone, devices });
  } catch (err) {
    log.error('getZoneDevices error', { message: (err as Error).message, zone });
    return errorResponse('Failed to fetch zone devices', 500);
  }
}

export async function cacheDeviceState(env: Record<string, unknown>, device: DeviceState, tenantId?: string): Promise<void> {
  try {
    const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database;
    const effectiveTenant = tenantId && tenantId !== '*' && tenantId.trim() ? tenantId.trim() : null;
    if (effectiveTenant) {
      try {
        await db
          .prepare(
            "INSERT OR REPLACE INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated, tenant_id) VALUES (?, ?, ?, ?, datetime('now'), ?)"
          )
          .bind(
            device.entity_id,
            device.state,
            JSON.stringify(device.attributes ?? {}),
            device.last_changed,
            effectiveTenant
          )
          .run();
        return;
      } catch {
        // Fallback when tenant_id column is absent
      }
    }
    await db
      .prepare(
        "INSERT OR REPLACE INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated) VALUES (?, ?, ?, ?, datetime('now'))"
      )
      .bind(
        device.entity_id,
        device.state,
        JSON.stringify(device.attributes ?? {}),
        device.last_changed
      )
      .run();
  } catch (err) {
    log.error('cacheDeviceState error', { message: (err as Error).message, entity_id: device.entity_id });
  }
}
