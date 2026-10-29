// auth-session.ts — return current session from Bearer token

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { authenticateRequest } from '../lib/staff-session-auth';
import { staffSessionErrorResponse, staffTenant } from '../lib/staff-session';
import type { Env } from '../types/env';

const log = createLogger({ route: 'auth-session' });

export async function getAuthSession(request: Request, env: Record<string, unknown>) {
  try {
    const session = await authenticateRequest(request, env as unknown as Env);
    if (!session) return errorResponse('Chưa đăng nhập', 401);
    if ('blocked' in session) return errorResponse(session.blocked, 403);
    const { payload, account } = session;
    if (account) return jsonResponse({ success: true, user: {
      id: account.id, email: payload.email || '', name: account.name || account.id,
      phone: account.phone || '', role: account.role, tenantId: staffTenant(account),
    } });
    const authKV = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace;
    let userStr = payload.id ? await authKV.get(`user:${payload.id}`) : null;
    if (!userStr && payload.email) {
      const byEmail = await authKV.get(`user:${payload.email}`);
      if (byEmail) {
        try {
          const parsed = JSON.parse(byEmail) as { id?: string };
          if (!payload.id || !parsed.id || parsed.id === payload.id) {
            userStr = byEmail;
          }
        } catch {
          // Ignore malformed KV entry
        }
      }
    }
    if (!userStr && payload.role === 'customer' && payload.id) {
      const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
      if (db) {
        try {
          const customer = await db
            .prepare('SELECT id, email, name, phone, tenant_id FROM customers WHERE id = ?')
            .bind(payload.id)
            .first<{ id: string; email?: string | null; name?: string | null; phone?: string | null; tenant_id?: string | null }>();
          if (customer?.id) {
            if (payload.tenantId && customer.tenant_id && customer.tenant_id !== payload.tenantId) {
              return errorResponse('Tài khoản thuộc cửa hàng khác', 403);
            }
            return jsonResponse({
              success: true,
              user: {
                id: customer.id,
                email: customer.email || '',
                name: customer.name || payload.name || '',
                phone: customer.phone || '',
                role: 'customer',
                tenantId: customer.tenant_id || 'default',
              },
            });
          }
        } catch {
          // Fall through to 404
        }
      }
    }
    if (!userStr) {
      return errorResponse('Tài khoản không tồn tại', 404);
    }

    const user = JSON.parse(userStr);
    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role || 'customer',
        email_verified: user.email_verified === true || user.email_verified === 1
      }
    });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('Session error:', { message: (error as Error).message });
    return errorResponse('Lỗi phiên làm việc', 500);
  }
}
