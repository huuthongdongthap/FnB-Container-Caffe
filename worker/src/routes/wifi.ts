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
import { requireAuth } from '../middleware/auth';
import { createLogger } from '../middleware/logger';

const log = createLogger({ route: 'wifi-routes' });

const WifiLoginSchema = z.object({
  mac: z.string().min(1),
  phone: z.string().min(9),
  name: z.string().optional(),
  ip_address: z.string().optional(),
  duration_seconds: z.number().int().positive().optional()
});

const WifiAuthorizeSchema = z.object({
  mac: z.string().min(1),
  action: z.enum(['grant', 'revoke']),
  duration_seconds: z.number().int().positive().optional(),
  notes: z.string().optional()
});

export function createWifiRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  // GET /api/wifi/status?mac=...
  // Public captive portal check
  app.get('/status', async(c) => {
    try {
      const mac = c.req.query('mac');
      if (!mac) {
        return c.json({ error: 'Missing mac query parameter' }, 400);
      }

      const result = await checkWifiSessionStatus(c.env as Record<string, unknown>, mac);
      return c.json(result);
    } catch (err) {
      log.error('wifi_status_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to check WiFi status', authorized: false }, 500);
    }
  });

  // POST /api/wifi/login
  // Public captive portal guest submission
  app.post('/login', async(c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = WifiLoginSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }

      const result = await loginWifiGuest(c.env as Record<string, unknown>, parsed.data);
      return c.json(result);
    } catch (err) {
      log.error('wifi_login_error', { error: (err as Error).message });
      return c.json({ success: false, error: (err as Error).message }, 400);
    }
  });

  // POST /api/wifi/authorize
  // Staff/Owner manual MAC grant/revoke override
  app.post('/authorize', requireAuth(['owner', 'staff']), async(c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = WifiAuthorizeSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }

      const result = await authorizeWifiOverride(c.env as Record<string, unknown>, parsed.data);
      return c.json(result);
    } catch (err) {
      log.error('wifi_authorize_error', { error: (err as Error).message });
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  return app;
}
