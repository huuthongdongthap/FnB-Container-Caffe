/**
 * OpenWISP WiFi Captive Portal Session Management (tree layer)
 */

import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'wifi-session' });

export interface WifiSessionRecord {
  id: string;
  client_mac: string;
  ip_address: string | null;
  phone: string | null;
  customer_id: string | null;
  status: string;
  session_timeout: number;
  authorized_at: string;
  expires_at: string;
  created_at: string;
}

export function normalizeMac(mac: string): string {
  const cleaned = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  return cleaned.length === 12 ? cleaned.match(/.{1,2}/g)!.join(':') : mac.toUpperCase();
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+84')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.startsWith('84') && cleaned.length === 11) cleaned = '0' + cleaned.slice(2);
  return cleaned;
}

export function isValidPhone(phone: string): boolean {
  return /^(0[35789])[0-9]{8}$/.test(phone);
}

export function maskWifiPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.length < 7 ? '***' : `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}

function clampWifiDuration(durationSeconds: number | undefined, fallback: number): number {
  if (!durationSeconds || durationSeconds <= 0) return fallback;
  return Math.min(86400, Math.max(60, Math.floor(durationSeconds)));
}

function matchesWifiTenant(row: Record<string, unknown> | null | undefined, tenantId?: string): boolean {
  if (!row) return false;
  if (tenantId === '*') return true;
  const effective = tenantId && tenantId !== '*' ? tenantId : 'default';
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === effective;
  }
  return effective === 'default';
}

export async function checkWifiSessionStatus(
  env: Record<string, unknown>,
  mac: string,
  tenantId?: string
): Promise<{ authorized: boolean; remaining_seconds: number; session?: Partial<WifiSessionRecord> }> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) throw new Error('D1 database binding missing');
  const normalizedMac = normalizeMac(mac);
  const now = new Date().toISOString();
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId : 'default';
  const session = await db
    .prepare(
      `SELECT * FROM wifi_sessions WHERE client_mac = ? AND status = 'authorized' AND expires_at > ? ORDER BY CASE WHEN COALESCE(NULLIF(tenant_id, ''), 'default') = ? THEN 0 ELSE 1 END, expires_at DESC LIMIT 1`
    )
    .bind(normalizedMac, now, effectiveTenant)
    .first<WifiSessionRecord & { tenant_id?: string | null }>()
    .catch(() =>
      db
        .prepare(
          `SELECT * FROM wifi_sessions WHERE client_mac = ? AND status = 'authorized' AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`
        )
        .bind(normalizedMac, now)
        .first<WifiSessionRecord & { tenant_id?: string | null }>()
    );
  if (!session || !matchesWifiTenant(session as unknown as Record<string, unknown>, tenantId)) {
    return { authorized: false, remaining_seconds: 0 };
  }
  const remainingSeconds = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
  return {
    authorized: true,
    remaining_seconds: remainingSeconds,
    session: {
      id: session.id,
      client_mac: session.client_mac,
      phone: maskWifiPhone(session.phone),
      authorized_at: session.authorized_at,
      expires_at: session.expires_at
    }
  };
}

export async function loginWifiGuest(
  env: Record<string, unknown>,
  data: { mac: string; phone: string; name?: string; ip_address?: string; duration_seconds?: number },
  tenantId?: string
): Promise<{
  success: boolean;
  authorized: boolean;
  session_id: string;
  customer_id: string;
  redirect_url: string;
  remaining_seconds: number;
}> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) throw new Error('D1 database binding missing');
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId : 'default';
  const normalizedMac = normalizeMac(data.mac);
  const normalizedPhone = normalizePhone(data.phone);
  if (!isValidPhone(normalizedPhone)) throw new Error('Invalid Vietnamese phone number format');

  const timeoutSeconds = clampWifiDuration(data.duration_seconds, 3600);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + timeoutSeconds * 1000).toISOString();

  let customer = await db
    .prepare("SELECT id, phone, name, tenant_id FROM customers WHERE phone = ? ORDER BY CASE WHEN COALESCE(NULLIF(tenant_id, ''), 'default') = ? THEN 0 ELSE 1 END LIMIT 1")
    .bind(normalizedPhone, effectiveTenant)
    .first<{ id: string; phone: string; name: string; tenant_id?: string | null }>()
    .catch(() =>
      db.prepare('SELECT id, phone, name FROM customers WHERE phone = ? LIMIT 1').bind(normalizedPhone).first<{ id: string; phone: string; name: string }>()
    );
  if (customer && !matchesWifiTenant(customer as unknown as Record<string, unknown>, effectiveTenant)) customer = null;

  let customerId: string;
  if (customer) {
    customerId = customer.id;
    await db.prepare('UPDATE customers SET updated_at = ? WHERE id = ?').bind(nowIso, customerId).run().catch(() => {});
  } else {
    customerId = `CUS_WIFI_${crypto.randomUUID().slice(0, 8)}`;
    const email = `${normalizedPhone}@wifi.aura`;
    const name = data.name?.trim() || 'Khách WiFi';
    try {
      await db
        .prepare(
          `INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, 0, 'BRONZE', 'wifi_portal', ?, ?)`
        )
        .bind(customerId, email, name, normalizedPhone, nowIso, nowIso)
        .run();
    } catch {
      await db
        .prepare('INSERT INTO customers (id, email, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(customerId, email, name, normalizedPhone, nowIso, nowIso)
        .run()
        .catch((err) => log.warn('customer_create_fallback_failed', { error: (err as Error).message }));
    }
    if (effectiveTenant !== 'default') {
      await db.prepare('UPDATE customers SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, customerId).run().catch(() => {});
    }
  }

  const sessionId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO wifi_sessions (id, client_mac, ip_address, phone, customer_id, status, session_timeout, authorized_at, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'authorized', ?, ?, ?, ?)`
    )
    .bind(sessionId, normalizedMac, data.ip_address ?? null, normalizedPhone, customerId, timeoutSeconds, nowIso, expiresIso, nowIso)
    .run();
  if (effectiveTenant !== 'default') {
    await db.prepare('UPDATE wifi_sessions SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, sessionId).run().catch(() => {});
  }
  log.info('wifi_guest_authorized', { mac: normalizedMac, customerId, sessionId });
  return { success: true, authorized: true, session_id: sessionId, customer_id: customerId, redirect_url: 'https://auracafe.vn/menu', remaining_seconds: timeoutSeconds };
}

