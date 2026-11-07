import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getTenantId } from '../../lib/db';
import {
  err,
  errorResponse,
  hasCrossTenantDindinOverride as hasCrossTenantConfigOverride,
  readConfigRaw,
  writeConfig,
  type DindinContext,
} from './types';

export function registerConfigHandlers(router: Hono<{ Bindings: Env }>): void {
  // ── GET /config ──────────────────────────────────────────────────────────────
  router.get('/config', async (c) => {
    if (hasCrossTenantConfigOverride(c as unknown as Parameters<typeof hasCrossTenantConfigOverride>[0])) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    try {
      const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
      const row = await readConfigRaw(c.env, tenantId);
      if (!row?.config) {
        return c.json({ success: true, data: { menu: { sections: [] }, settings: {} } });
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.config);
      } catch {
        return errorResponse(c as DindinContext, err('D07', 400, 'Định dạng config menu không hợp lệ'));
      }
      const menuSource = (parsed as Record<string, unknown>)?.menu as Record<string, unknown> | undefined;
      const menu = { sections: Array.isArray(menuSource?.sections) ? menuSource.sections : [] };
      const settings = (parsed as Record<string, unknown>)?.settings as Record<string, unknown> | undefined;
      return c.json({
        success: true,
        data: {
          menu,
          settings: settings && typeof settings === 'object' ? settings : {},
        },
      });
    } catch {
      return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
    }
  });

  // ── PUT /config ──────────────────────────────────────────────────────────────
  router.put('/config', async (c) => {
    const user = c.get?.('user' as never) as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
    const hasConfiguredJwt = typeof c.env?.JWT_SECRET === 'string' && c.env.JWT_SECRET.trim().length >= 16;
    if ((user && (!user.role || !['owner', 'admin', 'manager', 'supervisor'].includes(user.role))) || (!user && hasConfiguredJwt)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    if (hasCrossTenantConfigOverride(c as unknown as Parameters<typeof hasCrossTenantConfigOverride>[0])) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    try {
      const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
      const body = await c.req.json<Record<string, unknown>>();
      const menuRaw = body.menu as Record<string, unknown> | undefined;
      if (!menuRaw || !Array.isArray(menuRaw.sections)) {
        return errorResponse(c as DindinContext, err('D07', 400, 'Thiếu menu.sections'));
      }
      for (const section of menuRaw.sections as Array<{ items?: Array<{ name?: unknown; price?: unknown }> }>) {
        const items = section.items ?? [];
        for (const item of items) {
          if (typeof item.name !== 'string') {
            return errorResponse(c as DindinContext, err('D07', 400, 'Định dạng config menu không hợp lệ'));
          }
          if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) {
            return errorResponse(c as DindinContext, err('D07', 400, 'Định dạng config menu không hợp lệ'));
          }
        }
      }
      await writeConfig(c.env, JSON.stringify(body), tenantId);
      return c.json({ success: true } as const);
    } catch {
      return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
    }
  });
}
