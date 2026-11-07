/**
 * Auth domain helpers
 * Extracted from openapi-auth.ts for modularization
 */

import {
  hashPassword as hashPasswordPBKDF2,
  verifyPassword as verifyPasswordPBKDF2,
} from '../../lib/jwt';

export async function hashPassword(password: string): Promise<string> {
  return hashPasswordPBKDF2(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return verifyPasswordPBKDF2(password, hash);
}

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

export async function writeAuthAuditLog(
  db: any,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: string,
  now: string,
  tenantId: string = 'default'
): Promise<void> {
  const writeTenant = (tenantId && tenantId.trim() && tenantId.trim() !== '*') ? tenantId.trim() : 'default';
  let enrichedMeta = metadata;
  if (entityType !== 'staff_device') {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.tenant_id === undefined) {
        enrichedMeta = JSON.stringify({ ...parsed, tenant_id: writeTenant });
      }
    } catch { /* non-JSON metadata */ }
  }
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${crypto.randomUUID()}`, userId, action, entityType, entityId, enrichedMeta, writeTenant, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, writeTenant, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(`audit_${crypto.randomUUID()}`, userId, action, entityType, entityId, enrichedMeta, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, userId, userId, action, entityType, entityId, entityType, entityId, enrichedMeta, enrichedMeta, now).run();
        } catch {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, userId, action, entityType, entityId, enrichedMeta, now).run().catch(() => {});
        }
      }
    }
  }
  await db
    .prepare('UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = ? AND created_at = ?')
    .bind(writeTenant, entityId, entityId, action, now)
    .run()
    .catch(() => {});
}
