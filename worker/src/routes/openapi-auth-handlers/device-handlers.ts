import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { createLogger } from '../../middleware/logger';
import type { Env } from '../../types/env';
import { AuthRoutes } from '../../schemas/auth';
import { hashPassword, verifyPassword } from './helpers';

export function registerDeviceHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/auth/reset-password - Request password reset
  app.openapi(AuthRoutes.resetPassword, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(body.email).first();
    if (!user) {
      return c.json({ success: true, data: { success: true } });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db.prepare(
      `INSERT INTO email_verifications (id, email, code, type, expires_at, used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), body.email, code, 'password_reset', expiresAt, 0, now).run();

    const log = createLogger({ route: 'auth.reset-password' });
    log.info('password_reset_code_generated', { email: body.email, code });

    return c.json({ success: true, data: { success: true } });
  });

  // POST /api/auth/change-password - Change password
  app.openapi(AuthRoutes.changePassword, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const userRecord = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
    if (!userRecord || !await verifyPassword(body.currentPassword, userRecord.password_hash)) {
      return c.json({ success: false, error: 'Invalid current password' }, 401);
    }

    const passwordHash = await hashPassword(body.newPassword);
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(passwordHash, now, user.id).run();
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').bind(now, user.id).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'change_password', 'user', user.id, JSON.stringify({}), now).run();

    return c.json({ success: true, data: { success: true } });
  });

  // GET /api/auth/devices - List trusted devices
  app.openapi(AuthRoutes.trustedDevices.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');

    const devices = await db.prepare(
      `SELECT id, fingerprint, name, platform, browser, ip, is_trusted, last_used_at, created_at, expires_at
       FROM trusted_devices WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(user.id).all();

    return c.json({
      success: true,
      data: devices.results.map(d => ({
        ...d,
        isTrusted: d.is_trusted === 1,
        platform: d.platform,
        browser: d.browser,
        lastUsedAt: d.last_used_at,
        createdAt: d.created_at,
        expiresAt: d.expires_at,
      })),
    });
  });

  // DELETE /api/auth/devices/{id} - Revoke trusted device
  app.openapi(AuthRoutes.trustedDevices.revoke, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const now = new Date().toISOString();

    const device = await db.prepare('SELECT * FROM trusted_devices WHERE id = ? AND user_id = ?').bind(id, user.id).first();
    if (!device) {
      return c.json({ success: false, error: 'Device not found' }, 404);
    }

    await db.prepare('DELETE FROM trusted_devices WHERE id = ?').bind(id).run();
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ? AND device_fingerprint = ?').bind(now, user.id, device.fingerprint).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'revoke_device', 'trusted_device', id, JSON.stringify({ name: device.name }), now).run();

    return c.json({ success: true, data: { success: true } });
  });

  // DELETE /api/auth/devices - Revoke all trusted devices
  app.openapi(AuthRoutes.trustedDevices.revokeAll, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const user = c.get('user');
    const now = new Date().toISOString();

    await db.prepare('DELETE FROM trusted_devices WHERE user_id = ?').bind(user.id).run();
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').bind(now, user.id).run();

    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'revoke_all_devices', 'trusted_device', user.id, JSON.stringify({}), now).run();

    return c.json({ success: true, data: { success: true } });
  });
}
