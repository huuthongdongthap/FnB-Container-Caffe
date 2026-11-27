/** Support chat reads only explicitly classified rows owned by the pilot store. */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { requireAuth } from '../middleware/auth';
import { getClientIdentifier } from '../middleware/rate-limit';
import { authenticateRequest } from '../lib/staff-session-auth';
import { staffSessionErrorResponse } from '../lib/staff-session';
import { contactMessageRepository, ContactSchemaUnavailable } from '../lib/contact-message-repository';
import { privacyError, privacyStore } from '../lib/pilot-privacy-access';
import { resolvePilotStore } from '../lib/pilot-store';
import type { Env } from '../types/env';

const roles = ['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin'];
const historyRoles = [...roles, 'customer'];

function normalizeChatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 10) {
    return '0' + digits.slice(2);
  }
  return digits;
}
const sendMessageSchema = z.object({
  name: z.string().trim().min(1, 'Ten khong duoc de trong').max(100),
  phone: z
    .string()
    .trim()
    .min(8, 'So dien thoai khong hop le')
    .max(15)
    .refine((val) => {
      if (!/^\+?[\d\s\-().]+$/.test(val)) return false;
      const digits = normalizeChatPhone(val);
      return digits.length >= 9 && digits.length <= 15;
    }, 'So dien thoai khong hop le'),
  message: z.string().trim().min(1, 'Tin nhan khong duoc de trong').max(2000),
  direction: z.enum(['customer', 'admin']).optional(),
});
async function checkRateLimit(env: Env, key: string, max: number): Promise<boolean> {
  if (!env.AUTH_KV) return true;
  try {
    const fullKey = `rl:chat:${key}`;
    const count = parseInt((await env.AUTH_KV.get(fullKey)) || '0', 10);
    if (count >= max) return false;
    await env.AUTH_KV.put(fullKey, String(count + 1), { expirationTtl: 60 });
    return true;
  } catch { return true; }
}
function chatError(error: unknown, message: string) {
  return privacyError(error) || staffSessionErrorResponse(error)
    || errorResponse(error instanceof ContactSchemaUnavailable ? 'Chat unavailable' : message,
      error instanceof ContactSchemaUnavailable ? 503 : 500);
}
function hasDisallowedStoreOverride(c: Context<{ Bindings: Env }>, tenantId: string): boolean {
  const candidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidates).size > 1) return true;
  const requested = candidates[0] || '';
  return Boolean(requested && (requested === '*' || requested.toLowerCase() === 'hq' || requested !== tenantId));
}
async function sendMessage(c: Context<{ Bindings: Env }>) {
  try {
    const parsed = sendMessageSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }
    const { name, phone: rawPhone, message } = parsed.data;
    const phone = normalizeChatPhone(rawPhone);
    const ip = getClientIdentifier(c);
    if ((ip !== 'unknown' && !(await checkRateLimit(c.env, `ip:${ip}`, 20)))
      || !(await checkRateLimit(c.env, `msg:${phone}`, 10)))
      return errorResponse('Qua nhieu tin nhan, vui long thu lai sau', 429);
    const tenantId = resolvePilotStore(c.env);
    let direction: 'customer' | 'admin' = 'customer';
    if (parsed.data.direction === 'admin') {
      const session = await authenticateRequest(c.req.raw, c.env);
      if (!session) return errorResponse('Unauthorized', 401);
      if ('blocked' in session) return errorResponse(session.blocked, 403);
      // Authority comes from the verified D1 account, never an incidental JWT claim.
      const accountTenant = (session.account?.tenant_id || '').trim() || 'default';
      if (
        !session.account ||
        !roles.includes(session.account.role) ||
        accountTenant !== tenantId ||
        hasDisallowedStoreOverride(c, tenantId)
      )
        return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
      direction = 'admin';
    } else {
      // Prevent spoofing another customer's phone in support chat.
      // Reject explicit invalid/revoked credentials or KV outages instead of downgrading to anonymous.
      const hasAuthHeader = Boolean(c.req.header('Authorization')?.trim());
      const session = await authenticateRequest(c.req.raw, c.env, { optional: !hasAuthHeader });
      if (session && 'blocked' in session) return errorResponse(session.blocked, 403);
      const callerPayload = session && 'payload' in session ? session.payload : null;
      if (callerPayload && callerPayload.role === 'customer') {
        const callerId = String(callerPayload.id || '').trim();
        let callerPhone = '';
        if (callerId && c.env.AURA_DB) {
          const custRow = await c.env.AURA_DB
            .prepare("SELECT phone FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
            .bind(callerId, tenantId)
            .first<{ phone?: string | null }>()
            .catch(() => null);
          if (custRow?.phone) {
            callerPhone = normalizeChatPhone(String(custRow.phone));
          }
        }
        if (!callerPhone || callerPhone !== phone) {
          return errorResponse('Không được phép gửi tin nhắn dưới số điện thoại của khách hàng khác', 403);
        }
      } else if (callerPayload && callerPayload.role !== 'customer') {
        const account = session && 'account' in session ? session.account : null;
        const accountTenant = (account?.tenant_id || '').trim() || 'default';
        if (!account || !roles.includes(account.role) || accountTenant !== tenantId || hasDisallowedStoreOverride(c, tenantId)) {
          return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
        }
      } else if (!callerPayload && c.env.AURA_DB) {
        // Anonymous caller cannot spoof a registered customer's phone (check 0..., 84..., +84... and formatted variants)
        const digits = phone.replace(/[^\d]/g, '');
        const localPhone = digits.startsWith('84') && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
        const intlPhone = localPhone.startsWith('0') ? `84${localPhone.slice(1)}` : localPhone;
        const plusIntlPhone = `+${intlPhone}`;
        let existingOwner: { id?: string } | null = null;
        try {
          existingOwner = await c.env.AURA_DB
            .prepare(
              "SELECT id FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', '') IN (?, ?, ?, ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
            )
            .bind(phone, localPhone, intlPhone, plusIntlPhone, tenantId)
            .first<{ id?: string }>();
        } catch (err) {
          const errMsg = String(err instanceof Error ? err.message : err);
          if (/no such table:\s*customers/i.test(errMsg)) {
            existingOwner = null;
          } else if (tenantId === 'default' && /no such column:\s*tenant_id/i.test(errMsg)) {
            try {
              existingOwner = await c.env.AURA_DB
                .prepare(
                  "SELECT id FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', '') IN (?, ?, ?, ?) LIMIT 1",
                )
                .bind(phone, localPhone, intlPhone, plusIntlPhone)
                .first<{ id?: string }>();
            } catch {
              return errorResponse('Chat unavailable', 503);
            }
          } else {
            return errorResponse('Chat unavailable', 503);
          }
        }
        if (existingOwner?.id) {
          return errorResponse('Vui lòng đăng nhập để gửi tin nhắn bằng số điện thoại đã đăng ký', 401);
        }
      }
    }
    const repository = await contactMessageRepository(c.env.AURA_DB);
    const id = await repository.insert({ tenantId, classification: 'chat', name, phone, content: message,
      direction, category: direction === 'admin' ? 'chat_admin' : 'chat' });
    return jsonResponse({ success: true, message: 'Tin nhan da duoc gui', id }, 201);
  } catch (error) { return chatError(error, 'Failed to send message'); }
}
async function getConversations(c: Context<{ Bindings: Env }>) {
  try {
    const tenantId = privacyStore(c, roles);
    if (tenantId instanceof Response) return tenantId;
    if (hasDisallowedStoreOverride(c, tenantId)) return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
    const repository = await contactMessageRepository(c.env.AURA_DB);
    return jsonResponse({ success: true, data: await repository.conversations(tenantId) });
  } catch (error) { return chatError(error, 'Failed to get conversations'); }
}
async function getMessageHistory(c: Context<{ Bindings: Env }>) {
  try {
    const tenantId = privacyStore(c, historyRoles);
    if (tenantId instanceof Response) return tenantId;
    if (hasDisallowedStoreOverride(c, tenantId)) return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
    const phone = c.req.param('phone') || c.req.param('id');
    if (!phone || phone.length < 8) return errorResponse('So dien thoai khong hop le', 400);

    const caller = c.get('user') as { id?: string; sub?: string; customerId?: string; role?: string; phone?: string } | undefined;
    if (caller?.role === 'customer') {
      const requestedNorm = normalizeChatPhone(phone);
      const callerId = String(caller.customerId || caller.id || caller.sub || '').trim();
      let verifiedCustomerPhone = '';
      if (callerId && c.env.AURA_DB) {
        const custRow = await c.env.AURA_DB
          .prepare("SELECT phone FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
          .bind(callerId, tenantId)
          .first<{ phone?: string | null }>()
          .catch(() => null);
        if (custRow?.phone) {
          verifiedCustomerPhone = normalizeChatPhone(String(custRow.phone));
        }
      }
      if (!verifiedCustomerPhone || verifiedCustomerPhone !== requestedNorm) {
        return errorResponse('Không đủ quyền truy cập cuộc trò chuyện này', 403);
      }
    }

    const repository = await contactMessageRepository(c.env.AURA_DB);
    const markAsRead = caller?.role !== 'customer';
    return jsonResponse({ success: true, data: await repository.history(tenantId, phone.trim(), { markAsRead }) });
  } catch (error) { return chatError(error, 'Failed to get message history'); }
}
export const chatRouter = new Hono<{ Bindings: Env }>();
chatRouter.post('/messages', sendMessage);
chatRouter.get('/conversations', requireAuth(roles), getConversations);
chatRouter.get('/conversations/:id/messages', requireAuth(roles), getMessageHistory);
chatRouter.get('/messages/:phone', requireAuth(historyRoles), getMessageHistory);
