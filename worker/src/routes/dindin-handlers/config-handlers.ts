import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { queryFirst } from '../../lib/db';
import {
  err,
  errorResponse,
  writeConfig,
  type DindinContext,
} from './types';

export function registerConfigHandlers(router: Hono<{ Bindings: Env }>): void {
  // ── GET /config ──────────────────────────────────────────────────────────────
  router.get('/config', async (c) => {
    try {
      const row = await queryFirst<{ config: string }>(c.env.AURA_DB, 'SELECT config FROM dindin_config LIMIT 1');
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
    try {
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
          if (typeof item.price !== 'number') {
            return errorResponse(c as DindinContext, err('D07', 400, 'Định dạng config menu không hợp lệ'));
          }
        }
      }
      await writeConfig(c.env, JSON.stringify(body));
      return c.json({ success: true } as const);
    } catch {
      return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
    }
  });
}