export async function authorizeWifiOverride(
  env: Record<string, unknown>,
  data: { mac: string; action: 'grant' | 'revoke'; duration_seconds?: number; notes?: string },
  tenantId?: string
): Promise<{ success: boolean; mac: string; action: string }> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) throw new Error('D1 database binding missing');
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId : 'default';
  const normalizedMac = normalizeMac(data.mac);
  const now = new Date();
  const nowIso = now.toISOString();

  if (data.action === 'revoke') {
    if (tenantId !== '*') {
      await db
        .prepare("UPDATE wifi_sessions SET status = 'revoked', expires_at = ? WHERE client_mac = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?")
        .bind(nowIso, normalizedMac, effectiveTenant)
        .run()
        .catch(() =>
          db.prepare("UPDATE wifi_sessions SET status = 'revoked', expires_at = ? WHERE client_mac = ?").bind(nowIso, normalizedMac).run()
        );
    } else {
      await db.prepare("UPDATE wifi_sessions SET status = 'revoked', expires_at = ? WHERE client_mac = ?").bind(nowIso, normalizedMac).run();
    }
    log.info('wifi_session_revoked', { mac: normalizedMac });
    return { success: true, mac: normalizedMac, action: 'revoked' };
  }

  const timeoutSeconds = clampWifiDuration(data.duration_seconds, 7200);
  const expiresIso = new Date(now.getTime() + timeoutSeconds * 1000).toISOString();
  const sessionId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO wifi_sessions (id, client_mac, ip_address, phone, customer_id, status, session_timeout, authorized_at, expires_at, created_at)
       VALUES (?, ?, NULL, NULL, NULL, 'authorized', ?, ?, ?, ?)`
    )
    .bind(sessionId, normalizedMac, timeoutSeconds, nowIso, expiresIso, nowIso)
    .run();
  if (effectiveTenant !== 'default') {
    await db.prepare('UPDATE wifi_sessions SET tenant_id = ? WHERE id = ?').bind(effectiveTenant, sessionId).run().catch(() => {});
  }
  log.info('wifi_session_manually_granted', { mac: normalizedMac, timeoutSeconds });
  return { success: true, mac: normalizedMac, action: 'granted' };
}
