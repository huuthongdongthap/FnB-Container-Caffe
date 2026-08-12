// listStaff handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'auth' });

export async function listStaff(request: Request, env: Record<string, unknown>) {
  try {
    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    if (!authKV) {
      return errorResponse('AUTH_KV binding chưa cấu hình', 500);
    }

    const users: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    let pages = 0;
    const MAX_PAGES = 20;

    do {
      const opts: { prefix: string; limit: number; cursor?: string } = { prefix: 'user:', limit: 1000 };
      if (cursor) {
        opts.cursor = cursor;
      }
      const page = await authKV.list(opts);

      for (const key of page.keys) {
        const userStr = await authKV.get(key.name);
        if (!userStr) {
          continue;
        }
        try {
          const u = JSON.parse(userStr);
          if (u.role === 'staff' || u.role === 'owner') {
            users.push({
              id: u.id,
              email: u.email,
              name: u.name || '',
              phone: u.phone || '',
              role: u.role,
              active: u.active !== false,
              created_at: u.created_at || null,
              last_login: u.last_login || null
            });
          }
        } catch { /* skip malformed */ }
      }

      cursor = page.list_complete ? undefined : (page as unknown as { cursor?: string }).cursor;
      pages += 1;
    } while (cursor && pages < MAX_PAGES);

    users.sort((a, b) => {
      const ta = String(a.created_at || '');
      const tb = String(b.created_at || '');
      if (tb !== ta) {
        return tb.localeCompare(ta);
      }
      return String(a.email || '').localeCompare(String(b.email || ''));
    });

    return jsonResponse({ success: true, users });
  } catch (error) {
    log.error('ListStaff error:', { message: (error as Error).message });
    return errorResponse(`Lỗi tải danh sách staff: ${(error as Error).message}`, 500);
  }
}
