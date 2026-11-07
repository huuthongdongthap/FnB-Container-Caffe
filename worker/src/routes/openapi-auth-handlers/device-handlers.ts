import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { getAuthToken, verifyJWT } from '../../lib/jwt';
import { toUser } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin, resolvePublicTenantId } from '../../middleware/tenant';
import { AuthRoutes } from '../../schemas/auth';
import { writeAuthAuditLog } from './helpers';
import { registerPasswordHandlers } from './password-handlers';

async function resolveDeviceUser(c: any): Promise<any> {
  const existing = c.get('user');
  if (existing) return existing;
  const token = getAuthToken(c.req?.raw);
  if (token && c.env?.JWT_SECRET) {
    const payload = await verifyJWT(token, c.env.JWT_SECRET).catch(() => null);
    if (payload) {
      const resolved = toUser(payload as any);
      c.set('user', resolved);
      return resolved;
    }
  }
  return undefined;
}

function verifyDeviceCallerTenant(c: any, user: any): { ok: true; tenantId: string } | { ok: false } {
  const userTenant = String(user?.tenantId || user?.tenant_id || '').trim();
  const resolvedTenant = String(getTenantId(c) || userTenant || 'default').trim() || 'default';
  const headerOverride = String(
    c.req?.query?.('tenant_id') ||
      c.req?.query?.('tenantId') ||
      c.req?.query?.('store_id') ||
      c.req?.query?.('storeId') ||
      c.req?.header?.('X-Tenant-ID') ||
      c.req?.header?.('x-tenant-id') ||
      c.req?.header?.('X-Store-ID') ||
      c.req?.header?.('x-store-id') ||
      ''
  ).trim();
  if (!isHQSuperAdmin(user)) {
    const effectiveUserTenant = userTenant || resolvedTenant;
    if (
      effectiveUserTenant === '*' ||
      effectiveUserTenant.toLowerCase() === 'hq' ||
      headerOverride === '*' ||
      headerOverride.toLowerCase() === 'hq' ||
      (headerOverride && headerOverride !== effectiveUserTenant) ||
      (userTenant && resolvedTenant !== userTenant)
    ) {
      return { ok: false };
    }
    return { ok: true, tenantId: effectiveUserTenant };
  }
  const normalizedOverride = headerOverride.toLowerCase() === 'hq' ? '*' : headerOverride;
  const normalizedResolved = resolvedTenant.toLowerCase() === 'hq' ? '*' : resolvedTenant;
  const effectiveHqTenant = normalizedOverride || normalizedResolved;
  const fallbackUserTenant = !userTenant || userTenant === '*' || userTenant.toLowerCase() === 'hq' ? 'default' : userTenant;
  return { ok: true, tenantId: effectiveHqTenant === '*' ? fallbackUserTenant : effectiveHqTenant };
}

