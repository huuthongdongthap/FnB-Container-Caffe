// getCurrentUser handler extracted from routes/auth.ts

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { authenticateRequest } from '../../lib/staff-session-auth';
import { staffSessionErrorResponse, staffTenant } from '../../lib/staff-session';
import type { Env } from '../../types/env';

const log = createLogger({ route: 'auth' });

export async function getCurrentUser(request: Request, env: Record<string, unknown>) {
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
    let userStr = payload.email ? await authKV.get(`user:${payload.email}`) : null;
    if (!userStr && payload.id) {
      userStr = await authKV.get(`user:${payload.id}`);
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
          // Fall through to 404 if customers table unavailable
        }
      }
    }
    if (!userStr) {
      return errorResponse(`User '${payload.email || payload.id}' không tồn tại`, 404);
    }

    const user = JSON.parse(userStr);

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role || 'customer' }
    });
  } catch (error) {
    const response = staffSessionErrorResponse(error);
    if (response) return response;
    log.error('GetUser error:', { message: (error as Error).message });
    return errorResponse('Lỗi server', 500);
  }
}
