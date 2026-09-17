import type { Context } from 'hono';
import type { Env } from '../../types/env';

export function formatTable(row: Record<string, any>) {
  return {
    ...row,
    zone: row.zone_id ? { id: row.zone_id, name: row.zone_name } : null,
    position: { x: row.position_x, y: row.position_y },
    dimensions: { width: row.width, height: row.height, rotation: row.rotation },
    capacity: row.capacity,
    isActive: Boolean(row.is_active),
    location: row.location_id ? { id: row.location_id } : null,
    currentSession: row.current_session_id ? { id: row.current_session_id } : null,
  };
}

export function formatZone(row: Record<string, any>) {
  return {
    ...row,
    location: row.location_id ? { id: row.location_id } : null,
    isActive: Boolean(row.is_active),
    tables: [], // Would be populated separately if needed
  };
}