export function registerDeviceHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  registerPasswordHandlers(app);

  // GET /api/auth/devices - List trusted devices
  app.openapi(AuthRoutes.trustedDevices.list as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const user = await resolveDeviceUser(c);
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const tenantCheck = verifyDeviceCallerTenant(c, user);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant device access denied' }, 403);
    }
    const tenantId = tenantCheck.tenantId;

    let devices: { results: any[] } = { results: [] };
    try {
      devices = await db.prepare(
        `SELECT id, fingerprint, name, platform, browser, ip, is_trusted, last_used_at, created_at, expires_at
         FROM trusted_devices
         WHERE user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         ORDER BY created_at DESC`
      ).bind(user.id, tenantId).all();
    } catch {
      if (tenantId === 'default') {
        try {
          devices = await db.prepare(
            `SELECT id, fingerprint, name, platform, browser, ip, is_trusted, last_used_at, created_at, expires_at
             FROM trusted_devices WHERE user_id = ? ORDER BY created_at DESC`
          ).bind(user.id).all();
        } catch {
          devices = { results: [] };
        }
      } else {
        devices = { results: [] };
      }
    }

    const mapped = (devices.results || []).map((d: any) => ({
      ...d,
      isTrusted: d.is_trusted === 1,
      platform: d.platform,
      browser: d.browser,
      lastUsedAt: d.last_used_at,
      createdAt: d.created_at,
      expiresAt: d.expires_at,
    }));

    if (user?.role && user.role !== 'customer') {
      let staffRows: any[] = [];
      try {
        const res = await db.prepare(
          `SELECT id, substr(device_token, -4) AS device_fingerprint, device_name, role, COALESCE(is_active, 1) AS is_active, last_login_at, created_at, updated_at
           FROM staff_devices
           WHERE staff_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
           ORDER BY created_at DESC`
        ).bind(user.id, tenantId).all();
        staffRows = res.results || [];
      } catch {
        try {
          const res = await db.prepare(
            `SELECT sd.id, substr(sd.device_token, -4) AS device_fingerprint, sd.device_token AS raw_device_token, sd.device_name, sd.role, sd.last_login_at, sd.created_at, sd.updated_at
             FROM staff_devices sd
             JOIN users u ON u.id = sd.staff_id
             WHERE sd.staff_id = ? AND COALESCE(NULLIF(TRIM(u.tenant_id), ''), 'default') = ?
             ORDER BY sd.created_at DESC`
          ).bind(user.id, tenantId).all();
          staffRows = res.results || [];
        } catch {
          if (tenantId === 'default') {
            try {
              const res = await db.prepare(
                `SELECT id, substr(device_token, -4) AS device_fingerprint, device_token AS raw_device_token, device_name, role, last_login_at, created_at, updated_at
                 FROM staff_devices WHERE staff_id = ? ORDER BY created_at DESC`
              ).bind(user.id).all();
              staffRows = res.results || [];
            } catch {
              staffRows = [];
            }
          } else {
            staffRows = [];
          }
        }
      }
      const seenIds = new Set(mapped.map((d: any) => String(d.id)));
      for (const sd of staffRows) {
        if (seenIds.has(String(sd.id))) continue;
        const rawFp = sd.device_fingerprint ?? sd.device_token;
        const maskedFingerprint = rawFp
          ? (String(rawFp).startsWith('***') ? String(rawFp) : `***${String(rawFp).slice(-4)}`)
          : `***${String(sd.id).slice(-4)}`;
        const displayFingerprint = sd.raw_device_token ? String(sd.raw_device_token) : maskedFingerprint;
        mapped.push({
          id: sd.id,
          fingerprint: displayFingerprint,
          name: sd.device_name || sd.id,
          platform: 'mobile',
          browser: null,
          ip: null,
          isTrusted: Number(sd.is_active ?? 1) === 1,
          lastUsedAt: sd.last_login_at || sd.updated_at || sd.created_at || null,
          createdAt: sd.created_at || null,
          expiresAt: null,
        });
      }
    }

    return c.json({
      success: true,
      data: mapped,
    });
  });

  // DELETE /api/auth/devices/{id} - Revoke trusted device
  app.openapi(AuthRoutes.trustedDevices.revoke as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const user = await resolveDeviceUser(c);
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const tenantCheck = verifyDeviceCallerTenant(c, user);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant device access denied' }, 403);
    }
    const tenantId = tenantCheck.tenantId;
    const { id } = c.req.valid('param');
    const now = new Date().toISOString();

    let device: any = null;
    try {
      device = await db
        .prepare(
          `SELECT * FROM trusted_devices WHERE id = ? AND user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        )
        .bind(id, user.id, tenantId)
        .first();
    } catch {
      if (tenantId === 'default') {
        device = await db.prepare('SELECT * FROM trusted_devices WHERE id = ? AND user_id = ?').bind(id, user.id).first().catch(() => null);
      } else {
        device = null;
      }
    }
    if (!device && user.role !== 'customer') {
      let staffDevice: any = null;
      try {
        staffDevice = await db
          .prepare(
            `SELECT id, device_name, COALESCE(is_active, 1) AS active FROM staff_devices
             WHERE (id = ? OR device_token = ?) AND staff_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          )
          .bind(id, id, user.id, tenantId)
          .first();
      } catch {
        if (tenantId === 'default') {
          staffDevice = await db
            .prepare('SELECT id, device_name FROM staff_devices WHERE (id = ? OR device_token = ?) AND staff_id = ?')
            .bind(id, id, user.id)
            .first()
            .catch(() => null);
        }
      }
      if (staffDevice) {
        const deviceTenant = tenantId || String(user?.tenantId || user?.tenant_id || resolvePublicTenantId(c) || 'default').trim() || 'default';
        await db.batch([
          db.prepare('DELETE FROM staff_devices WHERE id = ? AND staff_id = ?').bind(staffDevice.id, user.id),
          db.prepare('UPDATE users SET auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?').bind(now, user.id),
        ]);
        await writeAuthAuditLog(
          db,
          user.id,
          'revoke_device',
          'staff_device',
          String(staffDevice.id),
          JSON.stringify({ device_name: staffDevice.device_name, active: staffDevice.active ?? staffDevice.is_active ?? 1 }),
          now,
          deviceTenant
        );
        return c.json({ success: true, data: { success: true } });
      }
    }
    if (!device) {
      return c.json({ success: false, error: 'Device not found' }, 404);
    }

    try {
      await db
        .prepare("DELETE FROM trusted_devices WHERE id = ? AND user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(id, user.id, tenantId)
        .run();
    } catch {
      if (tenantId === 'default') {
        await db.prepare('DELETE FROM trusted_devices WHERE id = ?').bind(id).run().catch(() => {});
      }
    }
    try {
      await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ? AND device_fingerprint = ?').bind(now, user.id, device.fingerprint).run();
    } catch {
      // Sessions table may be absent when using KV-backed tokens
    }
    if (user.role === 'customer') {
      let dbNextVer = Number(user.authVersion ?? user.auth_version ?? 1) + 1;
      try {
        const currentRow = (await db.prepare('SELECT auth_version FROM users WHERE id = ?').bind(user.id).first().catch(() => null)) as { auth_version?: number } | null;
        if (currentRow && Number.isFinite(Number(currentRow.auth_version))) {
          dbNextVer = Math.max(dbNextVer, Number(currentRow.auth_version) + 1);
        }
        await db.prepare('UPDATE users SET auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?').bind(now, user.id).run().catch(() => {});
      } catch {
        // Non-blocking on minimal schemas without users.auth_version
      }
      if (c.env.AUTH_KV) {
        try {
          let nextVersion = dbNextVer;
          if (user.email) {
            const rawUser = await c.env.AUTH_KV.get(`user:${user.email}`);
            if (rawUser) {
              const parsed = JSON.parse(rawUser) as Record<string, unknown>;
              const currentVer = Number(parsed.auth_version || 1);
              nextVersion = Math.max(nextVersion, currentVer + 1);
              parsed.auth_version = nextVersion;
              parsed.updated_at = now;
              await c.env.AUTH_KV.put(`user:${user.email}`, JSON.stringify(parsed));
            }
          }
          if (user.id) {
            const rawCustVer = await c.env.AUTH_KV.get(`cust_auth_ver:${user.id}`);
            if (rawCustVer) {
              const currentCustVer = Number(rawCustVer);
              if (Number.isFinite(currentCustVer) && currentCustVer >= nextVersion) {
                nextVersion = currentCustVer + 1;
              }
            }
            await c.env.AUTH_KV.put(`cust_auth_ver:${user.id}`, String(nextVersion));
            const rawUserById = await c.env.AUTH_KV.get(`user:${user.id}`);
            if (rawUserById) {
              const parsedById = JSON.parse(rawUserById) as Record<string, unknown>;
              parsedById.auth_version = nextVersion;
              parsedById.updated_at = now;
              await c.env.AUTH_KV.put(`user:${user.id}`, JSON.stringify(parsedById));
            }
          }
        } catch {
          return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Failed to revoke customer sessions', retryable: true }, 503);
        }
      }
    }

    const revokeTenant = String((device as any)?.tenant_id || tenantId || user?.tenantId || user?.tenant_id || resolvePublicTenantId(c) || 'default').trim() || 'default';
    await writeAuthAuditLog(db, user.id, 'revoke_device', 'trusted_device', id, JSON.stringify({ name: device.name }), now, revokeTenant);

    return c.json({ success: true, data: { success: true } });
  });

  // DELETE /api/auth/devices - Revoke all trusted devices
  app.openapi(AuthRoutes.trustedDevices.revokeAll as any, async (c: any) => {
    const db = c.env.AURA_DB;
    const user = await resolveDeviceUser(c);
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const tenantCheck = verifyDeviceCallerTenant(c, user);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant device access denied' }, 403);
    }
    const tenantId = tenantCheck.tenantId;
    const now = new Date().toISOString();

    try {
      await db
        .prepare("DELETE FROM trusted_devices WHERE user_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
        .bind(user.id, tenantId, tenantId)
        .run();
    } catch {
      if (tenantId === 'default' || tenantId === '*') {
        await db.prepare('DELETE FROM trusted_devices WHERE user_id = ?').bind(user.id).run().catch(() => {});
      }
    }
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').bind(now, user.id).run().catch(() => {});
    if (user.role !== 'customer') {
      try {
        try {
          await db
            .prepare("DELETE FROM staff_devices WHERE staff_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
            .bind(user.id, tenantId, tenantId)
            .run();
        } catch (err) {
          const msg = String((err as Error)?.message ?? err);
          if (/no such column:\s*staff_id/i.test(msg)) {
            await db
              .prepare("DELETE FROM staff_devices WHERE user_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
              .bind(user.id, tenantId, tenantId)
              .run();
          } else if ((tenantId === 'default' || tenantId === '*') && /no such column:\s*tenant_id/i.test(msg)) {
            await db.prepare('DELETE FROM staff_devices WHERE staff_id = ?').bind(user.id).run();
          } else {
            throw err;
          }
        }
        await db.prepare('UPDATE users SET auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?').bind(now, user.id).run();
      } catch {
        return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Failed to revoke staff devices', retryable: true }, 500 as any);
      }
    } else {
      await db
        .prepare("DELETE FROM staff_devices WHERE user_id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
        .bind(user.id, tenantId, tenantId)
        .run()
        .catch(() => {});
      let dbNextVer = Number(user.authVersion || 1) + 1;
      try {
        const currentRow = (await db.prepare('SELECT auth_version FROM users WHERE id = ?').bind(user.id).first().catch(() => null)) as { auth_version?: number } | null;
        if (currentRow && Number.isFinite(Number(currentRow.auth_version))) {
          dbNextVer = Math.max(dbNextVer, Number(currentRow.auth_version) + 1);
        }
        await db.prepare('UPDATE users SET auth_version = COALESCE(auth_version, 1) + 1, updated_at = ? WHERE id = ?').bind(now, user.id).run().catch(() => {});
      } catch {
        return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Failed to revoke customer sessions', retryable: true }, 503);
      }
      if (c.env.AUTH_KV) {
        try {
          let nextVersion = dbNextVer;
          if (user.email) {
            const rawUser = await c.env.AUTH_KV.get(`user:${user.email}`);
            if (rawUser) {
              const parsed = JSON.parse(rawUser) as Record<string, unknown>;
              const currentVer = Number(parsed.auth_version || 1);
              nextVersion = Math.max(nextVersion, currentVer + 1);
              parsed.auth_version = nextVersion;
              parsed.updated_at = now;
              await c.env.AUTH_KV.put(`user:${user.email}`, JSON.stringify(parsed));
            }
          }
          if (user.id) {
            const rawCustVer = await c.env.AUTH_KV.get(`cust_auth_ver:${user.id}`);
            if (rawCustVer) {
              const currentCustVer = Number(rawCustVer);
              if (Number.isFinite(currentCustVer) && currentCustVer >= nextVersion) {
                nextVersion = currentCustVer + 1;
              }
            }
            await c.env.AUTH_KV.put(`cust_auth_ver:${user.id}`, String(nextVersion));
            const rawUserById = await c.env.AUTH_KV.get(`user:${user.id}`);
            if (rawUserById) {
              const parsedById = JSON.parse(rawUserById) as Record<string, unknown>;
              parsedById.auth_version = nextVersion;
              parsedById.updated_at = now;
              await c.env.AUTH_KV.put(`user:${user.id}`, JSON.stringify(parsedById));
            }
          }
        } catch {
          return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Failed to revoke customer sessions', retryable: true }, 503);
        }
      }
    }
    const token = getAuthToken(c.req.raw);
    if (token && c.env.AUTH_KV) {
      try {
        await c.env.AUTH_KV.put('revoked:' + token, '1', { expirationTtl: 604800 });
      } catch {
        return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Failed to revoke active token', retryable: true }, 503);
      }
    }

    const rawRevokeAllTenant = String(tenantId || user?.tenantId || user?.tenant_id || resolvePublicTenantId(c) || 'default').trim();
    const revokeAllTenant = !rawRevokeAllTenant || rawRevokeAllTenant === '*' || rawRevokeAllTenant.toLowerCase() === 'hq' ? 'default' : rawRevokeAllTenant;
    await writeAuthAuditLog(db, user.id, 'revoke_all_devices', 'trusted_device', user.id, JSON.stringify({}), now, revokeAllTenant);

    return c.json({ success: true, data: { success: true } });
  });
}
