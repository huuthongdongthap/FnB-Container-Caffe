/**
 * WiFi Captive Portal Router — /api/wifi
 *
 * Endpoints:
 *  GET  /status       — Check client MAC authorization status
 *  POST /login        — Guest captive portal login (MAC + Phone + optional Name)
 *  POST /authorize    — Staff/Owner manual grant or revoke override
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import {
  checkWifiSessionStatus,
  loginWifiGuest,
  authorizeWifiOverride
} from '../tree/wifi/session';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { getTenantId, resolvePublicTenantId } from '../middleware/tenant';
import { createLogger } from '../middleware/logger';

const log = createLogger({ route: 'wifi-routes' });

const MAX_WIFI_DURATION_SECONDS = 86400;
const MIN_WIFI_DURATION_SECONDS = 60;

const WifiLoginSchema = z.object({
  mac: z.string().min(1).max(64),
  phone: z.string().min(9).max(20),
  name: z.string().max(120).optional(),
  ip_address: z.string().max(64).optional(),
  duration_seconds: z.number().int().min(MIN_WIFI_DURATION_SECONDS).max(MAX_WIFI_DURATION_SECONDS).optional()
});

const WifiAuthorizeSchema = z.object({
  mac: z.string().min(1).max(64),
  action: z.enum(['grant', 'revoke']),
  duration_seconds: z.number().int().min(MIN_WIFI_DURATION_SECONDS).max(MAX_WIFI_DURATION_SECONDS).optional(),
  notes: z.string().max(500).optional()
});

function resolvePortalTenantId(c: Parameters<typeof resolvePublicTenantId>[0]): string {
  return resolvePublicTenantId(c);
}

export function createWifiRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  // GET /api/wifi/status?mac=...
  // Public captive portal check
  app.get('/status', optionalAuth(), async(c) => {
    try {
      const mac = c.req.query('mac');
      if (!mac) {
        return c.json({ error: 'Missing mac query parameter' }, 400);
      }

      const tenantId = resolvePortalTenantId(c);
      const result = await checkWifiSessionStatus(c.env as Record<string, unknown>, mac, tenantId);
      return c.json(result);
    } catch (err) {
      log.error('wifi_status_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to check WiFi status', authorized: false }, 500);
    }
  });

  // POST /api/wifi/login
  // Public captive portal guest submission
  app.post('/login', optionalAuth(), async(c) => {
    try {
      const kv = c.env?.AUTH_KV as { get?: (k: string) => Promise<string | null>; put?: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void> } | undefined;
      if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
        const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
        const rlKey = `rl:wifi-login:${ip}`;
        const cur = parseInt((await kv.get(rlKey).catch(() => null)) || '0', 10);
        if (cur >= 10) {
          return c.json({ success: false, error: 'Too many WiFi login attempts, please try again later' }, 429);
        }
        await kv.put(rlKey, String(cur + 1), { expirationTtl: 60 }).catch(() => {});
      }

      const body = await c.req.json<Record<string, unknown>>();
      const parsed = WifiLoginSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }

      const tenantId = resolvePortalTenantId(c);
      const result = await loginWifiGuest(c.env as Record<string, unknown>, parsed.data, tenantId);
      return c.json(result);
    } catch (err) {
      const msg = (err as Error).message || '';
      log.error('wifi_login_error', { error: msg });
      const safeError = msg === 'Invalid Vietnamese phone number format'
        ? msg
        : 'Unable to authorize WiFi session';
      return c.json({ success: false, error: safeError }, 400);
    }
  });

  // POST /api/wifi/authorize
  // Supervisor/Manager/Admin/Owner manual MAC grant/revoke override (staff limited to revoke only)
  app.post('/authorize', requireAuth(['owner', 'admin', 'manager', 'supervisor', 'staff']), async(c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = WifiAuthorizeSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }

      const user = c.get('user' as never) as { role?: string } | undefined;
      if (parsed.data.action === 'grant' && user?.role === 'staff') {
        return c.json({ error: 'Forbidden: Role staff is not allowed to grant WiFi overrides' }, 403);
      }

      const tenantId = getTenantId(c).trim() || 'default';
      const result = await authorizeWifiOverride(c.env as Record<string, unknown>, parsed.data, tenantId);
      return c.json(result);
    } catch (err) {
      log.error('wifi_authorize_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to authorize WiFi session' }, 500);
    }
  });

  return app;
}
