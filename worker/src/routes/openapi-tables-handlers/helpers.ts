
export function formatTable(row: Record<string, any>) {
  const zoneId = row.zone_id ?? row.zone ?? null;
  const zoneName = row.zone_name ?? row.zone ?? null;
  return {
    ...row,
    code: row.code ?? (row.table_number !== undefined ? String(row.table_number) : row.id),
    zone: zoneId ? { id: zoneId, name: zoneName } : null,
    position: { x: row.position_x ?? 0, y: row.position_y ?? 0 },
    dimensions: { width: row.width ?? 80, height: row.height ?? 80, rotation: row.rotation ?? 0 },
    capacity: row.capacity,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
    location: row.location_id ? { id: row.location_id } : null,
    currentSession: row.current_session_id ? { id: row.current_session_id } : null,
  };
}

export function formatZone(row: Record<string, any>) {
  return {
    ...row,
    location: row.location_id ? { id: row.location_id } : null,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
    tables: [], // Would be populated separately if needed
  };
}

export async function writeTableAuditLog(
  db: any,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: string,
  now: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, userId, action, entityType, entityId, metadata, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, metadata, metadata, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, userId, action, entityType, entityId, metadata, now).run().catch(() => {});
      } catch {
        // Ignore audit log error
      }
    }
  }
}
