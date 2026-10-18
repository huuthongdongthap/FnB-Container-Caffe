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
          if (
            u.role === 'staff' ||
            u.role === 'manager' ||
            u.role === 'waiter' ||
            u.role === 'owner' ||
            u.role === 'admin' ||
            u.role === 'kitchen' ||
            u.role === 'barista' ||
            u.role === 'chef' ||
            u.role === 'cashier'
          ) {
            users.push({
              id: u.id,
              email: u.email,
              name: u.name || '',
              phone: u.phone || '',
              role: u.role,
              position: u.position || u.role,
              active: u.active !== false,
              isActive: u.active !== false,
              created_at: u.created_at || null,
              startedAt: u.created_at || '',
              last_login: u.last_login || null
            });
          }
        } catch { /* skip malformed */ }
      }

      cursor = page.list_complete ? undefined : (page as unknown as { cursor?: string }).cursor;
      pages += 1;
    } while (cursor && pages < MAX_PAGES);

    // Merge D1 users table staff rows so D1-seeded staff also appear in /api/auth/staff
    const dbx = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
    if (dbx) {
      try {
        let d1Users: Record<string, unknown>[] | undefined;
        try {
          const res = await dbx.prepare(
            "SELECT id, email, name, phone, role, is_active, hire_date, created_at FROM users WHERE role IN ('owner', 'admin', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'cashier')"
          ).all<Record<string, unknown>>();
          d1Users = res.results;
        } catch {
          const res = await dbx.prepare(
            "SELECT id, email, name, phone, role, is_active, created_at FROM users WHERE role IN ('owner', 'admin', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'cashier')"
          ).all<Record<string, unknown>>();
          d1Users = res.results;
        }
        const seenIds = new Set(users.map((u) => String(u.id)));
        const seenEmails = new Set(users.map((u) => String(u.email || '').toLowerCase()).filter(Boolean));
        for (const row of d1Users || []) {
          const rowId = String(row.id || '');
          const rowEmail = String(row.email || '').toLowerCase();
          if ((rowId && seenIds.has(rowId)) || (rowEmail && seenEmails.has(rowEmail))) {
            continue;
          }
          const isActive = row.is_active !== undefined ? Boolean(row.is_active) : true;
          const createdAt = String(row.created_at || row.hire_date || '');
          users.push({
            id: rowId,
            email: String(row.email || ''),
            name: String(row.name || ''),
            phone: String(row.phone || ''),
            role: String(row.role || 'staff'),
            position: String(row.role || 'staff'),
            active: isActive,
            isActive,
            created_at: createdAt || null,
            startedAt: createdAt,
            last_login: null
          });
        }
      } catch {
        // D1 fallback optional when mock DB does not define users table
      }

      try {
        const { results: staffRows } = await dbx.prepare(
          "SELECT id, email, name, phone, role, is_active, created_at FROM staff_users"
        ).all<Record<string, unknown>>();
        const seenIds = new Set(users.map((u) => String(u.id)));
        const seenEmails = new Set(users.map((u) => String(u.email || '').toLowerCase()).filter(Boolean));
        for (const row of staffRows || []) {
          const rowId = String(row.id || '');
          const rowEmail = String(row.email || '').toLowerCase();
          if ((rowId && seenIds.has(rowId)) || (rowEmail && seenEmails.has(rowEmail))) {
            continue;
          }
          seenIds.add(rowId);
          if (rowEmail) seenEmails.add(rowEmail);
          const isActive = row.is_active !== undefined ? Boolean(row.is_active) : true;
          const createdAt = String(row.created_at || '');
          users.push({
            id: rowId,
            email: String(row.email || ''),
            name: String(row.name || ''),
            phone: String(row.phone || ''),
            role: String(row.role || 'staff'),
            position: String(row.role || 'staff'),
            active: isActive,
            isActive,
            created_at: createdAt || null,
            startedAt: createdAt,
            last_login: null
          });
        }
      } catch {
        // staff_users table optional
      }
    }

    users.sort((a, b) => {
      const ta = String(a.created_at || '');
      const tb = String(b.created_at || '');
      if (tb !== ta) {
        return tb.localeCompare(ta);
      }
      return String(a.email || '').localeCompare(String(b.email || ''));
    });

    const staff = users.map((u) => ({
      id: String(u.id || ''),
      name: String(u.name || ''),
      role: String(u.position || u.role || 'staff'),
      phone: String(u.phone || ''),
      email: String(u.email || ''),
      isActive: Boolean(u.active ?? u.isActive),
      startedAt: String(u.startedAt || u.created_at || '')
    }));

    return jsonResponse({ success: true, users, staff });
  } catch (error) {
    log.error('ListStaff error:', { message: (error as Error).message });
    return errorResponse('Lỗi tải danh sách staff', 500);
  }
}
